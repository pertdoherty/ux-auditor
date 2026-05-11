async function simulateUser(page) {
  const actions = [];

  const buttons = await page.$$('button');

  for (const btn of buttons) {
    try {
      await page.waitForTimeout(800);
      await btn.click({ delay: 100 });

      actions.push({ type: 'click', status: 'success' });
    } catch {
      actions.push({ type: 'click', status: 'fail' });
    }
  }

  return actions;
}

module.exports = { simulateUser };
``