"use client";

interface IssueCardProps {
  severity: string;
  title: string;
  description: string;
  recommendation?: string;
  category?: string;
  page?: string;
}

export default function IssueCard({ severity, title, description, recommendation, category }: IssueCardProps) {
  const severityColors: Record<string, string> = {
    high: '#ef4444',
    critical: '#ef4444',
    medium: '#f97316',
    warning: '#f97316',
    low: '#3b82f6',
    info: '#3b82f6',
  };

  const color = severityColors[severity] || '#6b7280';

  return (
    <div className="issue-card glass-card">
      <div className="severity-dot" style={{ backgroundColor: color }} />
      <div className="issue-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div className="issue-title">{title}</div>
          {category && (
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '20px',
              color: '#8888a0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {category}
            </span>
          )}
        </div>
        <div className="issue-desc">{description}</div>
        {recommendation && (
          <div className="issue-fix">💡 {recommendation}</div>
        )}
      </div>
    </div>
  );
}
