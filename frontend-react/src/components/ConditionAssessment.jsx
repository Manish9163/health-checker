import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import { computeOverallAssessment } from '../constants/metrics';

export default function ConditionAssessment({ vitals }) {
  if (!vitals || Object.keys(vitals).length === 0) return null;

  const assessment = computeOverallAssessment(vitals);

  return (
    <div className={`condition-card status-${assessment.level}`}>
      <div className="condition-card-header">
        <div className="condition-badge-wrap">
          <span className={`badge badge-${assessment.level}`}>
            {assessment.level === 'alert' && <AlertTriangle size={13} />}
            {assessment.level === 'fair' && <Info size={13} />}
            {assessment.level === 'good' && <CheckCircle size={13} />}
            {assessment.badgeLabel}
          </span>
          <h3 className="condition-title">{assessment.title}</h3>
        </div>
      </div>

      <p className="condition-summary-text">{assessment.summary}</p>

      <div className="condition-actions-section">
        <h4 className="actions-header">Recommended Actions & Next Steps:</h4>
        <ul className="actions-list">
          {assessment.actions.map((action, idx) => {
            const isRedFlag = action.includes('RED FLAG');
            return (
              <li key={idx} className={isRedFlag ? 'red-flag-item' : ''}>
                {isRedFlag ? (
                  <div className="red-flag-box">
                    <ShieldAlert size={16} className="red-flag-icon" />
                    <span>{action}</span>
                  </div>
                ) : (
                  action
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
