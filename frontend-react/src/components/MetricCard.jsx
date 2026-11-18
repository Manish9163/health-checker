import React from 'react';
import { Target, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export default function MetricCard({ definition, data }) {
  const hasValue = data && typeof data.value === 'number';
  const val = hasValue ? data.value : null;

  const assessment = hasValue && definition.assess ? definition.assess(val) : null;
  const confidence = hasValue && typeof data.confidence === 'number' ? Math.round(data.confidence * 100) : null;

  const confClass = confidence >= 80 ? 'conf-high' : confidence >= 65 ? 'conf-med' : 'conf-low';

  return (
    <div className={`metric-card ${hasValue ? '' : 'empty'}`}>
      <div className="metric-card-top">
        <div className="metric-title-group">
          <span className="metric-title">{definition.label}</span>
          {assessment && (
            <span className={`status-badge badge-${assessment.level}`}>
              {assessment.level === 'good' && <CheckCircle2 size={12} />}
              {assessment.level === 'fair' && <AlertTriangle size={12} />}
              {assessment.level === 'alert' && <AlertOctagon size={12} />}
              {assessment.label}
            </span>
          )}
        </div>
        <div className="metric-reading">
          <span className="metric-number">
            {hasValue ? (Math.abs(val) >= 10 ? Math.round(val) : val.toFixed(1)) : '–'}
          </span>
          {hasValue && <span className="metric-unit">{definition.unit}</span>}
        </div>
      </div>

      <div className="metric-card-bottom">
        {hasValue ? (
          <>
            <div className="metric-target-row">
              <Target size={13} className="target-icon" />
              <span>
                <strong>Target:</strong> {definition.healthyTarget}
              </span>
            </div>

            <div className="metric-meta-row">
              {assessment?.desc && <span className="metric-desc">{assessment.desc}</span>}
              {confidence !== null && (
                <span className={`confidence-pill ${confClass}`}>
                  <span className="conf-dot">●</span> {confidence}% confidence
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="metric-empty-text">
            {data?.note || 'Not available for this scan'}
          </span>
        )}
      </div>
    </div>
  );
}
