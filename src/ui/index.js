import { initializeOverlayManager } from './overlayManager.js';
import { initializeHUD } from './hud.js';
import { initializeInventoryUI } from './overlays/inventory.js';
import { initializeLevelIntroductionUI } from './overlays/levelIntro.js';
import { initializeSettingsUI } from './overlays/settings.js';

export function initializeUI({ turnEngine } = {}) {
  // Wire input locking to overlay lifecycle
  initializeOverlayManager({
    lockInput: () => { try { turnEngine?.engine?.lock(); } catch {} },
    unlockInput: () => { try { turnEngine?.engine?.unlock(); } catch {} },
  });

  // Initialize core UI components
  initializeHUD();

  // Register overlays
  initializeInventoryUI();
  initializeLevelIntroductionUI();
  initializeSettingsUI();
}


