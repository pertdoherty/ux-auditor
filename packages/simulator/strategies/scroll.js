/**
 * Scroll Simulation Strategy
 * 
 * Simulates human scrolling behavior and captures viewport
 * snapshots at intervals for heatmap generation.
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} options
 * @returns {object} scroll map data
 */
async function simulateScrolling(page, options = {}) {
  const { delay = { min: 300, max: 800 } } = options;

  const dimensions = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    totalHeight: document.documentElement.scrollHeight,
    totalWidth: document.documentElement.scrollWidth,
  }));

  const scrollStops = [];
  const scrollIncrement = Math.round(dimensions.viewportHeight * 0.7); // 70% viewport per scroll
  let currentScroll = 0;

  // Scroll down in increments, capturing each viewport
  while (currentScroll < dimensions.totalHeight) {
    // Smooth scroll to position
    await page.evaluate((y) => {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, currentScroll);

    // Wait for smooth scroll to finish + human pause
    await randomDelay(delay.min, delay.max);

    // Record visible content region
    const viewportInfo = await page.evaluate(() => ({
      scrollTop: window.scrollY,
      visibleElements: (() => {
        const visible = [];
        const elements = document.querySelectorAll(
          'h1, h2, h3, p, img, button, a, input, form, video, [role="banner"], [role="main"], [role="navigation"]'
        );
        elements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0) {
            visible.push({
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().substring(0, 60),
              position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            });
          }
        });
        return visible;
      })(),
    }));

    scrollStops.push({
      scrollPosition: currentScroll,
      viewportElements: viewportInfo.visibleElements,
    });

    currentScroll += scrollIncrement;
  }

  // Scroll back to top (natural behavior)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await randomDelay(300, 500);

  return {
    totalHeight: dimensions.totalHeight,
    viewportHeight: dimensions.viewportHeight,
    viewportWidth: dimensions.viewportWidth,
    scrollStops,
    totalScrollStops: scrollStops.length,
    scrollDepthPercent: 100, // We scrolled through the entire page
  };
}

function randomDelay(min, max) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}

module.exports = { simulateScrolling };
