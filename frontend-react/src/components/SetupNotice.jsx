import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export default function SetupNotice() {
  const [issue, setIssue] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('Unhealthy');
        const data = await res.json();
        const problems = [];
        if (!data.key_configured) problems.push('VITALLENS_API_KEY is missing in backend .env.');
        if (!data.ffmpeg) problems.push('FFmpeg is not installed or not found on PATH.');
        if (problems.length) setIssue(problems.join(' '));
      } catch {
        setIssue('Backend is unreachable. Ensure the FastAPI server is running at http://127.0.0.1:5500.');
      }
    }
    checkHealth();
  }, []);

  if (!issue) return null;

  return (
    <div className="setup-banner" role="alert">
      <AlertCircle size={18} />
      <span>{issue}</span>
    </div>
  );
}
