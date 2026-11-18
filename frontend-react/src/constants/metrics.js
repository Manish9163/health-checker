export const SCAN_SECONDS = 30;
export const COUNTDOWN_SECONDS = 3;

export const METRIC_DEFINITIONS = [
  {
    key: 'heart_rate',
    label: 'Heart Rate',
    unit: 'bpm',
    healthyTarget: '60 – 100 bpm (ideal resting: 60 – 80)',
    assess(val) {
      if (val < 50) return { label: 'Low', level: 'alert', desc: 'Below typical resting rate (bradycardia)' };
      if (val < 60) return { label: 'Athletic / Relaxed', level: 'good', desc: 'Common in active individuals or deep rest' };
      if (val <= 85) return { label: 'Optimal', level: 'good', desc: 'Ideal resting cardiovascular rhythm' };
      if (val <= 100) return { label: 'Normal', level: 'good', desc: 'Within standard healthy resting range' };
      if (val <= 115) return { label: 'Elevated', level: 'fair', desc: 'Mildly high resting pulse (stress/caffeine)' };
      return { label: 'High', level: 'alert', desc: 'Significantly elevated resting heart rate (tachycardia)' };
    },
  },
  {
    key: 'respiratory_rate',
    label: 'Breathing Rate',
    unit: 'breaths/min',
    healthyTarget: '12 – 20 breaths/min',
    assess(val) {
      if (val < 10) return { label: 'Slow', level: 'alert', desc: 'Below standard resting rate' };
      if (val <= 11) return { label: 'Relaxed', level: 'good', desc: 'Calm, slow breathing rhythm' };
      if (val <= 18) return { label: 'Optimal', level: 'good', desc: 'Ideal resting respiratory pace' };
      if (val <= 20) return { label: 'Normal', level: 'good', desc: 'Within healthy resting limits' };
      if (val <= 24) return { label: 'Elevated', level: 'fair', desc: 'Slightly rapid breathing' };
      return { label: 'Rapid', level: 'alert', desc: 'Rapid respiratory rate (tachypnea)' };
    },
  },
  {
    key: 'hrv_sdnn',
    label: 'Heart Rate Variability (SDNN)',
    unit: 'ms',
    healthyTarget: '> 40 ms (higher = greater resilience)',
    assess(val) {
      if (val >= 60) return { label: 'High Resilience', level: 'good', desc: 'Excellent autonomic regulation and recovery capacity' };
      if (val >= 40) return { label: 'Normal', level: 'good', desc: 'Healthy autonomic balance and cardiovascular flexibility' };
      if (val >= 28) return { label: 'Fair', level: 'fair', desc: 'Moderate stress or physical fatigue' };
      return { label: 'Low', level: 'alert', desc: 'Elevated systemic stress or heavy exhaustion' };
    },
  },
  {
    key: 'hrv_rmssd',
    label: 'Heart Rate Variability (RMSSD)',
    unit: 'ms',
    healthyTarget: '> 30 ms (higher = better recovery)',
    assess(val) {
      if (val >= 45) return { label: 'Well Recovered', level: 'good', desc: 'Strong parasympathetic recovery tone; body is rested' };
      if (val >= 30) return { label: 'Normal', level: 'good', desc: 'Healthy resting state and balanced nervous system' };
      if (val >= 22) return { label: 'Fair', level: 'fair', desc: 'Mild systemic strain or incomplete recovery' };
      return { label: 'Low Recovery', level: 'alert', desc: 'Low vagal activity; indicates stress or physical exhaustion' };
    },
  },
];

export function computeOverallAssessment(vitals) {
  const hr = vitals?.heart_rate?.value ?? null;
  const br = vitals?.respiratory_rate?.value ?? null;
  const sdnn = vitals?.hrv_sdnn?.value ?? null;
  const rmssd = vitals?.hrv_rmssd?.value ?? null;

  const alerts = [];

  // Heart Rate
  let hrStatus = 'normal';
  if (hr !== null) {
    if (hr > 120) {
      alerts.push(`High heart rate (${Math.round(hr)} bpm - Tachycardia)`);
      hrStatus = 'high';
    } else if (hr > 100) {
      alerts.push(`Elevated heart rate (${Math.round(hr)} bpm)`);
      hrStatus = 'elevated';
    } else if (hr < 50) {
      alerts.push(`Low resting pulse (${Math.round(hr)} bpm - Bradycardia)`);
      hrStatus = 'low';
    }
  }

  // Breathing Rate
  let brStatus = 'normal';
  if (br !== null) {
    if (br > 24) {
      alerts.push(`Rapid breathing (${Math.round(br)} breaths/min - Tachypnea)`);
      brStatus = 'high';
    } else if (br > 20) {
      alerts.push(`Elevated breathing rate (${Math.round(br)} breaths/min)`);
      brStatus = 'elevated';
    } else if (br < 10) {
      alerts.push(`Slow breathing rate (${Math.round(br)} breaths/min)`);
      brStatus = 'low';
    }
  }

  // HRV Recovery
  if (sdnn !== null && rmssd !== null) {
    if (sdnn < 28 || rmssd < 22) {
      alerts.push('Low HRV indicating elevated physical stress or fatigue');
    }
  }

  const isSevere = hrStatus === 'high' || brStatus === 'high';
  const isModerate = alerts.length > 0;

  if (isSevere) {
    return {
      title: 'Noticeably Elevated Vitals Detected',
      badgeLabel: '⚠️ Attention',
      level: 'alert',
      summary: `One or more vital metrics are significantly above resting targets: ${alerts.join(', ')}. If you just exercised, were speaking, or felt anxious during the scan, this may be temporary.`,
      actions: [
        'Sit back in a supportive chair, rest quietly for 5–10 minutes, and sip some water.',
        'Practice calming diaphragmatic breathing: inhale slowly through your nose for 4 seconds, exhale gently for 6 seconds.',
        'Cross-check your readings using a clinically validated fingertip pulse oximeter or manual 60-second radial pulse count.',
        '🚨 RED FLAG NOTICE: If you experience chest tightness/pain, pressure radiating to your arm or jaw, severe shortness of breath, dizziness, or fainting, contact medical emergency services immediately.',
      ],
      isSevere: true,
    };
  }

  if (isModerate) {
    return {
      title: 'Mildly Elevated / Stressed State',
      badgeLabel: 'Notice',
      level: 'fair',
      summary: `Your readings indicate mild physiological stimulation: ${alerts.join(', ')}. Common triggers include recent caffeine intake, anxiety, talking during the scan, or slight dehydration.`,
      actions: [
        'Rest quietly for 5 minutes in a calm environment without talking.',
        'Drink a glass of water and avoid stimulants like energy drinks or coffee.',
        'Retest the scan once you feel settled and completely still.',
      ],
      isSevere: false,
    };
  }

  return {
    title: 'Optimal / Healthy Resting Vitals',
    badgeLabel: '✓ Normal',
    level: 'good',
    summary: 'Your resting vital signs are within standard healthy reference limits. Cardiovascular rhythm and respiration are balanced.',
    actions: [
      'Maintain healthy daily hydration and balanced nutrition.',
      'Ensure consistent rest and 7–8 hours of restorative sleep.',
      'Repeat checks under similar resting conditions to track personal trends.',
    ],
    isSevere: false,
  };
}
