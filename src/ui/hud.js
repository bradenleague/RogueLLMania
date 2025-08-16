let rootEl = null;

export function initializeHUD(root = document.getElementById('hud')) {
  rootEl = root;
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div class="hud-row">
      <div class="hud-item">
        <div class="label">HP</div>
        <div class="hpbar" aria-label="Health" aria-live="polite">
          <div class="hpbar-fill" style="width:0%"></div>
          <div class="hpbar-text">0/0</div>
        </div>
      </div>
      <div class="hud-item">
        <div class="label">Level</div>
        <div class="value" id="hud-level">1</div>
      </div>
    </div>
  `;
}

export function updateHUD({ hp = 0, maxHp = 0, level = 1 } = {}) {
  if (!rootEl) return;
  const fill = rootEl.querySelector('.hpbar-fill');
  const text = rootEl.querySelector('.hpbar-text');
  const lvl = rootEl.querySelector('#hud-level');
  if (fill && maxHp > 0) {
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    fill.style.width = `${Math.round(ratio * 100)}%`;
    fill.style.background = ratio < 0.3 ? 'var(--hp-crit)' : ratio < 0.6 ? 'var(--hp-warn)' : 'var(--hp-ok)';
  }
  if (text) text.textContent = `${hp}/${maxHp}`;
  if (lvl) lvl.textContent = String(level);
}

 


