/**
 * Escape text for safe HTML interpolation in template strings.
 * @param {unknown} value - Value to escape.
 * @returns {string} HTML-safe string.
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
