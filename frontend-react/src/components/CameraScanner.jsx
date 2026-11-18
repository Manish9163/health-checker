import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import { SCAN_SECONDS, COUNTDOWN_SECONDS } from '../constants/metrics';

export default function CameraScanner({ state, setState, onScanComplete, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const runIdRef = useRef(0);

  const [caption, setCaption] = useState('Camera is off. Press Start scan when you are ready.');
  const [progress, setProgress] = useState(0);

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const pickMime = () => {
    const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    return options.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  };

  const handleCancel = useCallback(() => {
    runIdRef.current++;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopCamera();
    setProgress(0);
    setState('idle');
    setCaption('Camera is off. Press Start scan when you are ready.');
  }, [setState, stopCamera]);

  const handleRecorded = useCallback(
    (currentRun, mimeType) => {
      if (currentRun !== runIdRef.current) return;
      stopCamera();
      setState('analyzing');
      setCaption('Analyzing video signals with rPPG computer vision. This takes 10–25 seconds…');

      const blobType = mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: blobType });
      const filename = 'scan.' + (blobType.includes('mp4') ? 'mp4' : 'webm');

      onScanComplete(blob, filename);
    },
    [onScanComplete, setState, stopCamera]
  );

  const startRecording = useCallback(
    (currentRun) => {
      chunksRef.current = [];
      const mime = pickMime();

      try {
        const recorder = new MediaRecorder(streamRef.current, {
          ...(mime && { mimeType: mime }),
          videoBitsPerSecond: 2500000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          handleRecorded(currentRun, recorder.mimeType || mime);
        };

        recorderRef.current = recorder;
        recorder.start(1000);
      } catch (err) {
        onError('Unable to record video in this browser format: ' + err.message);
        handleCancel();
        return;
      }

      setState('recording');
      setCaption(`Hold still and look at camera. ${SCAN_SECONDS}s remaining`);

      const startTime = performance.now();
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const pct = Math.min(100, (elapsed / SCAN_SECONDS) * 100);
        setProgress(pct);

        const left = Math.max(0, Math.ceil(SCAN_SECONDS - elapsed));
        setCaption(`Hold still and breathe normally. ${left}s left`);

        if (elapsed >= SCAN_SECONDS) {
          clearInterval(timerRef.current);
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
        }
      }, 150);
    },
    [handleCancel, handleRecorded, onError, setState]
  );

  const startScan = async () => {
    const currentRun = ++runIdRef.current;
    setProgress(0);

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      onError('This browser cannot record video. Please use Chrome, Edge, Safari, or Firefox.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        onError('Camera permission was denied. Please allow camera access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        onError('No camera detected on this computer.');
      } else {
        onError('Failed to open camera: ' + err.message);
      }
      return;
    }

    setState('countdown');
    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
      setCaption(`Center your face in the oval. Starting in ${i}…`);
      await new Promise((r) => setTimeout(r, 1000));
      if (currentRun !== runIdRef.current) return;
    }

    startRecording(currentRun);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="camera-card">
      <div className={`camera-stage state-${state}`}>
        <video ref={videoRef} playsInline muted className="camera-video" />

        {/* Oval Face Guide Overlay */}
        <svg className="camera-guide" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path
            className="guide-dim"
            fillRule="evenodd"
            d="M0 0H400V300H0Z M95 150a105 125 0 1 0 210 0a105 125 0 1 0 -210 0Z"
          />
          <ellipse
            className={`guide-ring ${state === 'recording' ? 'scanning' : ''}`}
            cx="200"
            cy="150"
            rx="105"
            ry="125"
          />
        </svg>

        {/* Live scanning status pill */}
        <div className="camera-caption-bar">
          <span className="caption-text">{caption}</span>
        </div>
      </div>

      {/* Progress Bar during 30s scan */}
      <div className="scan-progress-track" aria-hidden="true">
        <div className="scan-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="camera-actions">
        {state === 'idle' || state === 'done' || state === 'error' ? (
          <button type="button" className="action-btn btn-primary" onClick={startScan}>
            <Camera size={18} />
            <span>{state === 'done' ? 'Scan Again' : 'Start Scan'}</span>
          </button>
        ) : state === 'countdown' || state === 'recording' ? (
          <button type="button" className="action-btn btn-cancel" onClick={handleCancel}>
            <XCircle size={18} />
            <span>Cancel Scan</span>
          </button>
        ) : (
          <button type="button" className="action-btn btn-disabled" disabled>
            <RefreshCw size={18} className="spinner" />
            <span>Analyzing Scan…</span>
          </button>
        )}
      </div>
    </div>
  );
}
