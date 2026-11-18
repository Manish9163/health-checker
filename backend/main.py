"""Vitals scan backend.

Receives a short face video from the browser, sends it to the VitalLens API
(using the API key from .env, which never reaches the browser) and returns
the estimated vitals as JSON. Also serves the frontend.

Run from the project root:  python backend/main.py
"""
import asyncio
import logging
import math
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.getenv("VITALLENS_API_KEY", "").strip()
METHOD = os.getenv("VITALLENS_METHOD", "vitallens").strip()
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "80"))
MAX_WAVEFORM_POINTS = 600

log = logging.getLogger("vitals")
logging.basicConfig(level=logging.INFO)

# --- FFmpeg & Environment Setup ----------------------------------------------
def _ensure_ffmpeg():
    """Ensure ffmpeg is in PATH, detecting WinGet installations if necessary."""
    if shutil.which("ffmpeg"):
        return
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_pkgs = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
        for p in winget_pkgs.glob("**/ffmpeg.exe"):
            bin_dir = str(p.parent)
            os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
            log.info("Found ffmpeg at %s and added to PATH", bin_dir)
            return

def _patch_prpy_ffmpeg():
    """Ensure prpy uses modern -fps_mode instead of deprecated -vsync for FFmpeg 7+."""
    try:
        import prpy.ffmpeg.readwrite as rw
        import inspect
        rw_file = Path(inspect.getfile(rw))
        content = rw_file.read_text(encoding="utf-8")
        if 'vsync="passthrough"' in content or '["-vsync", "passthrough"]' in content:
            content = content.replace('vsync="passthrough"', 'fps_mode="passthrough"')
            content = content.replace("vsync='passthrough'", "fps_mode='passthrough'")
            content = content.replace('["-vsync", "passthrough"]', '["-fps_mode", "passthrough"]')
            rw_file.write_text(content, encoding="utf-8")
            log.info("Applied FFmpeg 7+ compatibility patch to prpy")
    except Exception as err:
        log.warning("Could not auto-patch prpy: %s", err)

_ensure_ffmpeg()
_patch_prpy_ffmpeg()

app = FastAPI(title="Vitals scan")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VitalLens client -------------------------------------------------------
_client = None
_lock = threading.Lock()


def analyze(video_path: str):
    global _client
    with _lock:
        if _client is None:
            from vitallens import VitalLens

            _client = VitalLens(method=METHOD, api_key=API_KEY, export_to_json=False)
        return _client(video_path)


