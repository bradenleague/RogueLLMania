// Minimal overlay manager scaffold: stack, shell, ESC handling, input lock hooks

let overlayRoot = null;
let overlayStack = [];
let lockInputFn = null;
let unlockInputFn = null;

const registry = new Map();

export function initializeOverlayManager({ lockInput, unlockInput } = {}) {
  overlayRoot = document.getElementById('overlayRoot');
  if (!overlayRoot) {
    throw new Error('overlayRoot element not found');
  }
  lockInputFn = typeof lockInput === 'function' ? lockInput : null;
  unlockInputFn = typeof unlockInput === 'function' ? unlockInput : null;

  document.addEventListener('keydown', onKeyDown, true);
}

export function register(id, renderFn, options = {}) {
  registry.set(id, { renderFn, options });
}

export function open(id, props = {}) {
  const entry = registry.get(id);
  if (!entry) return;

  if (overlayStack.length === 0 && lockInputFn) lockInputFn();

  const node = renderOverlayShell(id, entry, props);
  overlayRoot.appendChild(node);
  overlayRoot.classList.add('active');
  overlayRoot.setAttribute('aria-hidden', 'false');
  overlayStack.push({ id, node });

  // Focus first focusable element or close button
  queueMicrotask(() => {
    const focusTarget = node.querySelector('[data-initial-focus]') || node.querySelector('.overlay-dialog');
    if (focusTarget) focusTarget.focus();
  });
}

export function close(id) {
  const idx = overlayStack.findIndex(o => o.id === id);
  if (idx === -1) return;
  const { node } = overlayStack[idx];
  node.remove();
  overlayStack.splice(idx, 1);
  if (overlayStack.length === 0) {
    overlayRoot.classList.remove('active');
    overlayRoot.setAttribute('aria-hidden', 'true');
    if (unlockInputFn) unlockInputFn();
  }
}

export function closeTop() {
  if (overlayStack.length === 0) return;
  close(overlayStack[overlayStack.length - 1].id);
}

export function isOpen(id) {
  return overlayStack.some(o => o.id === id);
}

export function isAnyOpen() {
  return overlayStack.length > 0;
}

export function openTransientSystemOverlay(message = 'Loading...') {
  // Simple built-in overlay for system messages; not registered
  const id = '__system-loading__';
  if (isOpen(id)) return;
  if (overlayStack.length === 0 && lockInputFn) lockInputFn();
  const node = document.createElement('div');
  node.className = 'overlay-container';
  const scrim = document.createElement('div');
  scrim.className = 'overlay-scrim';
  const dialog = document.createElement('div');
  dialog.className = 'overlay-dialog';
  const header = document.createElement('div');
  header.className = 'overlay-header';
  const title = document.createElement('div');
  title.className = 'overlay-title';
  title.textContent = 'Please wait';
  const content = document.createElement('div');
  content.className = 'overlay-content';
  content.textContent = message;
  header.appendChild(title);
  dialog.appendChild(header);
  dialog.appendChild(content);
  node.appendChild(scrim);
  node.appendChild(dialog);
  overlayRoot.appendChild(node);
  overlayRoot.classList.add('active');
  overlayRoot.setAttribute('aria-hidden', 'false');
  overlayStack.push({ id, node });
}

export function closeTransientSystemOverlay() {
  const id = '__system-loading__';
  const idx = overlayStack.findIndex(o => o.id === id);
  if (idx === -1) return;
  const { node } = overlayStack[idx];
  node.remove();
  overlayStack.splice(idx, 1);
  if (overlayStack.length === 0) {
    overlayRoot.classList.remove('active');
    overlayRoot.setAttribute('aria-hidden', 'true');
    if (unlockInputFn) unlockInputFn();
  }
}

function onKeyDown(e) {
  if (overlayStack.length === 0) return;
  const top = overlayStack[overlayStack.length - 1];
  const entry = registry.get(top.id);
  const { options = {} } = entry || {};
  if (e.key === 'Escape' && options.closeOnEsc !== false) {
    e.preventDefault();
    closeTop();
  }
  if ((e.key === ' ' || e.code === 'Space') && options.closeOnSpace) {
    e.preventDefault();
    closeTop();
  }

  // Basic focus trap within dialog
  if (e.key === 'Tab') {
    const focusables = top.node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function renderOverlayShell(id, entry, props) {
  const { renderFn, options = {} } = entry;
  const container = document.createElement('div');
  container.className = 'overlay-container';

  const scrim = document.createElement('div');
  scrim.className = 'overlay-scrim';
  if (options.closeOnScrim !== false) {
    scrim.addEventListener('click', () => close(id));
  }

  const dialog = document.createElement('div');
  dialog.className = 'overlay-dialog';
  if (options.className) {
    dialog.classList.add(options.className);
  }
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');

  const header = document.createElement('div');
  header.className = 'overlay-header';

  const title = document.createElement('div');
  title.className = 'overlay-title';
  title.textContent = options.title || '';
  title.id = `${id}-title`;
  dialog.setAttribute('aria-labelledby', title.id);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'overlay-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerText = '✕';
  closeBtn.addEventListener('click', () => close(id));

  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'overlay-content';
  // content is not focused by default to avoid unwanted focus outlines

  // Let the overlay-specific renderer populate content
  try {
    renderFn(content, props);
  } catch (err) {
    content.textContent = 'An error occurred rendering this overlay.';
    // silent; avoid logger dependency here
    console.error(err);
  }

  dialog.appendChild(header);
  dialog.appendChild(content);

  container.appendChild(scrim);
  container.appendChild(dialog);
  return container;
}


