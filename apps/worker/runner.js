/**
 * UX Auditor — Audit Runner
 * 
 * Orchestrates the full audit pipeline for a single URL:
 *   1. Crawl — discover all pages
 *   2. Simulate — human-like interaction on each page
 *   3. Collect — gather accessibility, performance, screenshots
 *   4. Analyze — AI-driven UX evaluation via GPT-4o Vision
 *   5. Report — generate structured human + dev reports
 */

const { chromium } = require('playwright');
const { crawlSite } = require('../../packages/crawler');
const { simulateUser } = require('../../packages/simulator');
const { collectPageData } = require('../../packages/collector');
const { analyzeUX } = require('../../packages/analyzer');
const { generateReport } = require('../../packages/reporter');

async function runAudit(url, onProgress) {
  let browser;

  try {
    // ── Launch browser ──────────────────────────────────────
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // ── Phase 1: Crawl ──────────────────────────────────────
    await onProgress('Crawling site', 5);
    const crawlResult = await crawlSite(context, url, {
      maxPages: parseInt(process.env.MAX_PAGES || '20', 10),
      maxDepth: parseInt(process.env.MAX_DEPTH || '3', 10),
      timeout: parseInt(process.env.CRAWL_TIMEOUT || '30000', 10),
    });
    await onProgress('Crawl complete', 20);

    // ── Phase 2 + 3: Simulate & Collect per page ────────────
    const pageResults = [];
    const totalPages = crawlResult.pages.length;

    for (let i = 0; i < totalPages; i++) {
      const pageInfo = crawlResult.pages[i];
      const page = await context.newPage();

      try {
        await page.goto(pageInfo.url, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        // Simulate human interactions
        await onProgress(`Simulating interactions on page ${i + 1}/${totalPages}`, 20 + Math.round((i / totalPages) * 30));
        const simulationResult = await simulateUser(page);

        // Collect all data (screenshots, accessibility, performance, etc.)
        await onProgress(`Collecting data from page ${i + 1}/${totalPages}`, 50 + Math.round((i / totalPages) * 15));
        const collectedData = await collectPageData(page, pageInfo);

        pageResults.push({
          url: pageInfo.url,
          title: pageInfo.title,
          depth: pageInfo.depth,
          simulation: simulationResult,
          data: collectedData,
        });
      } catch (err) {
        console.error(`[Runner] Error processing ${pageInfo.url}:`, err.message);
        pageResults.push({
          url: pageInfo.url,
          title: pageInfo.title,
          depth: pageInfo.depth,
          error: err.message,
        });
      } finally {
        await page.close();
      }
    }

    // ── Phase 4: AI Analysis ────────────────────────────────
    await onProgress('Running AI analysis', 70);
    const analysis = await analyzeUX(pageResults);
    await onProgress('AI analysis complete', 85);

    // ── Phase 5: Generate Report ────────────────────────────
    await onProgress('Generating report', 90);
    const report = await generateReport(analysis, pageResults, {
      entryUrl: url,
      pagesScanned: totalPages,
    });
    await onProgress('Complete', 100);

    return report;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { runAudit };