let sanitizeHtml = null;
try {
  sanitizeHtml = require('sanitize-html');
} catch {
  sanitizeHtml = null;
}

function sanitizeRichHtml(input) {
  if (typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  if (!sanitizeHtml) {
    return raw.replace(/<[^>]*>/g, '');
  }

  return sanitizeHtml(raw, {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'blockquote',
      'ul', 'ol', 'li',
      'a', 'img',
      'code', 'pre',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      '*': ['style', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
    allowedStyles: {
      '*': {
        color: [/^#([0-9a-f]{3}){1,2}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*(0|1|0?\.\d+))?\s*\)$/],
        'background-color': [/^#([0-9a-f]{3}){1,2}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*(0|1|0?\.\d+))?\s*\)$/],
        'text-align': [/^(left|right|center|justify)$/],
        'text-decoration': [/^(none|underline|line-through)$/],
      },
    },
  });
}

module.exports = {
  sanitizeRichHtml,
};
