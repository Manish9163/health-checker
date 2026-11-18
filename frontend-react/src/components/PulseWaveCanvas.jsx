import React, { useEffect, useRef } from 'react';

export default function PulseWaveCanvas({ waveformData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (!waveformData || waveformData.length < 2) {
      // Draw idle baseline dashed line
      ctx.strokeStyle = '#d3dddb';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    // Clean data and scale
    let prev = 0;
    const values = waveformData.map((v) => (Number.isFinite(v) ? (prev = v) : prev));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 12;

    // Draw background subtle grid lines
    ctx.strokeStyle = '#f1f5f4';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let y = pad; y < h - pad; y += (h - pad * 2) / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw pulsating waveform
    ctx.strokeStyle = '#e0364a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    ctx.beginPath();
    values.forEach((val, i) => {
      const px = (i / (values.length - 1)) * w;
      const py = h - pad - ((val - min) / span) * (h - pad * 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Subtle area glow underneath the line
    const lastX = w;
    const lastY = h - pad;
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(224, 54, 74, 0.12)');
    gradient.addColorStop(1, 'rgba(224, 54, 74, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [waveformData]);

  return (
    <div className="wave-container">
      <div className="wave-header">
        <span className="wave-label">Live Photoplethysmography (PPG) Pulse Waveform</span>
        {waveformData && waveformData.length > 0 && <span className="wave-live-badge">Signal Extracted</span>}
      </div>
      <canvas ref={canvasRef} className="wave-canvas" role="img" aria-label="Pulse waveform" />
    </div>
  );
}
