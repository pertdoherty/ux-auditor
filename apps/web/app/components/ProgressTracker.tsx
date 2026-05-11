"use client";

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done';
}

interface ProgressTrackerProps {
  steps: Step[];
  progress: number;
}

export default function ProgressTracker({ steps, progress }: ProgressTrackerProps) {
  return (
    <div className="progress-section">
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-steps">
        {steps.map((step, i) => (
          <div key={i} className={`progress-step ${step.status}`}>
            <div className="step-icon">
              {step.status === 'done' && '✓'}
              {step.status === 'active' && <div className="spinner" />}
              {step.status === 'pending' && '○'}
            </div>
            <span>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
