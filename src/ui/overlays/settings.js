import { getAllSettings, setOllamaModel, setLLMEnabled, getFullscreen, setFullscreen, applyWindowPreset } from '../../systems/settings.js';
import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';

let overlayRootEl = null;

export function initializeSettingsUI() {
  register('settings', async (root) => {
    overlayRootEl = root;
    await updateSettingsDisplay(root);
  }, { title: 'Settings', closeOnEsc: true, closeOnScrim: true, className: 'settings-wide' });
  createSettingsButton();
}

function createSettingsButton() {
  const btn = document.createElement('button');
  btn.id = 'settingsButton';
  btn.className = 'settings-button';
  btn.setAttribute('aria-label', 'Open settings');
  btn.innerHTML = '⚙️';
  btn.addEventListener('click', toggleSettings);
  document.body.appendChild(btn);
}

export async function openSettings() {
  if (isOverlayOpen('settings')) return;
  openOverlay('settings');
}

export function closeSettings() {
  if (!isOverlayOpen('settings')) return;
  closeOverlay('settings');
}

export async function toggleSettings() {
  if (isOverlayOpen('settings')) closeSettings(); else openSettings();
}

async function updateSettingsDisplay(root) {
  const settings = await getAllSettings();
  if (!root) return;
  root.innerHTML = `
    <div class="settings-header">
      <h2 class="settings-title">SETTINGS</h2>
      <div class="settings-sub">Configure game options</div>
    </div>
    <div class="settings-field">
      <label class="settings-label">Ollama Model:</label>
      <input type="text" id="ollamaModelInput" class="settings-input" value="${settings.ollamaModel}" placeholder="e.g., gemma3n:e4b" />
      <div class="settings-help">The Ollama model to use for text generation</div>
    </div>
    <div class="settings-field">
      <label class="settings-checkbox-label">
        <input type="checkbox" id="enableLLMCheckbox" ${settings.enableLLM ? 'checked' : ''} />
        Enable LLM Generation
      </label>
      <div class="settings-help">When disabled, uses debug/fallback content instead</div>
    </div>
    <div class="settings-field">
      <label class="settings-checkbox-label">
        <input type="checkbox" id="fullscreenCheckbox" ${settings.fullscreen ? 'checked' : ''} />
        Fullscreen
      </label>
      <div class="settings-help">Toggle fullscreen immediately</div>
    </div>
    <div class="settings-field">
      <label class="settings-label">Window size</label>
      <select id="windowPresetSelect" class="settings-input">
        <option value="800x600" ${settings.windowPreset === '800x600' ? 'selected' : ''}>800×600</option>
        <option value="960x720" ${settings.windowPreset === '960x720' ? 'selected' : ''}>960×720</option>
        <option value="1024x768" ${!settings.windowPreset || settings.windowPreset === '1024x768' ? 'selected' : ''}>1024×768</option>
        <option value="1280x960" ${settings.windowPreset === '1280x960' ? 'selected' : ''}>1280×960</option>
        <option value="1440x1080" ${settings.windowPreset === '1440x1080' ? 'selected' : ''}>1440×1080</option>
        <option value="1620x1215" ${settings.windowPreset === '1620x1215' ? 'selected' : ''}>1620×1215</option>
        <option value="2560x1920" ${settings.windowPreset === '2560x1920' ? 'selected' : ''}>2560×1920</option>
        <option value="2880x2160" ${settings.windowPreset === '2880x2160' ? 'selected' : ''}>2880×2160</option>
      </select>
      <div class="settings-help">Applied immediately</div>
    </div>
    <div class="settings-actions">
      <button id="testConnectionButton" class="btn">TEST CONNECTION</button>
      <button id="saveSettingsButton" class="btn btn-primary">SAVE</button>
      <button id="cancelSettingsButton" class="btn btn-danger">CANCEL</button>
    </div>
  `;

  root.querySelector('#testConnectionButton').addEventListener('click', () => testConnection(root));
  root.querySelector('#saveSettingsButton').addEventListener('click', () => saveSettings(root));
  root.querySelector('#cancelSettingsButton').addEventListener('click', closeSettings);

  const fullscreenCheckbox = root.querySelector('#fullscreenCheckbox');
  fullscreenCheckbox?.addEventListener('change', async (e) => {
    try { await setFullscreen(e.target.checked); } catch {}
  });

  const presetSelect = root.querySelector('#windowPresetSelect');
  presetSelect?.addEventListener('change', async () => {
    const value = presetSelect.value;
    await applyWindowPreset(value);
  });
}

async function saveSettings(root) {
  const modelInput = root.querySelector('#ollamaModelInput');
  const enableLLMCheckbox = root.querySelector('#enableLLMCheckbox');
  const fullscreenCheckbox = root.querySelector('#fullscreenCheckbox');
  if (!modelInput || enableLLMCheckbox == null) return;
  try {
    const newModel = modelInput.value.trim();
    const newLLMEnabled = enableLLMCheckbox.checked;
    if (newModel) await setOllamaModel(newModel);
    await setLLMEnabled(newLLMEnabled);
    if (fullscreenCheckbox) await setFullscreen(fullscreenCheckbox.checked);
    showSettingsSaved(root);
    setTimeout(() => closeSettings(), 1000);
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

function showSettingsSaved(root) {
  root.innerHTML = `
    <div class="settings-result success">
      <h2 class="settings-result-title">✓ SETTINGS SAVED</h2>
      <div class="settings-result-text">Changes will take effect for new content generation</div>
    </div>
  `;
}

async function testConnection(root) {
  const modelInput = root.querySelector('#ollamaModelInput');
  const enableLLMCheckbox = root.querySelector('#enableLLMCheckbox');
  const testButton = root.querySelector('#testConnectionButton');
  if (!modelInput || !enableLLMCheckbox) return;
  testButton.innerHTML = 'TESTING...';
  testButton.disabled = true;
  try {
    const newModel = modelInput.value.trim();
    const newLLMEnabled = enableLLMCheckbox.checked;
    if (newModel) await setOllamaModel(newModel);
    await setLLMEnabled(newLLMEnabled);
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) {
      showTestResult(root, 'Electron IPC not available in this environment.', 'error');
    } else {
      const model = newModel || 'gemma3n:e4b';
      const result = await ipcRenderer.invoke('ollama-test-connection', { model });
      if (result.success) showTestResult(root, `${result.message}\n\n✓ Settings have been saved.`, 'success');
      else showTestResult(root, `${result.error}\n\n⚠️ Settings were saved, but connection test failed.`, 'error');
    }
  } catch (err) {
    showTestResult(root, `Test failed: ${err.message}`, 'error');
  } finally {
    testButton.innerHTML = 'TEST CONNECTION';
    testButton.disabled = false;
  }
}

function showTestResult(root, message, type) {
  root.innerHTML = `
    <div class="settings-result ${type === 'success' ? 'success' : 'error'}">
      <h2 class="settings-result-title">${type === 'success' ? '✓ CONNECTION TEST' : '✗ CONNECTION FAILED'}</h2>
      <div class="settings-result-text"><pre>${message}</pre></div>
      <div class="settings-actions">
        <button id="backToSettingsButton" class="btn">BACK TO SETTINGS</button>
      </div>
    </div>
  `;
  root.querySelector('#backToSettingsButton').addEventListener('click', async () => {
    await updateSettingsDisplay(root);
  });
}

export function isSettingsDisplayOpen() {
  return isOverlayOpen('settings');
}


