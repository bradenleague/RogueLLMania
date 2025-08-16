import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';
import { openSettings } from './settings.js';

let contentRoot = null;
let bodyEl = null;
let nudgeEl = null;
let typingTimer = null;
let pendingBuffer = '';
let typingActive = false;
const TYPE_INTERVAL_MS = 22; // slightly faster cadence
const CHARS_PER_TICK = 1; // one char at a time
const SENTENCE_PAUSE_MIN_MS = 180; // ensure perceptible pause
const SENTENCE_PAUSE_MULTIPLIER = 2; // at least twice the tick cadence
let lastAppendedChar = '';

export function initializeLevelIntroductionUI() {
  register('level-intro', (root, props = {}) => {
    contentRoot = root;
    updateLevelIntroductionDisplay(props.title || 'Chamber', props.description || '');
  }, { title: 'Level Introduction', closeOnEsc: true, closeOnScrim: true, closeOnSpace: true });
}

export function openLevelIntroduction(title, description) {
  if (isOverlayOpen('level-intro')) {
    updateLevelIntroductionDisplay(title, description);
  } else {
    openOverlay('level-intro', { title, description });
  }
}

export function closeLevelIntroduction() {
  if (isOverlayOpen('level-intro')) closeOverlay('level-intro');
}

export function toggleLevelIntroduction() {
  if (isOverlayOpen('level-intro')) closeOverlay('level-intro');
}

function updateLevelIntroductionDisplay(title, description) {
  if (!contentRoot) return;
  const html = `
    <div class="level-intro-header">
      <h1 class="level-intro-title">${escapeHtml(title)}</h1>
      <div class="level-intro-sub">Press 'ESC' to continue</div>
    </div>
    <div class="level-intro-body"></div>
    <div class="level-intro-nudge" id="levelIntroNudge" aria-live="polite"></div>
    <div class="level-intro-footer">Your adventure continues...</div>
  `;
  contentRoot.innerHTML = html;
  bodyEl = contentRoot.querySelector('.level-intro-body');
  nudgeEl = contentRoot.querySelector('#levelIntroNudge');
  // subtle fade-in
  try {
    bodyEl.style.opacity = '0';
    bodyEl.style.transition = 'opacity 240ms ease';
    requestAnimationFrame(() => { bodyEl.style.opacity = '1'; });
  } catch {}
  stopTyping();
  bodyEl.textContent = '';
  if (description) {
    // seed initial text via typewriter for consistency
    appendLevelIntroductionText(description);
  }
  // If there was buffered streamed content before the overlay opened, start typing it now
  if (!description && pendingBuffer && pendingBuffer.length > 0) {
    startTyping();
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function isLevelIntroductionOpen() {
  return isOverlayOpen('level-intro');
}

export function forceLevelIntroductionClose() {
  if (isOverlayOpen('level-intro')) closeOverlay('level-intro');
}

export function setLevelIntroductionText(text = '') {
  if (!contentRoot) return;
  if (!bodyEl) bodyEl = contentRoot.querySelector('.level-intro-body');
  if (!bodyEl) return;
  stopTyping();
  pendingBuffer = '';
  bodyEl.textContent = String(text);
}

export function appendLevelIntroductionText(text = '') {
  pendingBuffer += String(text);
  if (!contentRoot) return;
  if (!bodyEl) bodyEl = contentRoot.querySelector('.level-intro-body');
  if (!bodyEl) return;
  startTyping();
}

export function showLevelIntroductionNudge(message = '') {
  if (!contentRoot) return;
  if (!nudgeEl) nudgeEl = contentRoot.querySelector('#levelIntroNudge');
  if (!nudgeEl) return;
  const safe = escapeHtml(String(message));
  nudgeEl.innerHTML = `
    <div class="nudge-card">
      <div class="nudge-text">${safe}</div>
      <div class="nudge-actions"><button id="openSettingsFromIntro" class="btn">OPEN SETTINGS</button></div>
    </div>
  `;
  const btn = contentRoot.querySelector('#openSettingsFromIntro');
  btn?.addEventListener('click', () => {
    try { openSettings(); } catch {}
  });
 }

function startTyping() {
  if (typingActive) return;
  typingActive = true;
  typingTimer = setInterval(() => {
    if (!pendingBuffer || pendingBuffer.length === 0) {
      stopTyping();
      return;
    }
    const slice = pendingBuffer.slice(0, CHARS_PER_TICK);
    pendingBuffer = pendingBuffer.slice(CHARS_PER_TICK);
    if (bodyEl) bodyEl.textContent += slice;
    lastAppendedChar = slice.slice(-1);

    // Pause logic at end of sentences to avoid buffer overrun and add drama
    const next1 = pendingBuffer[0] || '';
    const next2 = pendingBuffer[1] || '';
    const isEllipsis = lastAppendedChar === '.' && next1 === '.'; // don't pause mid-ellipsis
    const isSentenceEndChar = lastAppendedChar === '.' || lastAppendedChar === '!' || lastAppendedChar === '?';
    const nextIsBoundary = next1 === '' || next1 === ' ' || next1 === '\n' || next1 === '\r' || next1 === '\t' || next1 === '\u00A0' ||
      ((next1 === '"' || next1 === "'") && (next2 === '' || next2 === ' ' || next2 === '\n'));
    if (!isEllipsis && isSentenceEndChar && nextIsBoundary) {
      const pauseMs = Math.max(TYPE_INTERVAL_MS * SENTENCE_PAUSE_MULTIPLIER, SENTENCE_PAUSE_MIN_MS);
      pauseTyping(pauseMs);
    }
  }, TYPE_INTERVAL_MS);
}

function stopTyping() {
  typingActive = false;
  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }
}

function pauseTyping(durationMs) {
  if (!typingActive) return;
  clearInterval(typingTimer);
  typingTimer = null;
  typingActive = false;
  setTimeout(() => {
    // Only restart if there is still content to show
    if (pendingBuffer && pendingBuffer.length > 0) {
      startTyping();
    }
  }, durationMs);
}


