/**
 * Report Formatter
 * 
 * Formats raw analysis data into human-readable and dev-focused structures.
 */

/**
 * Format UX report for human consumption.
 */
function formatHumanReport(analysis, scores, pageResults) {
  const report = {
    summary: '',
    categories: [],
    topIssues: [],
    recommendations: [],
    pageBreakdown: [],
  };

  // ── Summary ──────────────────────────────────────────────
  report.summary = analysis.overall?.summary ||
    generateSummary(scores);

  // ── Categories ───────────────────────────────────────────
  const categoryLabels = {
    visualDesign: { label: 'Visual Design', icon: '🎨', description: 'Color harmony, typography, whitespace, and visual hierarchy' },
    navigation: { label: 'Navigation & Flow', icon: '🧭', description: 'Menu clarity, CTA placement, and user journey' },
    contentClarity: { label: 'Content Clarity', icon: '📝', description: 'Readability, information hierarchy, and copy quality' },
    accessibility: { label: 'Accessibility', icon: '♿', description: 'WCAG compliance, screen reader readiness, and inclusive design' },
    performance: { label: 'Performance', icon: '⚡', description: 'Page speed, load times, and perceived performance' },
    mobileUX: { label: 'Mobile UX', icon: '📱', description: 'Touch-friendly design and responsive layout' },
    trustCredibility: { label: 'Trust & Credibility', icon: '🔒', description: 'Professional appearance and consistent styling' },
    interactionDesign: { label: 'Interaction Design', icon: '🖱️', description: 'Button states, feedback mechanisms, and form usability' },
  };

  for (const [key, catData] of Object.entries(scores.categories)) {
    const meta = categoryLabels[key] || { label: key, icon: '📊', description: '' };
    const aiCategory = findAICategory(analysis, key);

    report.categories.push({
      key,
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
      score: catData.score,
      maxScore: 10,
      assessment: aiCategory?.assessment || getScoreAssessment(catData.score),
      suggestions: aiCategory?.suggestions || [],
      color: getScoreColor(catData.score),
    });
  }

  // Sort by score (worst first — these need attention)
  report.categories.sort((a, b) => a.score - b.score);

  // ── Top Issues ───────────────────────────────────────────
  const allIssues = [];
  for (const page of (analysis.pages || [])) {
    if (!page.uxAnalysis?.issues) continue;
    for (const issue of page.uxAnalysis.issues) {
      allIssues.push({
        ...issue,
        page: page.url,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  allIssues.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  report.topIssues = allIssues.slice(0, 10).map((issue) => ({
    severity: issue.severity,
    severityColor: getSeverityColor(issue.severity),
    title: issue.title,
    description: issue.description,
    recommendation: issue.recommendation,
    category: issue.category,
    page: issue.page,
  }));

  // ── Recommendations ──────────────────────────────────────
  report.recommendations = (analysis.overall?.topRecommendations || []).map((rec) => ({
    priority: rec.priority,
    priorityColor: getSeverityColor(rec.priority === 'high' ? 'high' : rec.priority === 'medium' ? 'medium' : 'low'),
    title: rec.title,
    description: rec.description,
  }));

  // ── Page Breakdown ───────────────────────────────────────
  report.pageBreakdown = (analysis.pages || []).map((page) => ({
    url: page.url,
    title: page.title || page.url,
    score: page.uxAnalysis?.overallScore || null,
    verdict: page.uxAnalysis?.overallScore ? getVerdict(page.uxAnalysis.overallScore) : 'N/A',
    issueCount: page.uxAnalysis?.issues?.length || 0,
    assessment: page.uxAnalysis?.overallAssessment || '',
  }));

  return report;
}

/**
 * Format dev report for technical consumption.
 */
function formatDevReport(analysis, pageResults) {
  const report = {
    totalIssues: 0,
    bugs: [],
    consoleErrors: [],
    networkFailures: [],
    accessibilityViolations: [],
    performanceMetrics: [],
    seoIssues: [],
    suggestions: [],
  };

  for (const page of pageResults) {
    const url = page.url;

    // Console errors
    if (page.data?.console?.errors) {
      for (const error of page.data.console.errors) {
        report.consoleErrors.push({ page: url, message: error, severity: 'error' });
      }
    }
    if (page.data?.console?.warnings) {
      for (const warning of page.data.console.warnings) {
        report.consoleErrors.push({ page: url, message: warning, severity: 'warning' });
      }
    }

    // Network failures
    if (page.data?.network?.failed) {
      for (const req of page.data.network.failed) {
        report.networkFailures.push({
          page: url,
          resourceUrl: req.url,
          method: req.method,
          error: req.failure,
          type: req.resourceType,
        });
      }
    }

    // Accessibility violations
    if (page.data?.accessibility?.violations) {
      for (const violation of page.data.accessibility.violations) {
        report.accessibilityViolations.push({
          page: url,
          rule: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          elements: (violation.nodes || []).map((n) => n.html),
        });
      }
    }

    // Performance metrics
    if (page.data?.performance) {
      report.performanceMetrics.push({
        page: url,
        webVitals: page.data.performance.webVitals,
        timing: page.data.performance.timing,
        score: page.data.performance.score,
        resources: page.data.performance.resources,
      });
    }

    // SEO issues from DOM analysis
    if (page.data?.dom) {
      const dom = page.data.dom;

      if (!dom.hasViewportMeta) {
        report.seoIssues.push({ page: url, issue: 'Missing viewport meta tag', severity: 'warning' });
      }
      if (dom.language === 'not set') {
        report.seoIssues.push({ page: url, issue: 'Missing lang attribute on <html>', severity: 'warning' });
      }
      if (dom.headingHierarchyValid?.issues?.length > 0) {
        for (const issue of dom.headingHierarchyValid.issues) {
          report.seoIssues.push({ page: url, issue, severity: 'info' });
        }
      }
      if (dom.images?.missingAlt > 0) {
        report.seoIssues.push({
          page: url,
          issue: `${dom.images.missingAlt} image(s) missing alt attribute`,
          severity: 'warning',
        });
      }
      if (dom.links?.unsafeNewTab > 0) {
        report.seoIssues.push({
          page: url,
          issue: `${dom.links.unsafeNewTab} external link(s) open in new tab without rel="noopener"`,
          severity: 'info',
        });
      }
    }

    // AI dev findings
    const pageAnalysis = (analysis.pages || []).find((p) => p.url === url);
    if (pageAnalysis?.devAnalysis?.bugs) {
      for (const bug of pageAnalysis.devAnalysis.bugs) {
        report.bugs.push({
          page: url,
          ...bug,
        });
      }
    }

    // Failed interactions
    if (page.simulation?.interactions) {
      const failed = page.simulation.interactions.filter((i) => i.status === 'fail');
      for (const f of failed) {
        report.bugs.push({
          page: url,
          severity: 'warning',
          title: `Non-clickable element: ${f.element?.text || f.element?.selector || 'unknown'}`,
          details: f.error || 'Element click failed',
          fix: `Check if element "${f.element?.selector}" is properly interactive and not blocked by overlays.`,
          category: 'interaction',
        });
      }
    }
  }

  // AI-generated suggestions
  for (const page of (analysis.pages || [])) {
    if (page.devAnalysis?.performanceSummary?.improvements) {
      for (const improvement of page.devAnalysis.performanceSummary.improvements) {
        report.suggestions.push({
          page: page.url,
          type: 'performance',
          suggestion: improvement,
        });
      }
    }
    if (page.devAnalysis?.accessibilitySummary?.criticalFixes) {
      for (const fix of page.devAnalysis.accessibilitySummary.criticalFixes) {
        report.suggestions.push({
          page: page.url,
          type: 'accessibility',
          suggestion: fix,
        });
      }
    }
  }

  // Total issues count
  report.totalIssues =
    report.bugs.length +
    report.consoleErrors.filter((e) => e.severity === 'error').length +
    report.networkFailures.length +
    report.accessibilityViolations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length;

  return report;
}

// ── Helper functions ─────────────────────────────────────────

function generateSummary(scores) {
  const score = scores.overall;
  if (score >= 8.5) return 'This website delivers an excellent user experience with strong design fundamentals and smooth interactions.';
  if (score >= 7.0) return 'The website has a good overall UX with some areas for improvement, particularly in the lower-scoring categories.';
  if (score >= 5.0) return 'The website shows a fair user experience. Several key areas need attention to meet modern UX standards.';
  return 'The website has significant UX issues that likely impact user satisfaction and conversion. Immediate improvements are recommended.';
}

function findAICategory(analysis, key) {
  const aliases = {
    visualDesign: ['visual design', 'visual', 'design'],
    navigation: ['navigation', 'navigation & flow'],
    contentClarity: ['content clarity', 'content'],
    accessibility: ['accessibility'],
    performance: ['performance ux', 'performance'],
    mobileUX: ['mobile responsiveness', 'mobile ux', 'mobile'],
    trustCredibility: ['trust & credibility', 'trust'],
    interactionDesign: ['interaction design', 'interaction'],
  };

  for (const page of (analysis.pages || [])) {
    if (!page.uxAnalysis?.categories) continue;
    for (const cat of page.uxAnalysis.categories) {
      const name = cat.name.toLowerCase().trim();
      if ((aliases[key] || []).includes(name)) {
        return cat;
      }
    }
  }
  return null;
}

function getScoreAssessment(score) {
  if (score >= 9) return 'Exceptional — industry-leading quality.';
  if (score >= 7) return 'Strong — meets modern standards with minor improvements possible.';
  if (score >= 5) return 'Adequate — functional but needs refinement.';
  if (score >= 3) return 'Below average — noticeable issues affecting user experience.';
  return 'Critical — significant problems that need immediate attention.';
}

function getScoreColor(score) {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 6) return '#eab308'; // yellow
  if (score >= 4) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getSeverityColor(severity) {
  switch (severity) {
    case 'high':
    case 'critical': return '#ef4444';
    case 'medium':
    case 'warning': return '#f97316';
    case 'low':
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
}

function getVerdict(score) {
  if (score >= 8.5) return 'Excellent';
  if (score >= 7.0) return 'Good';
  if (score >= 5.0) return 'Fair';
  return 'Poor';
}

module.exports = { formatHumanReport, formatDevReport };
