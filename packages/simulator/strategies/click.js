/**
 * Click Simulation Strategy
 * 
 * Clicks interactive elements with human-like delays and captures
 * the before/after state of each interaction.
 */

/**
 * @param {import('playwright').Page} page
 * @param {Array} elements — discovered interactive elements
 * @param {object} options
 * @returns {Array} click results
 */
async function simulateClicks(page, elements, options = {}) {
  const {
    delay = { min: 500, max: 1500 },
    maxClicks = 50,
  } = options;

  const results = [];
  const clickableElements = elements.filter((el) =>
    ['button', 'a', 'input', 'summary'].includes(el.tag) ||
    el.type === 'submit' ||
    el.type === 'button'
  );

  // Limit to maxClicks
  const toClick = clickableElements.slice(0, maxClicks);

  for (const element of toClick) {
    const result = {
      element: {
        tag: element.tag,
        text: element.text,
        selector: element.selector,
        position: element.rect,
      },
      type: 'click',
      status: 'pending',
      timeTaken: 0,
      domChanged: false,
      navigated: false,
      errorTriggered: false,
      consoleOutput: [],
    };

    try {
      // Capture DOM state before click
      const domBefore = await page.evaluate(() => document.body.innerHTML.length);
      const urlBefore = page.url();

      // Listen for console messages during this click
      const consoleMessages = [];
      const consoleHandler = (msg) => {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      };
      page.on('console', consoleHandler);

      // Listen for page errors
      let pageError = null;
      const errorHandler = (err) => { pageError = err; };
      page.on('pageerror', errorHandler);

      // Human-like delay before clicking
      await randomDelay(delay.min, delay.max);

      // Attempt click
      const startTime = Date.now();
      try {
        const locator = page.locator(element.selector).first();
        await locator.click({
          delay: randomInt(50, 150),   // human-like press duration
          timeout: 5000,
          force: false,
          noWaitAfter: false,
        });
      } catch (clickErr) {
        // If standard click fails, try force click
        try {
          const locator = page.locator(element.selector).first();
          await locator.click({ force: true, timeout: 3000 });
        } catch {
          result.status = 'fail';
          result.error = clickErr.message;
          results.push(result);
          page.off('console', consoleHandler);
          page.off('pageerror', errorHandler);
          continue;
        }
      }

      // Wait for potential reactions
      await page.waitForTimeout(800);

      result.timeTaken = Date.now() - startTime;

      // Check DOM changes
      const domAfter = await page.evaluate(() => document.body.innerHTML.length);
      result.domChanged = Math.abs(domAfter - domBefore) > 10;

      // Check navigation
      const urlAfter = page.url();
      result.navigated = urlAfter !== urlBefore;

      // Check for page errors
      result.errorTriggered = pageError !== null;
      if (pageError) {
        result.pageError = pageError.message;
      }

      // Capture console output
      result.consoleOutput = consoleMessages;
      result.status = 'success';

      // If navigated away, go back for further testing
      if (result.navigated) {
        try {
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch {
          // Can't go back — stop testing this page
          break;
        }
      }

      // Clean up listeners
      page.off('console', consoleHandler);
      page.off('pageerror', errorHandler);
    } catch (err) {
      result.status = 'fail';
      result.error = err.message;
    }

    results.push(result);
  }

  return results;
}

function randomDelay(min, max) {
  return new Promise((resolve) => setTimeout(resolve, randomInt(min, max)));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { simulateClicks };
