/**
 * Screenshot Capture Module
 * 
 * Captures full-page and viewport screenshots in optimized formats.
 * Screenshots are returned as base64 strings for AI analysis.
 */

/**
 * @param {import('playwright').Page} page
 * @returns {object} screenshot data
 */
async function captureScreenshots(page) {
  const screenshots = {};

  // ── Full page screenshot ─────────────────────────────────
  try {
    const fullPageBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });
    screenshots.fullPage = fullPageBuffer.toString('base64');
    screenshots.fullPageSize = fullPageBuffer.length;
  } catch (err) {
    console.error('[Screenshots] Full page capture failed:', err.message);
    screenshots.fullPage = null;
  }

  // ── Viewport screenshot (above the fold) ─────────────────
  try {
    // Scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const viewportBuffer = await page.screenshot({
      fullPage: false,
      type: 'png',
    });
    screenshots.viewport = viewportBuffer.toString('base64');
  } catch (err) {
    console.error('[Screenshots] Viewport capture failed:', err.message);
    screenshots.viewport = null;
  }

  // ── Mobile viewport simulation ───────────────────────────
  try {
    const originalViewport = page.viewportSize();

    // Simulate mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const mobileBuffer = await page.screenshot({
      fullPage: false,
      type: 'png',
    });
    screenshots.mobile = mobileBuffer.toString('base64');

    // Simulate tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    const tabletBuffer = await page.screenshot({
      fullPage: false,
      type: 'png',
    });
    screenshots.tablet = tabletBuffer.toString('base64');

    // Restore original viewport
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
      await page.waitForTimeout(300);
    }
  } catch (err) {
    console.error('[Screenshots] Responsive captures failed:', err.message);
  }

  return screenshots;
}

module.exports = { captureScreenshots };
