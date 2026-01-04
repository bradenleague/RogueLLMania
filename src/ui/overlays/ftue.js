import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';

let overlayRootEl = null;

export function initializeFTUE() {
  register('ftue', (root) => {
    overlayRootEl = root;
    updateFTUEDisplay(root);
  }, { title: 'Welcome to RogueLLMania', closeOnEsc: false, closeOnScrim: false, className: 'ftue-overlay' });

  // Listen for events from main process
  const { ipcRenderer } = window.require('electron');
  ipcRenderer.on('show-ftue', () => {
    openFTUE();
  });

  ipcRenderer.on('model-download-starting', () => {
    if (!isOverlayOpen('ftue')) {
      openFTUE();
    }
  });
}

export async function openFTUE() {
  if (isOverlayOpen('ftue')) return;
  openOverlay('ftue');
}

export function closeFTUE() {
  if (!isOverlayOpen('ftue')) return;
  closeOverlay('ftue');
}

function updateFTUEDisplay(root) {
  root.innerHTML = `
    <div class="ftue-content">
      <div class="ftue-header">
        <h1 class="ftue-title">🎮 Welcome to RogueLLMania</h1>
        <div class="ftue-subtitle">An AI-Powered Roguelike Adventure</div>
      </div>

      <div class="ftue-section">
        <h2 class="ftue-section-title">🤖 Required: Qwen3 AI Model</h2>
        <p class="ftue-text">
          Download Qwen3-1.7B model (~1.19 GB) to experience AI-generated content.
          The model runs locally on your computer - no internet required after download!
        </p>
        <div class="ftue-features">
          <div class="ftue-feature">✨ Unique AI-generated storylines</div>
          <div class="ftue-feature">🔒 100% private - runs locally</div>
          <div class="ftue-feature">📦 Single 1.19GB download</div>
        </div>
      </div>

      <div class="ftue-download-section" id="downloadSection">
        <div class="ftue-download-status" id="downloadStatus">
          <div class="download-info">Download will begin automatically...</div>
        </div>
        <div class="ftue-progress" id="downloadProgress" style="display: none;">
          <div class="progress-bar-container">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="progress-text">
            <span id="progressPercent">0%</span>
            <span id="progressSize">0MB / 1.19GB</span>
          </div>
        </div>
      </div>

      <div class="ftue-note">
        <em>Game will start automatically when download completes.</em>
      </div>
    </div>
  `;

  setupDownloadListeners();
}

function setupDownloadListeners() {
  const { ipcRenderer } = window.require('electron');

  ipcRenderer.on('model-download-starting', (event, { name, sizeGB }) => {
    const downloadStatus = document.getElementById('downloadStatus');
    if (downloadStatus) {
      downloadStatus.innerHTML = `<div class="download-info">Downloading ${name} (${sizeGB}GB)...</div>`;
    }
  });

  ipcRenderer.on('model-download-progress', (event, progress) => {
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressSize = document.getElementById('progressSize');
    const progressSection = document.getElementById('downloadProgress');
    const downloadStatus = document.getElementById('downloadStatus');

    if (progressStatus) {
      progressStatus.style.display = 'none';
    }

    if (progressSection) {
      progressSection.style.display = 'block';
    }

    if (progressBar) {
      progressBar.style.width = `${progress.percent}%`;
    }

    if (progressPercent) {
      progressPercent.textContent = `${Math.round(progress.percent)}%`;
    }

    if (progressSize) {
      const downloadedMB = (progress.downloaded / (1024 * 1024)).toFixed(1);
      const totalMB = (progress.total / (1024 * 1024)).toFixed(0);
      const speedText = progress.speed > 0 ? ` @ ${progress.speed.toFixed(1)} MB/s` : '';
      progressSize.textContent = `${downloadedMB}MB / ${totalMB}MB${speedText}`;
    }
  });

  ipcRenderer.on('model-download-complete', () => {
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
      downloadSection.innerHTML = `
        <div class="ftue-success">
          <h3>✓ Download Complete!</h3>
          <p>Model installed successfully. Launching game...</p>
        </div>
      `;
      setTimeout(() => closeFTUE(), 2000);
    }
  });

  ipcRenderer.on('model-download-error', (event, { error }) => {
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
      downloadSection.innerHTML = `
        <div class="ftue-error">
          <h3>✗ Download Failed</h3>
          <p>${error}</p>
          <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        </div>
      `;
    }
  });
}

async function openSettingsAndDownload(modelId) {
  const { openSettings } = await import('./settings.js');
  await openSettings();
  
  setTimeout(() => {
    const modelSelect = document.querySelector('#modelSelect');
    if (modelSelect) {
      modelSelect.value = modelId;
      modelSelect.dispatchEvent(new Event('change'));
    }
    
    const downloadButton = document.querySelector('#downloadModelButton');
    if (downloadButton) {
      downloadButton.click();
    }
  }, 500);
}

async function openSettings() {
  const { openSettings } = await import('./settings.js');
  await openSettings();
}
