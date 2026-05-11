/**
 * UX Auditor — Data Collector
 * 
 * Consolidates all raw data from a page into a structured payload:
 *   - Screenshots (full page + viewport)
 *   - Accessibility scan (axe-core)
 *   - Performance metrics (Web Vitals)
 *   - Console logs
 *   - Network failures
 *   - DOM analysis
 */

const { scanAccessibility } = require('./accessibility');
const { collectPerformanceMetrics } = require('./performance');
const { captureScreenshots } = require('./screenshots');

/**
 * Collect all data from a single page.
 * 
 * @param {import('playwright').Page} page — Playwright page (already navigated)
 * @param {object} pageInfo — crawl metadata for this page
 * @returns {object} collected data
 */
async function collectPageData(page, pageInfo) {
  const data = {
    url: pageInfo.url,
    screenshots: {},
    accessibility: null,
    performance: null,
    console: { errors: [], warnings: [], info: [] },
    network: { failed: [], slow: [] },
    dom: {},
  };

  // ── Console Logs ─────────────────────────────────────────
  // Set up console listener (may already have messages from simulation)
  const consoleLogs = { errors: [], warnings: [], info: [] };
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleLogs.errors.push(text);
    else if (type === 'warning') consoleLogs.warnings.push(text);
    else consoleLogs.info.push(text);
  });

  // Capture uncaught page errors
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // ── Network monitoring ───────────────────────────────────
  const failedRequests = [];
  const slowRequests = [];

  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'Unknown error',
      resourceType: req.resourceType(),
    });
  });

  page.on('response', (res) => {
    const timing = res.request().timing();
    if (timing && timing.responseEnd > 3000) {
      slowRequests.push({
        url: res.url(),
        status: res.status(),
        time: Math.round(timing.responseEnd),
        resourceType: res.request().resourceType(),
      });
    }
  });

  // ── Screenshots ──────────────────────────────────────────
  try {
    data.screenshots = await captureScreenshots(page);
  } catch (err) {
    console.error('[Collector] Screenshot capture failed:', err.message);
  }

  // ── Accessibility ────────────────────────────────────────
  try {
    data.accessibility = await scanAccessibility(page);
  } catch (err) {
    console.error('[Collector] Accessibility scan failed:', err.message);
    data.accessibility = { error: err.message };
  }

  // ── Performance ──────────────────────────────────────────
  try {
    data.performance = await collectPerformanceMetrics(page);
  } catch (err) {
    console.error('[Collector] Performance collection failed:', err.message);
    data.performance = { error: err.message };
  }

  // ── DOM Analysis ─────────────────────────────────────────
  try {
    data.dom = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');

      // Heading hierarchy
      const headings = [];
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        headings.push({
          level: parseInt(h.tagName.charAt(1)),
          text: h.textContent.trim().substring(0, 100),
        });
      });

      // Image audit
      const images = [];
      document.querySelectorAll('img').forEach((img) => {
        images.push({
          src: img.src.substring(0, 200),
          alt: img.getAttribute('alt'),
          hasAlt: img.hasAttribute('alt'),
          altIsEmpty: img.getAttribute('alt') === '',
          width: img.naturalWidth,
          height: img.naturalHeight,
          isDecorative: img.getAttribute('role') === 'presentation',
        });
      });

      // Link audit
      const links = [];
      document.querySelectorAll('a[href]').forEach((a) => {
        links.push({
          text: a.textContent.trim().substring(0, 60),
          href: a.href,
          hasText: a.textContent.trim().length > 0,
          hasAriaLabel: !!a.getAttribute('aria-label'),
          isExternal: a.hostname !== window.location.hostname,
          opensNewTab: a.target === '_blank',
          hasRelNoopener: (a.getAttribute('rel') || '').includes('noopener'),
        });
      });

      // Color and contrast
      const bodyStyle = window.getComputedStyle(document.body);

      return {
        totalElements: allElements.length,
        headings,
        headingHierarchyValid: validateHeadingHierarchy(headings),
        images: {
          total: images.length,
          missingAlt: images.filter((i) => !i.hasAlt).length,
          emptyAlt: images.filter((i) => i.altIsEmpty).length,
          details: images.slice(0, 20), // Limit for payload size
        },
        links: {
          total: links.length,
          noText: links.filter((l) => !l.hasText && !l.hasAriaLabel).length,
          external: links.filter((l) => l.isExternal).length,
          newTab: links.filter((l) => l.opensNewTab).length,
          unsafeNewTab: links.filter((l) => l.opensNewTab && !l.hasRelNoopener).length,
        },
        bodyFontSize: bodyStyle.fontSize,
        bodyFontFamily: bodyStyle.fontFamily,
        bodyColor: bodyStyle.color,
        bodyBackground: bodyStyle.backgroundColor,
        hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
        hasCharsetMeta: !!document.querySelector('meta[charset]'),
        language: document.documentElement.lang || 'not set',
      };

      function validateHeadingHierarchy(hdgs) {
        if (hdgs.length === 0) return { valid: true, issues: [] };
        const issues = [];
        if (hdgs[0]?.level !== 1) {
          issues.push('Page does not start with H1');
        }
        const h1Count = hdgs.filter((h) => h.level === 1).length;
        if (h1Count > 1) {
          issues.push(`Multiple H1 tags found (${h1Count})`);
        }
        for (let i = 1; i < hdgs.length; i++) {
          if (hdgs[i].level - hdgs[i - 1].level > 1) {
            issues.push(`Heading level skipped: H${hdgs[i - 1].level} → H${hdgs[i].level}`);
          }
        }
        return { valid: issues.length === 0, issues };
      }
    });
  } catch (err) {
    console.error('[Collector] DOM analysis failed:', err.message);
    data.dom = { error: err.message };
  }

  // ── Finalize console & network data ──────────────────────
  data.console = {
    errors: [...consoleLogs.errors, ...pageErrors],
    warnings: consoleLogs.warnings,
    info: consoleLogs.info.slice(0, 20), // Limit info logs
  };
  data.network = {
    failed: failedRequests,
    slow: slowRequests,
  };

  return data;
}

module.exports = { collectPageData };
