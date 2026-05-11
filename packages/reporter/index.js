/**
 * UX Auditor — Report Generator
 * 
 * Transforms raw AI analysis + collected data into two structured reports:
 *   1. UX Report — human-readable, plain language
 *   2. Dev Report — technical, code-level findings
 */

const { calculateScores } = require('./scoring');
const { formatHumanReport, formatDevReport } = require('./formatter');

/**
 * Generate the final audit report.
 * 
 * @param {object} analysis — AI analysis results
 * @param {Array} pageResults — raw collected page data
 * @param {object} meta — audit metadata
 * @returns {object} final structured report
 */
async function generateReport(analysis, pageResults, meta) {
  const startTime = Date.now();

  // ── Calculate unified scores ─────────────────────────────
  const scores = calculateScores(analysis, pageResults);

  // ── Build UX Report ──────────────────────────────────────
  const uxReport = formatHumanReport(analysis, scores, pageResults);

  // ── Build Dev Report ─────────────────────────────────────
  const devReport = formatDevReport(analysis, pageResults);

  // ── Build heatmaps ───────────────────────────────────────
  const heatmaps = (analysis.heatmaps || []).map((h) => ({
    url: h.url,
    data: h.heatmap,
  }));

  // ── Assemble final report ────────────────────────────────
  const report = {
    // Report 1: Human-language UX audit
    uxReport: {
      overallScore: scores.overall,
      verdict: scores.verdict,
      summary: analysis.overall?.summary || uxReport.summary,
      strengths: analysis.overall?.strengths || [],
      weaknesses: analysis.overall?.weaknesses || [],
      categories: uxReport.categories,
      topIssues: uxReport.topIssues,
      recommendations: analysis.overall?.topRecommendations || uxReport.recommendations,
      heatmaps,
      pageBreakdown: uxReport.pageBreakdown,
    },

    // Report 2: Dev-mode technical report
    devReport: {
      totalIssues: devReport.totalIssues,
      bugs: devReport.bugs,
      consoleErrors: devReport.consoleErrors,
      networkFailures: devReport.networkFailures,
      accessibilityViolations: devReport.accessibilityViolations,
      performanceMetrics: devReport.performanceMetrics,
      seoIssues: devReport.seoIssues,
      suggestions: devReport.suggestions,
    },

    // Metadata
    meta: {
      entryUrl: meta.entryUrl,
      pagesScanned: meta.pagesScanned,
      timestamp: new Date().toISOString(),
      duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
      version: '1.0.0',
    },

    // Raw data for frontend (screenshots, etc.)
    raw: {
      screenshots: pageResults
        .filter((p) => p.data?.screenshots?.viewport)
        .map((p) => ({
          url: p.url,
          viewport: p.data.screenshots.viewport,
          mobile: p.data.screenshots.mobile || null,
        })),
    },
  };

  return report;
}

module.exports = { generateReport };
