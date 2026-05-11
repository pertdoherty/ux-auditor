"use client";

interface MetricData {
  label: string;
  value: number | string;
  unit: string;
  thresholds?: { good: number; poor: number };
}

interface MetricsGaugeProps {
  metrics: MetricData[];
}

export default function MetricsGauge({ metrics }: MetricsGaugeProps) {
  const getStatus = (value: number | string, thresholds?: { good: number; poor: number }) => {
    if (!thresholds || typeof value !== 'number') return { label: '—', className: '' };
    if (value <= thresholds.good) return { label: 'Good', className: 'good' };
    if (value <= thresholds.poor) return { label: 'Needs Work', className: 'needs-improvement' };
    return { label: 'Poor', className: 'poor' };
  };

  const getColor = (value: number | string, thresholds?: { good: number; poor: number }) => {
    if (!thresholds || typeof value !== 'number') return '#8888a0';
    if (value <= thresholds.good) return '#22c55e';
    if (value <= thresholds.poor) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="metrics-grid">
      {metrics.map((metric, i) => {
        const status = getStatus(metric.value, metric.thresholds);
        const color = getColor(metric.value, metric.thresholds);

        return (
          <div key={i} className="metric-card glass-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value" style={{ color }}>{metric.value}</div>
            <div className="metric-unit">{metric.unit}</div>
            {status.className && (
              <div className={`metric-status ${status.className}`}>{status.label}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
