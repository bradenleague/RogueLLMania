const { ipcRenderer } = window.require('electron');

const subscribers = new Set();
let listenersRegistered = false;

const state = {
  status: 'idle',
  data: null
};

function notifySubscribers() {
  subscribers.forEach((callback) => {
    try {
      callback({ ...state });
    } catch (err) {
      console.error('[ModelDownloadController] Error notifying subscriber', err);
    }
  });
}

function setState(status, data = null) {
  state.status = status;
  state.data = data;
  notifySubscribers();
}

function handleDownloadStarted(event, data) {
  setState('starting', data);
}

function handleDownloadProgress(event, data) {
  setState('progress', data);
}

function handleDownloadComplete(event, data) {
  setState('complete', data);
}

function handleDownloadError(event, data) {
  setState('error', data);
}

function registerIpcListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  ipcRenderer.on('model-download-starting', handleDownloadStarted);
  ipcRenderer.on('model-download-started', handleDownloadStarted);
  ipcRenderer.on('llm-model-download-started', handleDownloadStarted);

  ipcRenderer.on('model-download-progress', handleDownloadProgress);
  ipcRenderer.on('llm-model-download-progress', handleDownloadProgress);

  ipcRenderer.on('model-download-complete', handleDownloadComplete);
  ipcRenderer.on('llm-model-download-complete', handleDownloadComplete);

  ipcRenderer.on('model-download-error', handleDownloadError);
  ipcRenderer.on('llm-model-download-error', handleDownloadError);
}

export function subscribe(callback) {
  registerIpcListeners();

  subscribers.add(callback);
  // Immediately notify with current state so subscribers can initialize
  callback({ ...state });

  return () => {
    subscribers.delete(callback);
  };
}

export function getState() {
  return { ...state };
}
