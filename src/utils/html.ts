/**
 * HTML escaping and unescaping utilities
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '\u00A0': '&nbsp;',
};

const HTML_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&nbsp;': '\u00A0',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

/**
 * Escape HTML special characters
 */
export function escapeHTML(input: string): string {
  return input.replace(/[&<\u00A0]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Unescape HTML entities
 */
export function unescapeHTML(input: string): string {
  return input.replace(
    /&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g,
    (entity) => HTML_UNESCAPE_MAP[entity] || entity
  );
}

/**
 * Remove HTML tags from a string
 */
export function stripHTMLTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Parse HTML-like color tags (e.g., <font color="red">)
 */
export function parseHTMLColor(tag: string): string | null {
  const match = tag.match(/color\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : null;
}
