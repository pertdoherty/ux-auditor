const { chromium } = require('playwright');
const axios = require('axios');

async function runAudit(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const logs = [];

  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push(err.message));

  await page.goto(url, { waitUntil: 'networkidle' });

  // screenshot
  const buffer = await page.screenshot({ fullPage: true });
  const screenshot = buffer.toString('base64');

  // buttons
  const buttons = await page.$$('button');
  const actions = [];

  for (let i = 0; i < buttons.length; i++) {
    try {
      await buttons[i].click();
      await page.waitForTimeout(1000);

      actions.push({ index: i, status: 'success' });
    } catch {
      actions.push({ index: i, status: 'fail' });
    }
  }

  await browser.close();

  // send to n8n
  const result = await axios.post(
    'https://your-n8n-url/webhook/ux-analysis',
    {
      screenshot,
      logs,
      actions,
      url
    }
  );

  return result.data;
}

module.exports = { runAudit };
``