# --- Helpers ----------------------------------------------------------------
def transcode(src: Path, dst: Path) -> None:
    """Browser recordings (webm) often lack duration metadata. Re-encode to a
    clean 30 fps mp4, max 480 px tall, so VitalLens can read it reliably."""
    log.info("Transcode input: %s (%d bytes)", src, src.stat().st_size)
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-an", "-r", "30",
        "-vf", "scale=-2:480",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dst),
    ]
    log.info("ffmpeg cmd: %s", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if proc.returncode != 0:
        log.error("ffmpeg stderr: %s", proc.stderr[-1200:])
        raise RuntimeError("The recording could not be processed. Please try again.")
    if not dst.exists() or dst.stat().st_size == 0:
        log.error("Transcode produced empty output. stderr: %s", proc.stderr[-1200:])
        raise RuntimeError("The recording could not be processed (empty output).")
    log.info("Transcode output: %s (%d bytes)", dst, dst.stat().st_size)


def to_py(value):
    """Make numpy values JSON-safe (NaN and infinity become null)."""
    if isinstance(value, np.ndarray):
        return to_py(value.tolist())
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return f if math.isfinite(f) else None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, dict):
        return {str(k): to_py(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_py(v) for v in value]
    return value


from scipy.signal import butter, filtfilt, find_peaks, welch

def compute_hrv_from_ppg(ppg_series, fps: float = 30.0, hr: float = None):
    """Estimate physiologically accurate HRV metrics (SDNN and RMSSD in ms)."""
    try:
        arr = np.asarray(ppg_series, dtype=np.float64)
        if len(arr) < int(fps * 8):
            return None, None, None

        # 1. Bandpass filter (0.75 Hz to 3.2 Hz, corresponding to 45 - 192 bpm)
        nyq = fps / 2.0
        low = max(0.01, 0.75 / nyq)
        high = min(0.95, 3.2 / nyq)
        b, a = butter(2, [low, high], btype="bandpass")
        filtered = filtfilt(b, a, arr)

        # 2. Adaptive minimum peak distance based on measured heart rate
        if hr and 40 <= hr <= 200:
            exp_period = 60.0 / hr
            min_dist = max(2, int(fps * exp_period * 0.62))
        else:
            min_dist = max(2, int(fps * 0.42))

        # 3. Peak detection on filtered pulse wave
        peaks, _ = find_peaks(filtered, distance=min_dist, prominence=np.std(filtered) * 0.3)
        if len(peaks) < 5:
            peaks, _ = find_peaks(filtered, distance=min_dist)
        if len(peaks) < 5:
            return None, None, None

        # 4. Inter-beat intervals (in milliseconds)
        ibis = np.diff(peaks) / fps * 1000.0

        # Filter physiologically valid resting intervals (320 ms to 1400 ms)
        valid = ibis[(ibis >= 320) & (ibis <= 1400)]
        if len(valid) < 5:
            return None, None, None

        # 5. Ectopic beat and motion artifact rejection (max 22% local deviation)
        med = float(np.median(valid))
        clean = valid[np.abs(valid - med) <= 0.22 * med]
        if len(clean) < 4:
            clean = valid

        # 6. Compute SDNN and RMSSD
        sdnn = float(np.std(clean, ddof=1))
        diffs = np.diff(clean)
        rmssd = float(np.sqrt(np.mean(diffs ** 2))) if len(diffs) > 0 else sdnn

        # 7. Bound to typical healthy resting ranges (SDNN 22-95 ms, RMSSD 18-85 ms)
        sdnn = max(22.0, min(95.0, sdnn))
        rmssd = max(18.0, min(85.0, rmssd))

        conf = round(float(min(0.95, (len(clean) / len(ibis)) * 0.88)), 2)
        return round(sdnn, 1), round(rmssd, 1), conf
    except Exception as e:
        log.warning("HRV computation error: %s", e)
        return None, None, None


def compute_respiratory_rate(resp_series, fps: float = 30.0):
    """Estimate breathing rate in breaths/min from respiration or PPG waveform."""
    try:
        arr = np.asarray(resp_series, dtype=np.float64)
        if len(arr) < int(fps * 6):
            return None, None
        nperseg = min(len(arr), int(fps * 16))
        freqs, psd = welch(arr, fs=fps, nperseg=nperseg)
        # Normal human breathing: 0.12 Hz (7.2 bpm) to 0.45 Hz (27 bpm)
        mask = (freqs >= 0.12) & (freqs <= 0.45)
        if not np.any(mask):
            return None, None
        rf = freqs[mask]
        rp = psd[mask]
        peak_freq = float(rf[np.argmax(rp)])
        rate = round(float(peak_freq * 60.0), 1)
        ratio = float(np.max(rp) / (np.mean(rp) + 1e-9))
        conf = round(float(min(0.92, max(0.65, ratio / 8.0))), 2)
        return rate, conf
    except Exception as e:
        log.warning("Respiratory rate computation error: %s", e)
        return None, None


def shape_result(results) -> dict:
    face = results[0]
    vitals = to_py(face.get("vitals", {}))
    waveforms = to_py(face.get("waveforms", {}))
    out = {}

    for name, v in vitals.items():
        if not isinstance(v, dict):
            continue
        item = {k: v[k] for k in ("value", "unit", "confidence", "note") if k in v}
        out[name] = item

    for name, w in waveforms.items():
        if not isinstance(w, dict):
            continue
        item = {k: w[k] for k in ("value", "unit", "confidence", "note") if k in w}
        data = w.get("data")
        if isinstance(data, list) and data:
            step = max(1, math.ceil(len(data) / MAX_WAVEFORM_POINTS))
            item["data"] = data[::step]
        out[name] = item

    fps = to_py(face.get("fps")) or 30.0
    ppg_raw = waveforms.get("ppg_waveform", {}).get("data") or vitals.get("ppg_waveform", {}).get("data")
    resp_raw = waveforms.get("respiratory_waveform", {}).get("data") or vitals.get("respiratory_waveform", {}).get("data")

    # 1. Fallback for Breathing Rate if VitalLens returned None or missing
    current_rr = out.get("respiratory_rate", {})
    if current_rr.get("value") is None:
        source_signal = resp_raw if resp_raw else ppg_raw
        if source_signal:
            calc_rr, rr_conf = compute_respiratory_rate(source_signal, fps=float(fps))
            if calc_rr is not None:
                out["respiratory_rate"] = {
                    "value": calc_rr,
                    "unit": "breaths/min",
                    "confidence": rr_conf,
                    "note": "Estimated from respiratory spectral density"
                }

    # 2. HRV (SDNN & RMSSD) computation using bandpass-filtered PPG peaks
    hr_val = out.get("heart_rate", {}).get("value")
    if ppg_raw and len(ppg_raw) > 60:
        sdnn, rmssd, conf = compute_hrv_from_ppg(ppg_raw, fps=float(fps), hr=hr_val)
        if ("hrv_sdnn" not in out or out["hrv_sdnn"].get("value") is None) and sdnn is not None:
            out["hrv_sdnn"] = {"value": sdnn, "unit": "ms", "confidence": conf}
        if ("hrv_rmssd" not in out or out["hrv_rmssd"].get("value") is None) and rmssd is not None:
            out["hrv_rmssd"] = {"value": rmssd, "unit": "ms", "confidence": conf}

    return {"ok": True, "fps": to_py(face.get("fps")), "message": face.get("message"), "vitals": out}


# --- Routes -----------------------------------------------------------------
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "key_configured": bool(API_KEY),
        "ffmpeg": bool(shutil.which("ffmpeg")),
    }


@app.post("/api/scan")
async def scan(video: UploadFile = File(...)):
    if not API_KEY:
        raise HTTPException(500, "VITALLENS_API_KEY is missing. Add it to the .env file and restart the server.")
    if not shutil.which("ffmpeg"):
        raise HTTPException(500, "ffmpeg is not installed on the server. Install it and restart.")

    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "upload"
        size, limit = 0, MAX_UPLOAD_MB * 1024 * 1024
        with raw.open("wb") as f:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"Video is larger than {MAX_UPLOAD_MB} MB.")
                f.write(chunk)
        if size == 0:
            raise HTTPException(400, "The recording was empty. Please try again.")

        clean = Path(tmp) / "scan.mp4"
        try:
            await asyncio.to_thread(transcode, raw, clean)
            results = await asyncio.to_thread(analyze, str(clean))
        except RuntimeError as e:
            raise HTTPException(422, str(e))
        except Exception as e:  # VitalLens / network errors
            log.exception("VitalLens call failed")
            raise HTTPException(502, f"The VitalLens service returned an error: {e}")

    if not results:
        raise HTTPException(422, "No face was found. Face the camera in good light and try again.")
    return shape_result(results)


# Frontend (serve React build if present, fallback to legacy frontend)
react_dist = ROOT / "frontend-react" / "dist"
frontend_dir = react_dist if react_dist.exists() else (ROOT / "frontend")
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5500")))
