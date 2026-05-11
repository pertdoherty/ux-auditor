/**
 * URL utility helpers for the crawler.
 */

/**
 * Normalize a URL by removing hash fragments, trailing slashes, and query params for dedup.
 */
function normalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    // Remove hash
    u.hash = '';
    // Remove trailing slash (except for root)
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    u.pathname = path;
    return u.toString();
  } catch {
    return urlStr;
  }
}

/**
 * Check if a URL belongs to the same origin.
 */
function isSameOrigin(urlStr, origin) {
  try {
    const u = new URL(urlStr);
    return u.origin === origin;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is navigable (not a file download, mailto, tel, etc.)
 */
function isNavigableUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    // Skip non-http protocols
    if (!['http:', 'https:'].includes(u.protocol)) {
      return false;
    }
    // Skip common file extensions
    const skipExtensions = [
      '.pdf', '.zip', '.tar', '.gz', '.rar',
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.css', '.js', '.json', '.xml', '.woff', '.woff2', '.ttf', '.eot',
    ];
    const pathname = u.pathname.toLowerCase();
    if (skipExtensions.some((ext) => pathname.endsWith(ext))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = { normalizeUrl, isSameOrigin, isNavigableUrl };
