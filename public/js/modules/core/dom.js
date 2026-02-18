/**
 * Core DOM manipulation utilities with XSS protection
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - HTML-safe string
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize rich text content (from Quill editors) using DOMPurify
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML safe for display
 */
export function sanitizeRichText(html) {
  if (!html) return '';

  // DOMPurify is loaded globally from CDN
  if (typeof DOMPurify === 'undefined') {
    console.error('DOMPurify is not loaded');
    return escapeHtml(html); // Fallback to escaping
  }

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });
  // Quill sometimes emits <ol> for bullet lists — normalise to <ul>
  return clean.replace(/<ol(\s[^>]*)?>/gi, '<ul>').replace(/<\/ol>/gi, '</ul>');
}

/**
 * Create a DOM element safely with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Element attributes (className, style, data-*, event handlers)
 * @param {...(string|Node)} children - Text or element children
 * @returns {HTMLElement} - Created element
 *
 * @example
 * h('div', { className: 'card' },
 *   h('h2', {}, 'Title'),
 *   'Some text',
 *   h('button', { onclick: () => alert('Clicked') }, 'Click me')
 * )
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);

  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      // Event handlers (e.g., onclick, onchange)
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key.startsWith('data-')) {
      // Data attributes
      el.setAttribute(key, value);
    } else {
      // Standard attributes (id, type, value, etc.)
      el.setAttribute(key, value);
    }
  }

  // Append children
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else if (child) {
      // Convert other values to text
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}
