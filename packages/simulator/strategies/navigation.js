/**
 * Navigation Simulation Strategy
 * 
 * Tests navigation elements: menus, breadcrumbs, and
 * evaluates navigation structure and flow quality.
 */

/**
 * @param {import('playwright').Page} page
 * @returns {Array} navigation test results
 */
async function simulateNavigation(page) {
  const results = [];

  // Discover navigation structures
  const navData = await page.evaluate(() => {
    const navInfo = {
      primaryNav: [],
      breadcrumbs: [],
      footer: [],
      menuStructure: null,
    };

    // Primary navigation (nav, header links)
    const navElements = document.querySelectorAll(
      'nav a, header a, [role="navigation"] a, [role="menubar"] a'
    );
    navElements.forEach((a) => {
      const rect = a.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      navInfo.primaryNav.push({
        text: a.textContent.trim().substring(0, 80),
        href: a.href,
        isExternal: a.hostname !== window.location.hostname,
        isActive:
          a.classList.contains('active') ||
          a.getAttribute('aria-current') === 'page' ||
          a.href === window.location.href,
        position: { x: Math.round(rect.x), y: Math.round(rect.y) },
        selector: a.id ? `#${a.id}` : null,
      });
    });

    // Breadcrumbs
    const breadcrumbContainer = document.querySelector(
      '[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs, ol[class*="breadcrumb"]'
    );
    if (breadcrumbContainer) {
      breadcrumbContainer.querySelectorAll('a, span, li').forEach((el) => {
        const text = el.textContent.trim();
        if (text) {
          navInfo.breadcrumbs.push({
            text: text.substring(0, 50),
            href: el.tagName === 'A' ? el.href : null,
          });
        }
      });
    }

    // Footer navigation
    const footer = document.querySelector('footer');
    if (footer) {
      footer.querySelectorAll('a').forEach((a) => {
        navInfo.footer.push({
          text: a.textContent.trim().substring(0, 80),
          href: a.href,
          isExternal: a.hostname !== window.location.hostname,
        });
      });
    }

    // Analyze menu depth (dropdowns / submenus)
    const hasDropdowns = document.querySelectorAll(
      'nav ul ul, nav .dropdown, nav .submenu, [role="menu"]'
    ).length;
    navInfo.menuStructure = {
      hasDropdowns: hasDropdowns > 0,
      dropdownCount: hasDropdowns,
      totalNavItems: navInfo.primaryNav.length,
      footerLinks: navInfo.footer.length,
      hasBreadcrumbs: navInfo.breadcrumbs.length > 0,
    };

    return navInfo;
  });

  // Test navigation items accessibility
  const navAccessibility = await page.evaluate(() => {
    const issues = [];

    // Check nav landmark
    const navElements = document.querySelectorAll('nav');
    if (navElements.length === 0) {
      issues.push({
        type: 'missing-landmark',
        message: 'No <nav> landmark element found. Navigation should be wrapped in <nav>.',
        severity: 'warning',
      });
    }

    // Check for multiple unlabeled navs
    if (navElements.length > 1) {
      const unlabeled = Array.from(navElements).filter(
        (n) => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')
      );
      if (unlabeled.length > 0) {
        issues.push({
          type: 'unlabeled-nav',
          message: `${unlabeled.length} navigation region(s) lack aria-label. Multiple nav elements should be labeled.`,
          severity: 'warning',
        });
      }
    }

    // Check for skip navigation link
    const skipLink = document.querySelector(
      'a[href="#main"], a[href="#content"], a.skip-link, a.skip-nav, a[href="#main-content"]'
    );
    if (!skipLink) {
      issues.push({
        type: 'no-skip-link',
        message: 'No skip-to-content link found. This is important for keyboard navigation.',
        severity: 'info',
      });
    }

    // Check keyboard focus visibility
    const focusableElements = document.querySelectorAll('nav a, nav button');
    const computedStyles = [];
    focusableElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      computedStyles.push({
        hasOutline: style.outlineStyle !== 'none' || style.outlineWidth !== '0px',
      });
    });

    return { issues, focusableCount: focusableElements.length };
  });

  // Test hover states on navigation
  const hoverResults = [];
  for (const navItem of navData.primaryNav.slice(0, 10)) {
    if (!navItem.selector) continue;

    try {
      const element = page.locator(navItem.selector).first();
      await element.hover();
      await page.waitForTimeout(300);

      // Check if hover triggered dropdown or visual change
      const hasDropdown = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const parent = el.closest('li, div');
        if (!parent) return false;
        const submenu = parent.querySelector('ul, .dropdown-menu, .submenu');
        return submenu ? window.getComputedStyle(submenu).display !== 'none' : false;
      }, navItem.selector);

      hoverResults.push({
        text: navItem.text,
        triggeredDropdown: hasDropdown,
      });
    } catch {
      // Element not hoverable — skip
    }
  }

  return {
    primaryNavItems: navData.primaryNav.length,
    footerLinks: navData.footer.length,
    menuStructure: navData.menuStructure,
    breadcrumbs: navData.breadcrumbs,
    accessibilityIssues: navAccessibility.issues,
    hoverResults,
    navData,
  };
}

module.exports = { simulateNavigation };
