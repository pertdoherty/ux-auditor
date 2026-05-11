/**
 * UX Auditor — Site Crawler
 * 
 * Discovers all reachable pages from an entry URL.
 * Extracts links, metadata, and builds a complete site map.
 */

const { normalizeUrl, isSameOrigin, isNavigableUrl } = require('./utils');

/**
 * Crawl a website starting from the entry URL.
 * 
 * @param {import('playwright').BrowserContext} context — Playwright browser context
 * @param {string} entryUrl — Starting URL
 * @param {object} options
 * @param {number} options.maxPages — Max pages to crawl (default: 20)
 * @param {number} options.maxDepth — Max link depth (default: 3)
 * @param {number} options.timeout — Navigation timeout ms (default: 30000)
 * @returns {{ pages: Array, sitemap: Array }}
 */
async function crawlSite(context, entryUrl, options = {}) {
  const {
    maxPages = 20,
    maxDepth = 3,
    timeout = 30000,
  } = options;

  const visited = new Set();
  const pages = [];
  const queue = [{ url: normalizeUrl(entryUrl), depth: 0 }];
  const origin = new URL(entryUrl).origin;

  while (queue.length > 0 && pages.length < maxPages) {
    const { url, depth } = queue.shift();

    // Skip if already visited or exceeds depth
    const normalized = normalizeUrl(url);
    if (visited.has(normalized) || depth > maxDepth) {
      continue;
    }
    visited.add(normalized);

    const page = await context.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      const statusCode = response ? response.status() : 0;

      // Skip non-HTML responses
      const contentType = response ? response.headers()['content-type'] || '' : '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        continue;
      }

      // Extract page metadata
      const pageData = await page.evaluate(() => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]');
        const description = metaDesc ? metaDesc.getAttribute('content') || '' : '';
        const h1 = document.querySelector('h1');
        const heading = h1 ? h1.textContent.trim() : '';

        // Collect all internal links
        const links = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (href) {
            links.push({
              href,
              text: a.textContent.trim().substring(0, 100),
              resolved: a.href, // browser-resolved absolute URL
            });
          }
        });

        // Count interactive elements
        const interactiveCount = {
          buttons: document.querySelectorAll('button, [role="button"], input[type="submit"]').length,
          links: document.querySelectorAll('a[href]').length,
          inputs: document.querySelectorAll('input, textarea, select').length,
          forms: document.querySelectorAll('form').length,
        };

        return { title, description, heading, links, interactiveCount };
      });

      // Measure load time
      const perfTiming = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return nav ? {
          loadTime: Math.round(nav.loadEventEnd - nav.startTime),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          responseTime: Math.round(nav.responseEnd - nav.requestStart),
        } : null;
      });

      const pageInfo = {
        url: normalized,
        title: pageData.title,
        description: pageData.description,
        heading: pageData.heading,
        statusCode,
        depth,
        timing: perfTiming,
        interactiveCount: pageData.interactiveCount,
        linkCount: pageData.links.length,
      };

      pages.push(pageInfo);

      // Queue discovered internal links
      if (depth < maxDepth) {
        for (const link of pageData.links) {
          const resolvedUrl = link.resolved;
          if (
            resolvedUrl &&
            isSameOrigin(resolvedUrl, origin) &&
            isNavigableUrl(resolvedUrl) &&
            !visited.has(normalizeUrl(resolvedUrl))
          ) {
            queue.push({ url: resolvedUrl, depth: depth + 1 });
          }
        }
      }

      console.log(`[Crawler] ✓ ${normalized} (depth: ${depth}, status: ${statusCode})`);
    } catch (err) {
      console.error(`[Crawler] ✗ Failed to crawl ${url}:`, err.message);
      pages.push({
        url: normalized,
        title: '',
        description: '',
        heading: '',
        statusCode: 0,
        depth,
        timing: null,
        interactiveCount: { buttons: 0, links: 0, inputs: 0, forms: 0 },
        linkCount: 0,
        error: err.message,
      });
    } finally {
      await page.close();
    }
  }

  // Build sitemap
  const sitemap = pages.map((p) => ({
    url: p.url,
    title: p.title,
    status: p.statusCode,
    depth: p.depth,
  }));

  console.log(`[Crawler] Crawl complete: ${pages.length} pages discovered.`);

  return { pages, sitemap };
}

module.exports = { crawlSite };
