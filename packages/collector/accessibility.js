/**
 * Accessibility Scanner — axe-core integration
 * 
 * Runs WCAG 2.1 AA compliance checks via @axe-core/playwright.
 * Falls back to manual checks if axe-core is not available.
 */

let AxeBuilder;
try {
  AxeBuilder = require('@axe-core/playwright').default;
} catch {
  AxeBuilder = null;
  console.warn('[A11y] @axe-core/playwright not installed — using basic checks only.');
}

/**
 * @param {import('playwright').Page} page
 * @returns {object} accessibility scan results
 */
async function scanAccessibility(page) {
  const results = {
    violations: [],
    passes: 0,
    incomplete: [],
    score: 100,
    summary: {},
  };

  // ── axe-core scan ────────────────────────────────────────
  if (AxeBuilder) {
    try {
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      results.violations = axeResults.violations.map((v) => ({
        id: v.id,
        impact: v.impact,        // 'critical' | 'serious' | 'moderate' | 'minor'
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        tags: v.tags,
        nodes: v.nodes.slice(0, 5).map((n) => ({
          html: n.html.substring(0, 200),
          target: n.target,
          failureSummary: n.failureSummary,
        })),
      }));

      results.passes = axeResults.passes.length;
      results.incomplete = axeResults.incomplete.map((i) => ({
        id: i.id,
        description: i.description,
        help: i.help,
      }));
    } catch (err) {
      console.error('[A11y] axe-core scan error:', err.message);
    }
  }

  // ── Manual checks (supplement axe-core) ──────────────────
  const manualChecks = await page.evaluate(() => {
    const issues = [];

    // Check for lang attribute
    if (!document.documentElement.lang) {
      issues.push({
        id: 'html-has-lang',
        impact: 'serious',
        description: 'The <html> element does not have a lang attribute.',
        help: 'Add a lang attribute (e.g., lang="en") to the <html> element.',
        source: 'manual',
      });
    }

    // Check color contrast (basic)
    const textElements = document.querySelectorAll('p, span, li, td, th, label, a');
    let lowContrastCount = 0;
    textElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bg = style.backgroundColor;
      // Simple check: if text color equals background color
      if (color === bg && color !== 'rgba(0, 0, 0, 0)') {
        lowContrastCount++;
      }
    });
    if (lowContrastCount > 0) {
      issues.push({
        id: 'color-contrast-basic',
        impact: 'serious',
        description: `${lowContrastCount} element(s) may have color contrast issues.`,
        help: 'Ensure text has sufficient contrast against its background (4.5:1 ratio for normal text).',
        source: 'manual',
      });
    }

    // Check for focus indicators
    const focusable = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
    let noFocusIndicator = 0;
    focusable.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.outlineStyle === 'none' && style.outlineWidth === '0px') {
        noFocusIndicator++;
      }
    });
    if (noFocusIndicator > focusable.length * 0.5) {
      issues.push({
        id: 'focus-indicator',
        impact: 'moderate',
        description: 'Many focusable elements may lack visible focus indicators.',
        help: 'Ensure all interactive elements have visible focus states for keyboard navigation.',
        source: 'manual',
      });
    }

    // Check for touch target sizes (mobile a11y)
    const clickable = document.querySelectorAll('a, button, input, select');
    let smallTargets = 0;
    clickable.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        smallTargets++;
      }
    });
    if (smallTargets > 0) {
      issues.push({
        id: 'touch-target-size',
        impact: 'moderate',
        description: `${smallTargets} interactive element(s) are smaller than 44x44px.`,
        help: 'Touch targets should be at least 44x44px for mobile accessibility (WCAG 2.5.5).',
        source: 'manual',
      });
    }

    return issues;
  });

  // Merge manual checks into violations
  results.violations.push(...manualChecks.map((check) => ({
    ...check,
    nodes: [],
    helpUrl: '',
    tags: ['manual-check'],
  })));

  // ── Calculate score ──────────────────────────────────────
  results.score = calculateA11yScore(results);
  results.summary = {
    totalViolations: results.violations.length,
    critical: results.violations.filter((v) => v.impact === 'critical').length,
    serious: results.violations.filter((v) => v.impact === 'serious').length,
    moderate: results.violations.filter((v) => v.impact === 'moderate').length,
    minor: results.violations.filter((v) => v.impact === 'minor').length,
    passes: results.passes,
  };

  return results;
}

/**
 * Calculate accessibility score (0-100).
 */
function calculateA11yScore(results) {
  const weights = { critical: 25, serious: 15, moderate: 8, minor: 3 };
  let deductions = 0;

  for (const violation of results.violations) {
    deductions += weights[violation.impact] || 5;
  }

  return Math.max(0, Math.min(100, 100 - deductions));
}

module.exports = { scanAccessibility };
