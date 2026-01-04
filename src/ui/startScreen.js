import { appState } from './appState.js';

const { ipcRenderer } = window.require('electron');

const STATES = {
  START: 'START',
  CHECKING_MODEL: 'CHECKING_MODEL',
  NEEDS_DOWNLOAD: 'NEEDS_DOWNLOAD',
  DOWNLOADING: 'DOWNLOADING',
  READY: 'READY',
  PLAYING: 'PLAYING'
};

let startScreenEl = null;
let unsubscribe = null;

export function initializeStartScreen() {
  startScreenEl = document.getElementById('startScreen');
  if (!startScreenEl) {
    console.error('Start screen element not found');
    return;
  }

  render();
  setupEventListeners();

  unsubscribe = appState.onStateChange((newState, oldState) => {
    render();
  });

  startModelCheck();
}

export function destroyStartScreen() {
  stopFakeProgress();
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function startModelCheck() {
  ipcRenderer.send('check-model-status');
}

function setupEventListeners() {

  // Wait for LLM to be initialized before checking model status
  ipcRenderer.on('llm-initialized', () => {
    startModelCheck();
  });

  ipcRenderer.on('model-status', (event, data) => {
    // Ignore ready_to_download if we're actively downloading
    if (data.status === 'ready_to_download' && isDownloading) {
      return;
    }

    if (data.status === 'checking') {
      appState.setState(STATES.CHECKING_MODEL);
    } else if (data.status === 'downloading') {
      isDownloading = true;
      appState.setState(STATES.DOWNLOADING, data);
    } else if (data.status === 'ready') {
      isDownloading = false;
      appState.setState(STATES.READY, { modelPath: data.modelPath });
    } else if (data.status === 'ready_to_download') {
      isDownloading = false;
      appState.setState(STATES.NEEDS_DOWNLOAD);
    }
  });

  // Listen for download started - both event naming conventions
  const handleDownloadStarted = (event, data) => {
    stopFakeProgress();
    appState.setState(STATES.DOWNLOADING, data);
  };

  ipcRenderer.on('llm-model-download-started', handleDownloadStarted);
  ipcRenderer.on('model-download-started', handleDownloadStarted);

  let lastProgressUpdate = 0;
  // Handle download progress - both event naming conventions
  const handleDownloadProgress = (event, data) => {
    const now = Date.now();

    // Throttle to max 10 updates per second
    if (now - lastProgressUpdate < 100) {
      return;
    }
    lastProgressUpdate = now;

    stopFakeProgress();
    const currentState = appState.getState();

    // Direct DOM update instead of full re-render for performance
    if (currentState === STATES.DOWNLOADING) {
      updateDownloadProgress(data);
    } else if (currentState === STATES.READY || currentState === STATES.NEEDS_DOWNLOAD) {
      // If we're in READY or NEEDS_DOWNLOAD state but get progress, transition to DOWNLOADING
      appState.setState(STATES.DOWNLOADING, data);
    }
  };

  ipcRenderer.on('llm-model-download-progress', handleDownloadProgress);
  ipcRenderer.on('model-download-progress', handleDownloadProgress);

  // Handle download complete - both event naming conventions
  const handleDownloadComplete = (event, data) => {
    stopFakeProgress();
    isDownloading = false;

    // Use model path from event data
    const modelPath = data.path || data.modelPath;

    if (modelPath) {
      appState.setState(STATES.READY, { modelPath });
    } else {
      // Fallback: fetch model path via IPC
      ipcRenderer.invoke('get-model-path').then(modelDir => {
        if (modelDir) {
          const fullPath = modelDir + '/Qwen3-1.7B-Q4_K_M.gguf';
          appState.setState(STATES.READY, { modelPath: fullPath });
        } else {
          console.error('[StartScreen] Failed to get model directory');
          appState.setData({ error: 'Failed to locate downloaded model' });
        }
      }).catch(err => {
        console.error('[StartScreen] Failed to fetch model path:', err);
        appState.setData({ error: 'Failed to locate downloaded model' });
      });
    }
  };

  ipcRenderer.on('llm-model-download-complete', handleDownloadComplete);
  ipcRenderer.on('model-download-complete', handleDownloadComplete);

  // Handle download error - both event naming conventions
  const handleDownloadError = (event, data) => {
    isDownloading = false;
    stopFakeProgress();
    appState.setState(STATES.NEEDS_DOWNLOAD, { error: data.error });
  };

  ipcRenderer.on('llm-model-download-error', handleDownloadError);
  ipcRenderer.on('model-download-error', handleDownloadError);

  startScreenEl.addEventListener('click', (e) => {
    if (e.target.id === 'startGameBtn') {
      startGame();
    } else if (e.target.id === 'retryDownloadBtn') {
      retryDownload();
    } else if (e.target.id === 'openFolderBtn') {
      openModelFolder();
    }
  });
}

function startGame() {
  // Clean up fake progress before starting game
  stopFakeProgress();
  
  appState.setState(STATES.PLAYING);

  import('../game.js').then((module) => {
    if (module.startGame) {
      module.startGame();
    }
  });
}

let isDownloading = false;

function retryDownload() {
  isDownloading = true;

  // Start fake progress for immediate visual feedback
  startFakeProgress();

  // Immediately show downloading state
  appState.setState(STATES.DOWNLOADING, {
    model: {
      name: 'Qwen3-1.7B-Instruct',
      sizeGB: '1.19'
    },
    downloaded: 0,
    total: 1282439360,
    percent: 0,
    speed: 0,
    type: 'preparing'
  });

  ipcRenderer.send('retry-model-download');
  appState.setData({ error: null });
}

let fakeProgressInterval = null;
let fakeProgressPercent = 0;

function startFakeProgress() {
  if (fakeProgressInterval) {
    clearInterval(fakeProgressInterval);
  }
  
  fakeProgressPercent = 0;
  
  fakeProgressInterval = setInterval(() => {
    fakeProgressPercent += 0.5;
    
    const currentState = appState.getState();
    if (currentState === STATES.DOWNLOADING) {
      // Cap at 95% so real progress can take over and go to 100%
      const displayPercent = Math.min(fakeProgressPercent, 95);
      updateDownloadProgress({
        downloaded: displayPercent / 100 * 1282439360,
        total: 1282439360,
        percent: displayPercent,
        speed: 0,
        type: 'preparing'
      });
    } else {
      // If not in downloading state, stop fake progress
      stopFakeProgress();
    }
  }, 50);
}

function stopFakeProgress() {
  if (fakeProgressInterval) {
    clearInterval(fakeProgressInterval);
    fakeProgressInterval = null;
  }
}

function openModelFolder() {
  ipcRenderer.send('open-model-folder');
}

function render() {
  const state = appState.getState();
  const data = appState.getData();

  let content = '';

  switch (state) {
    case STATES.START:
      content = renderStart();
      break;
    case STATES.CHECKING_MODEL:
      content = renderChecking();
      break;
    case STATES.NEEDS_DOWNLOAD:
      content = renderNeedsDownload();
      break;
    case STATES.DOWNLOADING:
      content = renderDownloading(data);
      break;
    case STATES.READY:
      content = renderReady(data);
      break;
    case STATES.PLAYING:
      content = renderPlaying();
      break;
    default:
      content = renderStart();
  }

  startScreenEl.innerHTML = content;
}

function renderStart() {
  return `
    <div class="start-screen-content">
      <h1 class="start-title">RogueLLMania</h1>
      <p class="start-subtitle">An AI-Powered Roguelike Adventure</p>
      <div class="start-status">
        <span class="status-indicator"></span>
        <span>Starting up...</span>
      </div>
    </div>
  `;
}

function renderChecking() {
  return `
    <div class="start-screen-content">
      <h1 class="start-title">RogueLLMania</h1>
      <p class="start-subtitle">An AI-Powered Roguelike Adventure</p>
      <div class="start-status">
        <span class="status-indicator checking"></span>
        <span>Checking for AI model...</span>
      </div>
    </div>
  `;
}

function renderDownloading(data) {
  const modelInfo = data.model || {};
  const modelName = modelInfo.name || 'AI Model';
  const modelSize = modelInfo.sizeGB || '1.1';
  const isResuming = data.isResuming || false;
  const type = data.type || 'downloading';
  
  let phaseText = 'Downloading...';
  if (type === 'preparing') {
    phaseText = 'Preparing download...';
  } else if (type === 'verifying') {
    phaseText = 'Verifying model...';
  } else if (type === 'complete') {
    phaseText = 'Finalizing...';
  }

  return `
    <div class="start-screen-content">
      <h1 class="start-title">Setting up AI features</h1>
      <p class="start-subtitle">Preparing your adventure...</p>
      
      <div class="download-info">
        <p>
          We're downloading a local AI model from Hugging Face used for narration and generation.
        </p>
        <p class="download-details">
          Model: ${modelName}<br>
          Download size: ~${modelSize} GB<br>
          Storage: On your computer (one-time setup)
        </p>
      </div>

      <div class="download-progress-section">
        <div class="download-header">
          ${isResuming ? '<span class="resuming-badge">Resuming</span>' : ''}
          <span class="download-title">${modelName}</span>
          <span class="download-phase">${phaseText}</span>
        </div>
        
        <div class="download-stats">
          <span class="download-amount">${formatBytes(data.downloaded || 0)} / ${formatBytes(data.total || 1282439360)}</span>
          <span class="download-percent">${Math.round(data.percent || 0)}%</span>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${data.percent || 0}%"></div>
        </div>

        ${data.speed && data.speed > 0 ? `
          <div class="download-speed-info">
            <span>${data.speed.toFixed(1)} MB/s</span>
            ${data.remainingTime ? `<span>• ~${formatTime(data.remainingTime)} remaining</span>` : ''}
          </div>
        ` : ''}
      </div>
      
      <p class="start-note">This may take a few minutes depending on your connection.</p>
    </div>
  `;
}

function renderNeedsDownload() {
  return `
    <div class="start-screen-content">
      <h1 class="start-title">RogueLLMania</h1>
      <p class="start-subtitle">An AI-Powered Roguelike Adventure</p>

      <div class="download-info">
        <p>
          To enable AI narration, we need to download a local model from Hugging Face.
        </p>
        <p class="download-details">
          Model: Qwen3-1.7B-Instruct<br>
          Download size: ~1.1 GB<br>
          Storage: On your computer (one-time setup)
        </p>
        <p class="download-note">
          <a href="https://huggingface.co/lm-kit/qwen-3-1.7b-instruct-gguf" target="_blank" class="model-link">Learn more about this model on Hugging Face →</a>
        </p>
      </div>

      <button id="retryDownloadBtn" class="btn btn-primary btn-large">Download Model</button>

      <p class="start-note">This may take a few minutes depending on your connection.</p>
    </div>
  `;
}

function renderReady(data) {
  const modelPath = data.modelPath || 'Unknown location';

  return `
    <div class="start-screen-content">
      <h1 class="start-title">RogueLLMania</h1>
      <p class="start-subtitle">An AI-Powered Roguelike Adventure</p>

      <div class="ready-status">
        <div class="ready-indicator">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div class="ready-text">
          <h2>Ready to Play</h2>
          <p>AI model installed successfully</p>
        </div>
      </div>

      <div class="model-location">
        <span class="location-label">Model stored at:</span>
        <code class="location-path">${modelPath}</code>
        <button id="openFolderBtn" class="btn btn-secondary btn-small">Open folder</button>
      </div>

      <button id="startGameBtn" class="btn btn-primary btn-large">Start Game</button>
    </div>
  `;
}

function renderPlaying() {
  return '';
}

function updateDownloadProgress(data) {
  if (!startScreenEl) return;
  
  const amountEl = startScreenEl.querySelector('.download-amount');
  const percentEl = startScreenEl.querySelector('.download-percent');
  const barEl = startScreenEl.querySelector('.progress-bar');
  const speedEl = startScreenEl.querySelector('.download-speed-info');

  if (amountEl) {
    amountEl.textContent = `${formatBytes(data.downloaded || 0)} / ${formatBytes(data.total || 1282439360)}`;
  }

  if (percentEl) {
    percentEl.textContent = `${Math.round(data.percent || 0)}%`;
  }

  if (barEl) {
    barEl.style.width = `${data.percent || 0}%`;
  }

  // Calculate remaining time if not provided
  let remainingTime = data.remainingTime;
  if (!remainingTime && data.speed > 0 && data.total > 0) {
    const remainingBytes = data.total - (data.downloaded || 0);
    remainingTime = remainingBytes / (data.speed * 1024 * 1024);
  }

  if (speedEl && data.speed > 0) {
    speedEl.innerHTML = `
      <span>${data.speed.toFixed(1)} MB/s</span>
      ${remainingTime ? `<span>• ~${formatTime(remainingTime)} remaining</span>` : ''}
    `;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

// Auto-initialize start screen when loaded
window.addEventListener('DOMContentLoaded', () => {
  initializeStartScreen();
});
