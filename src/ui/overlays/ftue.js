import { register, open as openOverlay, close as closeOverlay, isOpen as isOverlayOpen } from '../overlayManager.js';
import { subscribe as subscribeToModelDownload, getState as getModelDownloadState } from '../modelDownloadController.js';

let overlayRootEl = null;
let unsubscribeDownload = null;

export function initializeFTUE() {
  register('ftue', (root) => {
    overlayRootEl = root;
    updateFTUEDisplay(root);
    setupDownloadListeners();
  }, { title: 'Welcome to RogueLLMania', closeOnEsc: false, closeOnScrim: false, className: 'ftue-overlay' });

  // Listen for events from main process
  const { ipcRenderer } = window.require('electron');
  ipcRenderer.on('show-ftue', () => {
    openFTUE();
  });

  // Ensure FTUE opens automatically when a download starts
  subscribeToModelDownload(({ status }) => {
    if (status !== 'idle' && !isOverlayOpen('ftue')) {
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

  // Initialize UI with current download state
  syncWithControllerState(getModelDownloadState());
}

function setupDownloadListeners() {
  if (unsubscribeDownload) return;

  unsubscribeDownload = subscribeToModelDownload((state) => {
    syncWithControllerState(state);
  });
}

function syncWithControllerState({ status, data }) {
  switch (status) {
    case 'starting':
      handleDownloadStarting(data);
      break;
    case 'progress':
      handleDownloadProgress(data);
      break;
    case 'complete':
      handleDownloadComplete();
      break;
    case 'error':
      handleDownloadError(data);
      break;
    default:
      break;
  }
}

function handleDownloadStarting({ name, sizeGB } = {}) {
  const downloadStatus = document.getElementById('downloadStatus');
  const progressSection = document.getElementById('downloadProgress');

  if (downloadStatus) {
    const label = name && sizeGB ? `Downloading ${name} (${sizeGB}GB)...` : 'Preparing download...';
    downloadStatus.innerHTML = `<div class="download-info">${label}</div>`;
    downloadStatus.style.display = 'block';
  }

  if (progressSection) {
    progressSection.style.display = 'none';
  }
}

function handleDownloadProgress(progress = {}) {
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressSize = document.getElementById('progressSize');
  const progressSection = document.getElementById('downloadProgress');
  const downloadStatus = document.getElementById('downloadStatus');

  if (downloadStatus) {
    downloadStatus.style.display = 'none';
  }

  if (progressSection) {
    progressSection.style.display = 'block';
  }

  if (progressBar) {
    progressBar.style.width = `${progress.percent || 0}%`;
  }

  if (progressPercent) {
    progressPercent.textContent = `${Math.round(progress.percent || 0)}%`;
  }

  if (progressSize) {
    const downloadedMB = progress.downloaded ? (progress.downloaded / (1024 * 1024)).toFixed(1) : '0.0';
    const totalMB = progress.total ? (progress.total / (1024 * 1024)).toFixed(0) : '0';
    const speedText = progress.speed > 0 ? ` @ ${progress.speed.toFixed(1)} MB/s` : '';
    progressSize.textContent = `${downloadedMB}MB / ${totalMB}MB${speedText}`;
  }
}

function handleDownloadComplete() {
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
}

function handleDownloadError({ error } = {}) {
  const downloadSection = document.getElementById('downloadSection');
  if (downloadSection) {
    downloadSection.innerHTML = `
      <div class="ftue-error">
        <h3>✗ Download Failed</h3>
        <p>${error || 'Something went wrong while downloading the model.'}</p>
        <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }
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
