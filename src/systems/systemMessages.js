import BASE_WAIT_LINES from '../content/systemMessages.js';

function chooseRandom(items = []) {
  if (!items.length) return '';
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

function stripTrailingPunctuation(text) {
  return String(text || '').trim().replace(/[\.!?…\s]+$/u, '');
}

let cachedWaitingMessage = null;

export function ensureWaitingMessage() {
  if (!cachedWaitingMessage) {
    const base = stripTrailingPunctuation(chooseRandom(BASE_WAIT_LINES));
    cachedWaitingMessage = `${base}... movement locked.`;
  }
  return cachedWaitingMessage;
}

export function clearWaitingMessage() {
  cachedWaitingMessage = null;
}

export const __debug = { BASE_WAIT_LINES };


