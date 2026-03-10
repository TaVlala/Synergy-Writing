export const APP_COLORS = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#14b8a6'  // Teal
];

/**
 * Returns a stable color from the palette for a given ID.
 */
export function getAuthorColor(authorId) {
  if (!authorId) return APP_COLORS[0];
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = ((hash << 5) - hash) + authorId.charCodeAt(i);
    hash = hash & hash;
  }
  return APP_COLORS[Math.abs(hash) % APP_COLORS.length];
}

/**
 * Formats a timestamp into a human-readable relative time.
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Safely strips HTML tags from a string.
 */
export function stripHTML(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

/**
 * Sanitizes rich HTML content for safe rendering.
 * This is a small allowlist sanitizer (defense-in-depth).
 */
export function sanitizeRichHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');

  const allowedTags = new Set([
    'P','BR','DIV','SPAN',
    'STRONG','B','EM','I','U','S',
    'H1','H2','H3','BLOCKQUOTE',
    'UL','OL','LI',
    'A','IMG',
    'CODE','PRE'
  ]);

  const isSafeUrl = (url) => {
    try {
      const u = new URL(url, window.location.origin);
      return ['http:','https:','mailto:'].includes(u.protocol);
    } catch {
      return false;
    }
  };

  const cleanStyle = (styleText) => {
    if (!styleText) return '';
    const parts = String(styleText).split(';').map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();

      if (!['color','background-color','text-align','text-decoration'].includes(prop)) continue;
      if (prop === 'text-align' && !/^(left|right|center|justify)$/i.test(value)) continue;
      if (prop === 'text-decoration' && !/^(none|underline|line-through)$/i.test(value)) continue;
      if ((prop === 'color' || prop === 'background-color') && !(/^#([0-9a-f]{3}){1,2}$/i.test(value) || /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*(0|1|0?\.\d+))?\s*\)$/.test(value))) continue;

      out.push(${prop}: );
    }
    return out.join('; ');
  };

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {HTMLElement} */ (child);
        const tag = el.tagName;

        if (!allowedTags.has(tag)) {
          // Replace disallowed element with its text content.
          const text = doc.createTextNode(el.textContent || '');
          el.replaceWith(text);
          continue;
        }

        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (tag === 'A' && ['href','target','rel','style','class'].includes(name)) continue;
          if (tag === 'IMG' && ['src','alt','title','style','class'].includes(name)) continue;
          if (['style','class'].includes(name)) continue;
          el.removeAttribute(attr.name);
        }

        if (tag === 'A') {
          const href = el.getAttribute('href');
          if (!href || !isSafeUrl(href)) {
            el.removeAttribute('href');
          }
          el.setAttribute('rel', 'noopener noreferrer');
        }

        if (tag === 'IMG') {
          const src = el.getAttribute('src');
          if (!src || !isSafeUrl(src)) {
            el.remove();
            continue;
          }
        }

        if (el.hasAttribute('style')) {
          const cleaned = cleanStyle(el.getAttribute('style'));
          if (cleaned) el.setAttribute('style', cleaned);
          else el.removeAttribute('style');
        }

        walk(el);
      }
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

