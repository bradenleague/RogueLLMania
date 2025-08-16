// Inventory overlay (migrated from systems)

import { getInventory } from '../../systems/gameState.js';
import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';

let currentContentRoot = null;

export function initializeInventoryUI() {
  register('inventory', (contentRoot) => {
    currentContentRoot = contentRoot;
    updateInventoryDisplay();
  }, { title: 'Inventory', closeOnEsc: true, closeOnScrim: true });
}

export function openInventory() {
  if (isOverlayOpen('inventory')) return;
  openOverlay('inventory');
}

export function closeInventory() {
  if (!isOverlayOpen('inventory')) return;
  closeOverlay('inventory');
}

export function toggleInventory() {
  if (isOverlayOpen('inventory')) closeInventory(); else openInventory();
}

function updateInventoryDisplay() {
  if (!currentContentRoot) return;
  const inventory = getInventory();
  let html = `
    <div class="inv-header">
      <h2 class="inv-title">INVENTORY</h2>
      <div class="inv-sub">Press 'I' or 'ESC' to close</div>
    </div>
  `;
  if (inventory.length === 0) {
    html += `<div class="inv-empty">Your inventory is empty.</div>`;
  } else {
    html += '<div class="inv-list">';
    for (const item of inventory) {
      const timeAgo = formatTimeAgo(item.timestamp);
      html += `
        <div class="inv-item">
          <div class="inv-item-title">${item.title || 'Mysterious Artifact'}</div>
          <div class="inv-item-desc">${item.description}</div>
          <div class="inv-item-meta">Picked up ${timeAgo} from level ${item.levelNumber}</div>
        </div>
      `;
    }
    html += '</div>';
    html += `<div class="inv-total">Total items: ${inventory.length}</div>`;
  }
  currentContentRoot.innerHTML = html;
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const elapsed = now - timestamp;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

export function isInventoryDisplayOpen() {
  return isOverlayOpen('inventory');
}

export function refreshInventoryDisplay() {
  if (isOverlayOpen('inventory')) updateInventoryDisplay();
}


