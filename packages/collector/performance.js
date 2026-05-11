/**
 * Performance Metrics Collector
 * 
 * Extracts Web Vitals and other performance data via
 * Playwright's CDP session and the Performance API.
 */

/**
 * @param {import('playwright').Page} page
 * @returns {object} performance metrics
 */
async function collectPerformanceMetrics(page) {
  const metrics = {
    webVitals: {},
    resources: {},
    timing: {},
    score: 0,
  };

  // ── Navigation Timing ────────────────────────────────────
  metrics.timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;

    return {
      // DNS + connection
      dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      tcpConnect: Math.round(nav.connectEnd - nav.connectStart),
      tlsHandshake: Math.round(nav.secureConnectionStart > 0
        ? nav.connectEnd - nav.secureConnectionStart
        : 0),

      // Server response
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      serverResponse: Math.round(nav.responseEnd - nav.responseStart),

      // Page load
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      domInteractive: Math.round(nav.domInteractive - nav.startTime),
      loadComplete: Math.round(nav.loadEventEnd - nav.startTime),

      // Transfer
      transferSize: nav.transferSize || 0,
      encodedBodySize: nav.encodedBodySize || 0,
      decodedBodySize: nav.decodedBodySize || 0,
    };
  });

  // ── Web Vitals via Performance Observer ──────────────────
  metrics.webVitals = await page.evaluate(() => {
    const vitals = {
      fcp: null,  // First Contentful Paint
      lcp: null,  // Largest Contentful Paint
      cls: 0,     // Cumulative Layout Shift
      tbt: 0,     // Total Blocking Time (approximation)
    };

    // FCP
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
    if (fcpEntry) vitals.fcp = Math.round(fcpEntry.startTime);

    // LCP — get the last entry from largest-contentful-paint
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      vitals.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
    }

    // CLS — sum of layout shift scores
    const clsEntries = performance.getEntriesByType('layout-shift');
    vitals.cls = clsEntries.reduce((sum, entry) => {
      if (!entry.hadRecentInput) {
        return sum + entry.value;
      }
      return sum;
    }, 0);
    vitals.cls = Math.round(vitals.cls * 1000) / 1000;

    // TBT approximation from long tasks
    const longTasks = performance.getEntriesByType('longtask');
    vitals.tbt = longTasks.reduce((sum, task) => {
      const blockingTime = task.duration - 50; // anything over 50ms is blocking
      return sum + Math.max(0, blockingTime);
    }, 0);
    vitals.tbt = Math.round(vitals.tbt);

    return vitals;
  });

  // ── Resource Analysis ────────────────────────────────────
  metrics.resources = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');

    const byType = {};
    let totalSize = 0;
    let totalCount = 0;
    const slowResources = [];

    resources.forEach((r) => {
      const type = r.initiatorType || 'other';
      if (!byType[type]) {
        byType[type] = { count: 0, totalSize: 0, avgDuration: 0 };
      }
      byType[type].count++;
      byType[type].totalSize += r.transferSize || 0;

      totalSize += r.transferSize || 0;
      totalCount++;

      // Flag slow resources (>2s)
      if (r.duration > 2000) {
        slowResources.push({
          url: r.name.substring(0, 200),
          type,
          duration: Math.round(r.duration),
          size: r.transferSize || 0,
        });
      }
    });

    // Calculate averages
    Object.keys(byType).forEach((type) => {
      const typeResources = resources.filter((r) => (r.initiatorType || 'other') === type);
      byType[type].avgDuration = Math.round(
        typeResources.reduce((sum, r) => sum + r.duration, 0) / typeResources.length
      );
    });

    return {
      totalResources: totalCount,
      totalTransferSize: totalSize,
      totalTransferSizeFormatted: formatBytes(totalSize),
      byType,
      slowResources,
    };

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
  });

  // ── Performance Score ────────────────────────────────────
  metrics.score = calculatePerformanceScore(metrics.webVitals, metrics.timing);

  return metrics;
}

/**
 * Calculate a 0-100 performance score based on Web Vitals thresholds.
 * Based on Lighthouse scoring: https://web.dev/performance-scoring/
 */
function calculatePerformanceScore(vitals, timing) {
  let score = 100;

  // FCP scoring (Good: <1.8s, Needs improvement: <3s, Poor: >3s)
  if (vitals.fcp) {
    if (vitals.fcp > 3000) score -= 25;
    else if (vitals.fcp > 1800) score -= 10;
  }

  // LCP scoring (Good: <2.5s, Needs improvement: <4s, Poor: >4s)
  if (vitals.lcp) {
    if (vitals.lcp > 4000) score -= 30;
    else if (vitals.lcp > 2500) score -= 15;
  }

  // CLS scoring (Good: <0.1, Needs improvement: <0.25, Poor: >0.25)
  if (vitals.cls > 0.25) score -= 25;
  else if (vitals.cls > 0.1) score -= 10;

  // TBT scoring (Good: <200ms, Needs improvement: <600ms, Poor: >600ms)
  if (vitals.tbt > 600) score -= 20;
  else if (vitals.tbt > 200) score -= 10;

  // TTFB (Good: <800ms, Poor: >1800ms)
  if (timing?.ttfb) {
    if (timing.ttfb > 1800) score -= 15;
    else if (timing.ttfb > 800) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

module.exports = { collectPerformanceMetrics };
