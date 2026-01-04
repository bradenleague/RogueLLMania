import { getAllSettings, setLLMModel, setLLMEnabled, getFullscreen, setFullscreen, applyWindowPreset } from '../../systems/settings.js';
import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';

let overlayRootEl = null;
let downloadedModels = [];
let availableModels = [];
let currentDownloadProgress = null;

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

  // Fetch model information
  await fetchModelInfo();

  const model = availableModels[0] || { name: 'Qwen3-1.7B-Instruct', size: '1.19GB' };
  const isDownloaded = downloadedModels.length > 0;

  if (!root) return;
  root.innerHTML = `
    <div class="settings-header">
      <h2 class="settings-title">SETTINGS</h2>
      <div class="settings-sub">Configure game options</div>
    </div>
    <div class="settings-field">
      <label class="settings-label">AI Model:</label>
      <div class="settings-model-status">
        <span class="model-name">${model.name}</span>
        <span class="model-info">(${model.size})</span>
      </div>
      <div class="model-status-indicator ${isDownloaded ? 'installed' : 'not-installed'}">
        ${isDownloaded ? '✓ Installed' : '⚠ Not Installed'}
      </div>
      ${isDownloaded ? '' : `
        <button id="downloadModelButton" class="btn btn-small btn-primary">Download Model (1.19GB)</button>
      `}
      ${isDownloaded ? `
        <button id="deleteModelButton" class="btn btn-small btn-danger">Delete Model</button>
      ` : ''}
    </div>
    <div class="settings-field" id="downloadProgressField" style="display: none;">
      <div class="download-progress">
        <div class="download-progress-bar"></div>
        <div class="download-progress-text"></div>
      </div>
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
      <button id="testConnectionButton" class="btn" ${!isDownloaded ? 'disabled' : ''}>TEST CONNECTION</button>
      <button id="saveSettingsButton" class="btn btn-primary">SAVE</button>
      <button id="cancelSettingsButton" class="btn btn-danger">CANCEL</button>
    </div>
  `;

  root.querySelector('#testConnectionButton').addEventListener('click', () => testConnection(root));
  root.querySelector('#saveSettingsButton').addEventListener('click', () => saveSettings(root));
  root.querySelector('#cancelSettingsButton').addEventListener('click', closeSettings);

  root.querySelector('#downloadModelButton')?.addEventListener('click', () => downloadModel(root));
  root.querySelector('#deleteModelButton')?.addEventListener('click', () => deleteModel(root));

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

async function fetchModelInfo() {
  try {
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) return;
    
    const [availableResult, downloadedResult] = await Promise.all([
      ipcRenderer.invoke('llm-get-available-models'),
      ipcRenderer.invoke('llm-get-downloaded-models')
    ]);
    
    if (availableResult.success) {
      availableModels = availableResult.models || [];
    }
    
    if (downloadedResult.success) {
      downloadedModels = downloadedResult.models || [];
    }
  } catch (error) {
    console.error('Error fetching model info:', error);
  }
}

async function saveSettings(root) {
  const enableLLMCheckbox = root.querySelector('#enableLLMCheckbox');
  const fullscreenCheckbox = root.querySelector('#fullscreenCheckbox');
  if (enableLLMCheckbox == null) return;
  try {
    const newLLMEnabled = enableLLMCheckbox.checked;
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
  const enableLLMCheckbox = root.querySelector('#enableLLMCheckbox');
  const testButton = root.querySelector('#testConnectionButton');
  if (!enableLLMCheckbox) return;
  testButton.innerHTML = 'TESTING...';
  testButton.disabled = true;
  try {
    const newLLMEnabled = enableLLMCheckbox.checked;
    await setLLMEnabled(newLLMEnabled);
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) {
      showTestResult(root, 'Electron IPC not available in this environment.', 'error');
    } else {
      const result = await ipcRenderer.invoke('llm-test-connection', { model: 'qwen3:1.7b' });
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

async function downloadModel(root) {
  const downloadButton = root.querySelector('#downloadModelButton');
  const progressField = root.querySelector('#downloadProgressField');

  downloadButton.disabled = true;
  downloadButton.textContent = 'Downloading...';
  progressField.style.display = 'block';

  try {
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) throw new Error('IPC not available');

    const progressListener = (event, progress) => {
      updateDownloadProgress(root, progress);
    };

    ipcRenderer.on('model-download-progress', progressListener);

    const result = await ipcRenderer.invoke('llm-download-model', { model: 'qwen3:1.7b' });

    ipcRenderer.removeListener('model-download-progress', progressListener);

    if (result.success) {
      await fetchModelInfo();
      alert('Qwen3 model downloaded successfully!');
      await updateSettingsDisplay(root);
    } else {
      throw new Error(result.error || 'Download failed');
    }
  } catch (error) {
    console.error('Download error:', error);
    alert(`Failed to download model: ${error.message}`);
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = 'Download Model (1.19GB)';
    progressField.style.display = 'none';
  }
}

function updateDownloadProgress(root, progress) {
  const progressField = root.querySelector('#downloadProgressField');
  if (!progressField) return;
  
  const progressBar = progressField.querySelector('.download-progress-bar');
  const progressText = progressField.querySelector('.download-progress-text');
  
  if (progressBar) {
    progressBar.style.width = `${progress.percent || 0}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${progress.percent || 0}% downloaded`;
    if (progress.status) {
      progressText.textContent += ` - ${progress.status}`;
    }
  }
}

async function deleteModel(root) {
  if (!confirm('Are you sure you want to delete the Qwen3 model? This will require redownloading ~1.19GB.')) {
    return;
  }

  try {
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) throw new Error('IPC not available');

    const result = await ipcRenderer.invoke('llm-delete-model', { model: 'qwen3:1.7b' });

    if (result.success) {
      await fetchModelInfo();
      alert('Qwen3 model deleted successfully!');
      await updateSettingsDisplay(root);
    } else {
      throw new Error(result.error || 'Delete failed');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert(`Failed to delete model: ${error.message}`);
  }
}

export function isSettingsDisplayOpen() {
  return isOverlayOpen('settings');
}

