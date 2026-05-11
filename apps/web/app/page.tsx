"use client";
import { useState, useEffect, useCallback } from "react";
import ScoreGauge from "./components/ScoreGauge";
import IssueCard from "./components/IssueCard";
import DevConsole from "./components/DevConsole";
import MetricsGauge from "./components/MetricsGauge";
import ProgressTracker from "./components/ProgressTracker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PIPELINE_STEPS = [
  "Crawling site & discovering pages",
  "Simulating human interactions",
  "Collecting accessibility & performance data",
  "Running AI analysis (GPT-4o Vision)",
  "Generating report",
];

function getStepStates(progress: number) {
  const thresholds = [20, 50, 70, 85, 100];
  return PIPELINE_STEPS.map((label, i) => {
    const start = i === 0 ? 0 : thresholds[i - 1];
    const end = thresholds[i];
    let status: "pending" | "active" | "done" = "pending";
    if (progress >= end) status = "done";
    else if (progress >= start) status = "active";
    return { label, status };
  });
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ux" | "dev">("ux");
  const [jobId, setJobId] = useState<string | null>(null);

  // Poll for job status
  const pollJob = useCallback(async (id: string) => {
    const maxAttempts = 300; // 5 min max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError("Audit timed out. Please try again.");
        setLoading(false);
        return;
      }
      attempts++;

      try {
        const res = await fetch(`${API_URL}/audit/${id}`);
        const data = await res.json();

        if (data.state === "completed" && data.result) {
          setReport(data.result);
          setProgress(100);
          setLoading(false);
          return;
        }

        if (data.state === "failed") {
          setError(data.failedReason || "Audit failed. Please try again.");
          setLoading(false);
          return;
        }

        if (data.progress) {
          setProgress(data.progress);
        }

        setTimeout(poll, 1000);
      } catch {
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, []);

  const handleAudit = async () => {
    if (!url) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith("http")) {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setLoading(true);
    setProgress(0);
    setReport(null);
    setError(null);
    setActiveTab("ux");

    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await res.json();

      if (data.success && data.jobId) {
        setJobId(data.jobId);
        setProgress(2);
        pollJob(data.jobId);
      } else {
        setError(data.error || "Failed to start audit.");
        setLoading(false);
      }
    } catch (err) {
      setError("Could not connect to API server. Make sure the backend is running.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) handleAudit();
  };

  const ux = report?.uxReport;
  const dev = report?.devReport;
  const meta = report?.meta;

  return (
    <main className="app-container">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="hero animate-in">
        <div className="hero-badge">⚡ AI-Powered</div>
        <h1>UX Auditor</h1>
        <p>Analyze any website for usability, accessibility, and design quality — powered by GPT-4o Vision.</p>
      </section>

      {/* ── URL Input ─────────────────────────────────────── */}
      <section className="input-section animate-in animate-in-delay-1">
        <div className="input-wrapper">
          <input
            id="url-input"
            className="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            disabled={loading}
          />
          <button
            id="audit-btn"
            className="audit-btn"
            onClick={handleAudit}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <div className="spinner" /> Analyzing...
              </>
            ) : (
              <>🔍 Run Audit</>
            )}
          </button>
        </div>
      </section>

      {/* ── Error Banner ──────────────────────────────────── */}
      {error && (
        <div className="error-banner animate-in">
          ⚠️ {error}
        </div>
      )}

      {/* ── Progress Tracker ──────────────────────────────── */}
      {loading && (
        <div className="animate-in">
          <ProgressTracker
            steps={getStepStates(progress)}
            progress={progress}
          />
        </div>
      )}

      {/* ── Report ────────────────────────────────────────── */}
      {report && (
        <div className="animate-in">
          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs-list">
              <button
                className={`tab-btn ${activeTab === "ux" ? "active" : ""}`}
                onClick={() => setActiveTab("ux")}
              >
                📊 UX Report
              </button>
              <button
                className={`tab-btn ${activeTab === "dev" ? "active" : ""}`}
                onClick={() => setActiveTab("dev")}
              >
                🛠️ Dev Report
              </button>
            </div>
          </div>

          {/* ── UX Report Tab ─────────────────────────────── */}
          {activeTab === "ux" && ux && (
            <div>
              {/* Score Section */}
              <div className="score-section animate-in">
                <ScoreGauge score={ux.overallScore || 0} />
                <div className="score-info">
                  <h2>Overall UX Score</h2>
                  <span
                    className="verdict-badge"
                    style={{
                      backgroundColor:
                        ux.verdict === "Excellent" ? "rgba(34,197,94,0.15)" :
                        ux.verdict === "Good" ? "rgba(234,179,8,0.15)" :
                        ux.verdict === "Fair" ? "rgba(249,115,22,0.15)" :
                        "rgba(239,68,68,0.15)",
                      color:
                        ux.verdict === "Excellent" ? "#22c55e" :
                        ux.verdict === "Good" ? "#eab308" :
                        ux.verdict === "Fair" ? "#f97316" :
                        "#ef4444",
                    }}
                  >
                    {ux.verdict}
                  </span>
                  <p className="summary-text">{ux.summary}</p>
                </div>
              </div>

              {/* Strengths */}
              {ux.strengths?.length > 0 && (
                <div className="animate-in animate-in-delay-1">
                  <div className="section-title">💪 Strengths</div>
                  <div className="strengths-list">
                    {ux.strengths.map((s: string, i: number) => (
                      <div key={i} className="strength-tag">✓ {s}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              <div className="animate-in animate-in-delay-2">
                <div className="section-title">📋 Category Breakdown</div>
                <div className="categories-grid">
                  {(ux.categories || []).map((cat: any, i: number) => (
                    <div key={i} className="category-card glass-card">
                      <div className="category-header">
                        <div className="category-label">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </div>
                        <div className="category-score" style={{ color: cat.color }}>
                          {cat.score}
                        </div>
                      </div>
                      <div className="category-bar">
                        <div
                          className="category-bar-fill"
                          style={{
                            width: `${(cat.score / 10) * 100}%`,
                            background: cat.color,
                          }}
                        />
                      </div>
                      <div className="category-assessment">{cat.assessment}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Issues */}
              {ux.topIssues?.length > 0 && (
                <div className="issues-section animate-in animate-in-delay-3">
                  <div className="section-title">🚨 Top Issues</div>
                  {ux.topIssues.map((issue: any, i: number) => (
                    <IssueCard
                      key={i}
                      severity={issue.severity}
                      title={issue.title}
                      description={issue.description}
                      recommendation={issue.recommendation}
                      category={issue.category}
                    />
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {ux.recommendations?.length > 0 && (
                <div className="animate-in">
                  <div className="section-title">💡 Recommendations</div>
                  {ux.recommendations.map((rec: any, i: number) => (
                    <IssueCard
                      key={i}
                      severity={rec.priority}
                      title={rec.title}
                      description={rec.description}
                    />
                  ))}
                </div>
              )}

              {/* Page Breakdown */}
              {ux.pageBreakdown?.length > 1 && (
                <div className="animate-in">
                  <div className="section-title">📄 Pages Scanned</div>
                  <div className="glass-card" style={{ overflow: 'auto' }}>
                    <table className="page-table">
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Score</th>
                          <th>Issues</th>
                          <th>Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ux.pageBreakdown.map((page: any, i: number) => (
                          <tr key={i}>
                            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {page.title || page.url}
                            </td>
                            <td style={{ fontWeight: 600 }}>{page.score ?? '—'}</td>
                            <td>{page.issueCount}</td>
                            <td>{page.verdict}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Meta */}
              {meta && (
                <div style={{ marginTop: '30px', fontSize: '13px', color: '#55556a', textAlign: 'center' }}>
                  Scanned {meta.pagesScanned} page{meta.pagesScanned !== 1 ? 's' : ''} • {meta.duration} • {new Date(meta.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* ── Dev Report Tab ────────────────────────────── */}
          {activeTab === "dev" && dev && (
            <div>
              {/* Summary Stats */}
              <div className="metrics-grid" style={{ marginBottom: '30px' }}>
                <div className="metric-card glass-card">
                  <div className="metric-label">Total Issues</div>
                  <div className="metric-value" style={{ color: dev.totalIssues > 5 ? '#ef4444' : dev.totalIssues > 0 ? '#f97316' : '#22c55e' }}>
                    {dev.totalIssues}
                  </div>
                  <div className="metric-unit">detected</div>
                </div>
                <div className="metric-card glass-card">
                  <div className="metric-label">Console Errors</div>
                  <div className="metric-value" style={{ color: (dev.consoleErrors?.filter((e: any) => e.severity === 'error').length || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                    {dev.consoleErrors?.filter((e: any) => e.severity === 'error').length || 0}
                  </div>
                  <div className="metric-unit">errors</div>
                </div>
                <div className="metric-card glass-card">
                  <div className="metric-label">A11y Violations</div>
                  <div className="metric-value" style={{ color: (dev.accessibilityViolations?.length || 0) > 0 ? '#f97316' : '#22c55e' }}>
                    {dev.accessibilityViolations?.length || 0}
                  </div>
                  <div className="metric-unit">WCAG issues</div>
                </div>
                <div className="metric-card glass-card">
                  <div className="metric-label">Network Fails</div>
                  <div className="metric-value" style={{ color: (dev.networkFailures?.length || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                    {dev.networkFailures?.length || 0}
                  </div>
                  <div className="metric-unit">failed requests</div>
                </div>
              </div>

              {/* Performance Metrics */}
              {dev.performanceMetrics?.length > 0 && (() => {
                const perf = dev.performanceMetrics[0];
                const vitals = perf?.webVitals;
                if (!vitals) return null;
                return (
                  <div>
                    <div className="section-title">⚡ Web Vitals</div>
                    <MetricsGauge metrics={[
                      { label: 'FCP', value: vitals.fcp || '—', unit: 'ms', thresholds: { good: 1800, poor: 3000 } },
                      { label: 'LCP', value: vitals.lcp || '—', unit: 'ms', thresholds: { good: 2500, poor: 4000 } },
                      { label: 'CLS', value: vitals.cls ?? '—', unit: 'score', thresholds: { good: 0.1, poor: 0.25 } },
                      { label: 'TBT', value: vitals.tbt || '—', unit: 'ms', thresholds: { good: 200, poor: 600 } },
                    ]} />
                  </div>
                );
              })()}

              {/* Console Errors */}
              <div className="section-title">🖥️ Console Output</div>
              <DevConsole errors={dev.consoleErrors || []} />

              {/* Bugs */}
              {dev.bugs?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div className="section-title">🐛 Detected Bugs</div>
                  {dev.bugs.map((bug: any, i: number) => (
                    <IssueCard
                      key={i}
                      severity={bug.severity}
                      title={bug.title}
                      description={bug.details}
                      recommendation={bug.fix}
                      category={bug.category}
                    />
                  ))}
                </div>
              )}

              {/* Accessibility Violations */}
              {dev.accessibilityViolations?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div className="section-title">♿ Accessibility Violations</div>
                  {dev.accessibilityViolations.slice(0, 10).map((v: any, i: number) => (
                    <div key={i} className={`violation-card glass-card ${v.impact}`}>
                      <div className="violation-impact" style={{
                        color: v.impact === 'critical' ? '#ef4444' :
                               v.impact === 'serious' ? '#f97316' :
                               v.impact === 'moderate' ? '#eab308' : '#3b82f6'
                      }}>
                        {v.impact}
                      </div>
                      <div className="violation-desc">{v.description}</div>
                      <div className="violation-help">{v.help}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Network Failures */}
              {dev.networkFailures?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div className="section-title">🌐 Network Failures</div>
                  <div className="glass-card" style={{ overflow: 'auto' }}>
                    <table className="page-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Method</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dev.networkFailures.map((nf: any, i: number) => (
                          <tr key={i}>
                            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ef4444' }}>
                              {nf.resourceUrl}
                            </td>
                            <td>{nf.method}</td>
                            <td>{nf.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SEO Issues */}
              {dev.seoIssues?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div className="section-title">🔍 SEO & HTML Issues</div>
                  {dev.seoIssues.map((seo: any, i: number) => (
                    <IssueCard
                      key={i}
                      severity={seo.severity}
                      title={seo.issue}
                      description={`Found on: ${seo.page}`}
                    />
                  ))}
                </div>
              )}

              {meta && (
                <div style={{ marginTop: '30px', fontSize: '13px', color: '#55556a', textAlign: 'center' }}>
                  Scanned {meta.pagesScanned} page{meta.pagesScanned !== 1 ? 's' : ''} • {meta.duration} • {new Date(meta.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}