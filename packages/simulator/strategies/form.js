/**
 * Form Simulation Strategy
 * 
 * Discovers forms on the page, fills them with test data,
 * and attempts submission to test form flows.
 */

// Test data for different input types
const TEST_DATA = {
  email: 'ux.tester@example.com',
  password: 'TestPass123!',
  text: 'UX Audit Test Input',
  name: 'UX Tester',
  tel: '+60123456789',
  url: 'https://example.com',
  search: 'test search query',
  number: '42',
  date: '2026-01-15',
};

/**
 * @param {import('playwright').Page} page
 * @returns {Array} form interaction results
 */
async function simulateForms(page) {
  const results = [];

  // Discover all forms
  const forms = await page.evaluate(() => {
    const formElements = document.querySelectorAll('form');
    return Array.from(formElements).map((form, index) => {
      const fields = [];
      form.querySelectorAll('input, textarea, select').forEach((field) => {
        const rect = field.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        fields.push({
          tag: field.tagName.toLowerCase(),
          type: field.getAttribute('type') || 'text',
          name: field.getAttribute('name') || '',
          placeholder: field.getAttribute('placeholder') || '',
          required: field.hasAttribute('required'),
          ariaLabel: field.getAttribute('aria-label') || '',
          selector: field.id
            ? `#${field.id}`
            : field.name
            ? `[name="${field.name}"]`
            : `form:nth-of-type(${index + 1}) ${field.tagName.toLowerCase()}:nth-of-type(${
                Array.from(form.querySelectorAll(field.tagName)).indexOf(field) + 1
              })`,
        });
      });

      const submitBtn = form.querySelector(
        'button[type="submit"], input[type="submit"], button:not([type])'
      );

      return {
        index,
        action: form.getAttribute('action') || '',
        method: form.getAttribute('method') || 'GET',
        fieldCount: fields.length,
        fields,
        hasSubmitButton: !!submitBtn,
        submitSelector: submitBtn
          ? submitBtn.id
            ? `#${submitBtn.id}`
            : `form:nth-of-type(${index + 1}) button`
          : null,
      };
    });
  });

  for (const form of forms) {
    const formResult = {
      formIndex: form.index,
      action: form.action,
      method: form.method,
      fieldCount: form.fieldCount,
      fields: [],
      submitted: false,
      submitResult: null,
    };

    // Fill each field
    for (const field of form.fields) {
      const fieldResult = {
        name: field.name || field.placeholder || field.type,
        type: field.type,
        status: 'pending',
      };

      try {
        if (field.tag === 'select') {
          // Select first non-empty option
          const options = await page.locator(`${field.selector} option`).all();
          if (options.length > 1) {
            await page.locator(field.selector).selectOption({ index: 1 });
            fieldResult.status = 'filled';
          }
        } else if (field.tag === 'textarea') {
          await page.locator(field.selector).first().fill('This is a UX audit test comment. Testing textarea functionality.');
          fieldResult.status = 'filled';
        } else {
          // Input fields — use appropriate test data
          const value = getTestValue(field.type, field.name);
          await page.locator(field.selector).first().fill(value);
          fieldResult.status = 'filled';
          fieldResult.value = value;
        }

        // Human-like pause between fields
        await randomDelay(200, 500);
      } catch (err) {
        fieldResult.status = 'fail';
        fieldResult.error = err.message;
      }

      formResult.fields.push(fieldResult);
    }

    // Don't actually submit forms (could cause unintended side effects)
    // But record if submit button exists and is clickable
    if (form.hasSubmitButton) {
      try {
        const submitBtn = page.locator(form.submitSelector).first();
        const isEnabled = await submitBtn.isEnabled();
        const isVisible = await submitBtn.isVisible();
        formResult.submitResult = {
          buttonExists: true,
          isEnabled,
          isVisible,
          note: 'Form not submitted to avoid side effects — submit button state captured.',
        };
      } catch {
        formResult.submitResult = {
          buttonExists: true,
          isEnabled: false,
          isVisible: false,
          note: 'Submit button found but could not be evaluated.',
        };
      }
    }

    formResult.submitted = false; // Safety: we don't submit
    results.push(formResult);
  }

  return results;
}

function getTestValue(type, name) {
  const nameLower = (name || '').toLowerCase();

  if (nameLower.includes('email') || type === 'email') return TEST_DATA.email;
  if (nameLower.includes('password') || type === 'password') return TEST_DATA.password;
  if (nameLower.includes('phone') || nameLower.includes('tel') || type === 'tel') return TEST_DATA.tel;
  if (nameLower.includes('name')) return TEST_DATA.name;
  if (nameLower.includes('url') || type === 'url') return TEST_DATA.url;
  if (nameLower.includes('search') || type === 'search') return TEST_DATA.search;
  if (type === 'number') return TEST_DATA.number;
  if (type === 'date') return TEST_DATA.date;

  return TEST_DATA.text;
}

function randomDelay(min, max) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}

module.exports = { simulateForms };
