let root = null;
let maxLen = 100;
const messages = [];

/**
 * Initialize the message log
 */
export function initializeMessageLog(element = document.getElementById('messageLog'), { maxLength = 100 } = {}) {
  root = element;
  if (!root) return;
  maxLen = maxLength;
  root.innerHTML = '';
}

/**
 * Append a message to the log.
 * Accepts either a string or an object: { text, type }
 * Known types: 'info' (default), 'system', 'action', 'combat', 'loot', 'warn', 'error', 'debug', 'level'
 */
export function appendMessage(input) {
  if (!root) return;

  // Normalize input
  let entry;
  if (typeof input === 'string') {
    const text = String(input || '').trim();
    if (text.length === 0) return; // ignore empties used as placeholders
    entry = { text, type: 'info' };
  } else if (input && typeof input === 'object') {
    const hasHtml = typeof input.html === 'string' && input.html.trim().length > 0;
    const text = String(input.text || '').trim();
    if (!hasHtml && text.length === 0) return;
    entry = hasHtml
      ? { html: input.html.trim(), type: sanitizeType(input.type) }
      : { text, type: sanitizeType(input.type) };
  } else {
    return;
  }

  // Store with timestamp
  messages.push({ ...entry, ts: Date.now() });
  if (messages.length > maxLen) messages.shift();

  const atBottom = Math.abs(root.scrollTop + root.clientHeight - root.scrollHeight) < 2;

  // Render with grouping and type classes
  let lastType = null;
  const html = messages.map(m => {
    const isGroupStart = lastType !== null && m.type !== lastType;
    lastType = m.type;
    const classes = [
      'log-line',
      `type-${m.type}`,
      isGroupStart ? 'group-start' : ''
    ].filter(Boolean).join(' ');

    let content;
    if (m.html) {
      // html content is assumed safe/escaped by caller
      content = m.html;
    } else {
      content = m.type === 'level'
        ? `<em>${escapeHtml(m.text)}</em>`
        : escapeHtml(m.text);
    }

    return `<div class="${classes}">${content}</div>`;
  }).join('');

  root.innerHTML = html;
  if (atBottom) root.scrollTop = root.scrollHeight;
}

export function clear() {
  messages.splice(0, messages.length);
  if (root) root.innerHTML = '';
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeType(type) {
  const known = new Set(['info', 'system', 'action', 'combat', 'loot', 'warn', 'error', 'debug', 'level']);
  return known.has(type) ? type : 'info';
}

