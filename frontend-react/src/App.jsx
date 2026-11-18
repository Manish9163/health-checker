import React, { useState } from 'react';
import Header from './components/Header';
import SetupNotice from './components/SetupNotice';
import CameraScanner from './components/CameraScanner';
import PulseWaveCanvas from './components/PulseWaveCanvas';
import MetricCard from './components/MetricCard';
import ConditionAssessment from './components/ConditionAssessment';
import { METRIC_DEFINITIONS } from './constants/metrics';
import { AlertCircle, HelpCircle } from 'lucide-react';

export default function App() {
  const [scanState, setScanState] = useState('idle'); // idle | countdown | recording | analyzing | done | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [scanResults, setScanResults] = useState(null);

  const handleScanComplete = async (videoBlob, filename) => {
    setErrorMessage(null);
    setScanResults(null);

    const formData = new FormData();
    formData.append('video', videoBlob, filename);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || `Server error (${response.status})`);
      }

      setScanResults(data);
      setScanState('done');
    } catch (err) {
      setErrorMessage(err.message || 'The scan could not be processed. Please try again.');
      setScanState('error');
    }
  };

  const handleError = (msg) => {
    setErrorMessage(msg);
    setScanState('error');
  };

  const vitals = scanResults?.vitals || {};
  const waveformData = vitals?.ppg_waveform?.data || null;

  return (
    <div className="app-container">
      <Header />
      <SetupNotice />

      {errorMessage && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <main className="main-layout">
        {/* Left Column: Camera Scanner */}
        <section className="scan-section" aria-label="Camera face scanner">
          <CameraScanner
            state={scanState}
            setState={setScanState}
            onScanComplete={handleScanComplete}
            onError={handleError}
          />
        </section>

        {/* Right Column: Vitals Dashboard & Results */}
        <section className="results-section" aria-label="Scan results">
          <div className="results-header">
            <h2>Vitals Assessment</h2>
            {scanState === 'done' && (
              <span className="results-badge">Scan Complete</span>
            )}
          </div>

          {/* Real-time Photoplethysmography Waveform Canvas */}
          <PulseWaveCanvas waveformData={waveformData} />

          {/* Individual Metric Cards */}
          <div className="metrics-grid">
            {METRIC_DEFINITIONS.map((metric) => (
              <MetricCard
                key={metric.key}
                definition={metric}
                data={vitals[metric.key]}
              />
            ))}
          </div>

          {/* Overall Condition Assessment & Next Steps Card */}
          {scanResults && <ConditionAssessment vitals={vitals} />}

          {/* Pre-scan tips shown before first scan */}
          {!scanResults && (
            <div className="tips-card">
              <div className="tips-title">
                <HelpCircle size={16} />
                <span>Tips for accurate contactless scanning</span>
              </div>
              <ul className="tips-list">
                <li>Face an even, gentle light source or window (avoid heavy backlighting).</li>
                <li>Rest your computer/device on a sturdy table to eliminate camera shake.</li>
                <li>Keep your entire face centered in the oval and remain still without talking.</li>
              </ul>
            </div>
          )}

          {/* Clinical Disclaimer */}
          <p className="medical-disclaimer">
            <strong>Wellness Disclaimer:</strong> Values are computer-vision estimates for general wellness and fitness awareness only. This system is not an FDA-cleared diagnostic medical device and cannot diagnose, prevent, or treat any medical condition. Always consult a licensed healthcare professional for any health concerns.
          </p>
        </section>
      </main>
    </div>
  );
}
