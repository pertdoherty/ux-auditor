"use client";

interface DevConsoleProps {
  errors: Array<{ page?: string; message: string; severity: string }>;
  title?: string;
}

export default function DevConsole({ errors, title = 'Console Output' }: DevConsoleProps) {
  if (!errors || errors.length === 0) {
    return (
      <div className="dev-console">
        <div className="console-header">
          <div className="console-dots">
            <div className="console-dot red" />
            <div className="console-dot yellow" />
            <div className="console-dot green" />
          </div>
          <span>{title}</span>
        </div>
        <div className="console-body">
          <div className="console-line info">
            <span className="console-badge info">INFO</span>
            <span>No console errors detected ✓</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dev-console">
      <div className="console-header">
        <div className="console-dots">
          <div className="console-dot red" />
          <div className="console-dot yellow" />
          <div className="console-dot green" />
        </div>
        <span>{title} ({errors.length})</span>
      </div>
      <div className="console-body">
        {errors.map((err, i) => (
          <div key={i} className={`console-line ${err.severity}`}>
            <span className={`console-badge ${err.severity}`}>
              {err.severity.toUpperCase()}
            </span>
            <span>{err.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
