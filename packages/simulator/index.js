/**
 * UX Auditor — Human Interaction Simulator
 * 
 * Simulates real human behavior on a web page:
 *   - Discovers all interactive elements
 *   - Clicks buttons and links
 *   - Fills and submits forms
 *   - Scrolls through content
 *   - Tests navigation flows
 *   - Captures before/after states
 */

const { simulateClicks } = require('./strategies/click');
const { simulateScrolling } = require('./strategies/scroll');
const { simulateForms } = require('./strategies/form');
const { simulateNavigation } = require('./strategies/navigation');

/**
 * Run full human simulation on a page.
 * 
 * @param {import('playwright').Page} page — Playwright page (already navigated)
 * @param {object} options
 * @returns {object} simulation results
 */
async function simulateUser(page, options = {}) {
  const {
    clickDelay = { min: 500, max: 1500 },
    scrollDelay = { min: 300, max: 800 },
    maxInteractions = 50,
  } = options;

  const results = {
    interactions: [],
    scrollMap: null,
    forms: [],
    navigation: [],
    summary: {},
  };

  try {
    // ── Step 1: Discover all interactive elements ──────────
    const elements = await discoverInteractiveElements(page);

    // ── Step 2: Scroll through page (captures viewport map) ─
    results.scrollMap = await simulateScrolling(page, { delay: scrollDelay });

    // ── Step 3: Click interactive elements ──────────────────
    const clickResults = await simulateClicks(page, elements, {
      delay: clickDelay,
      maxClicks: maxInteractions,
    });
    results.interactions.push(...clickResults);

    // ── Step 4: Fill and submit forms ───────────────────────
    results.forms = await simulateForms(page);

    // ── Step 5: Test navigation elements ────────────────────
    results.navigation = await simulateNavigation(page);

    // ── Summary ────────────────────────────────────────────
    results.summary = {
      totalElements: elements.length,
      totalInteractions: results.interactions.length,
      successfulClicks: results.interactions.filter((i) => i.status === 'success').length,
      failedClicks: results.interactions.filter((i) => i.status === 'fail').length,
      formsFound: results.forms.length,
      navItemsTested: results.navigation.length,
      scrollDepth: results.scrollMap ? results.scrollMap.scrollDepthPercent : 0,
    };
  } catch (err) {
    console.error('[Simulator] Error during simulation:', err.message);
    results.error = err.message;
  }

  return results;
}

/**
 * Discover all interactive elements on the page.
 */
async function discoverInteractiveElements(page) {
  return page.evaluate(() => {
    const selectors = [
      'button',
      'a[href]',
      'input[type="submit"]',
      'input[type="button"]',
      '[role="button"]',
      '[onclick]',
      '[tabindex="0"]',
      'select',
      'details > summary',
    ];

    const elements = [];
    const seen = new Set();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        // Skip hidden, disabled, or duplicate elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;

        const id = `${el.tagName}-${el.textContent.trim().substring(0, 30)}-${Math.round(rect.x)}-${Math.round(rect.y)}`;
        if (seen.has(id)) return;
        seen.add(id);

        elements.push({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          text: el.textContent.trim().substring(0, 100),
          ariaLabel: el.getAttribute('aria-label') || '',
          href: el.getAttribute('href') || '',
          selector: generateSelector(el),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          isVisible: rect.top < window.innerHeight && rect.bottom > 0,
        });
      });
    }

    return elements;

    function generateSelector(el) {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.split(' ').filter(Boolean)[0];
        if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
      }
      // Fall back to nth-child
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      const idx = siblings.indexOf(el) + 1;
      return `${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
    }
  });
}

module.exports = { simulateUser };