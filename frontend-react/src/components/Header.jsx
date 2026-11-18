import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-badge">
        <Activity size={15} className="pulse-icon" />
        <span>Contactless Pulse, Heart Rate checker</span>
      </div>
      <h1 className="header-title">Check your vitals with your camera</h1>
      <p className="header-subtitle">
        A 30-second contactless facial scan powered by computer vision to estimate heart rate, respiration pace, and heart rate variability.
      </p>
    </header>
  );
}
