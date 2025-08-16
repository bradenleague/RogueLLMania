const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let mainWindow;
let store; // Will be initialized with dynamic import

// Initialize settings store with dynamic import
async function initializeStore() {
    const { default: Store } = await import('electron-store');
    store = new Store({
        defaults: {
            ollamaModel: 'gemma3n:e4b',
            enableLLM: true,
            fullscreen: false,
            windowWidth: 1200,
            windowHeight: 800,
            windowPreset: 'Default'
        }
    });
}

function createWindow() {
  // Parse --log-level argument
  let logLevelArg = null;
  for (const arg of process.argv) {
    if (arg.startsWith('--log-level=')) {
      logLevelArg = arg.split('=')[1];
      break;
    }
  }

  const desiredWidth = store?.get('windowWidth') || 1200;
  const desiredHeight = store?.get('windowHeight') || 800;
  const shouldFullscreen = !!(store && store.get('fullscreen'));

  mainWindow = new BrowserWindow({
    width: desiredWidth,
    height: desiredHeight,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: logLevelArg ? [`--log-level=${logLevelArg}`] : []
    },
    title: 'RogueLLMania',
    resizable: true,
    fullscreenable: true,
    fullscreen: shouldFullscreen
  });

  mainWindow.loadFile('public/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Persist size on resize when not fullscreen
  mainWindow.on('resize', () => {
    if (!store || !mainWindow || mainWindow.isFullScreen()) return;
    const [w, h] = mainWindow.getSize();
    store.set('windowWidth', w);
    store.set('windowHeight', h);
  });
}

// Add IPC handler for Ollama API calls
ipcMain.handle('ollama-generate', async (event, { model, prompt, stream }) => {
  try {
    console.log('[Main Process] Sending request to Ollama:', { model, prompt });
    
    // Test if Ollama service is running first
    let response;
    try {
      response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream }),
      });
    } catch (fetchError) {
      // Network/connection error
      return { 
        success: false, 
        error: 'Cannot connect to Ollama service. Please ensure Ollama is running on port 11434.',
        errorType: 'CONNECTION_ERROR'
      };
    }
    
    if (!response.ok) {
      let errorMessage = `Ollama API request failed with status ${response.status}`;
      let errorType = 'API_ERROR';
      
      if (response.status === 404) {
        errorMessage = `Model '${model}' not found. Please check the model name or pull the model using: ollama pull ${model}`;
        errorType = 'MODEL_NOT_FOUND';
      } else if (response.status === 400) {
        const errorData = await response.text();
        errorMessage = `Bad request: ${errorData}`;
        errorType = 'BAD_REQUEST';
      } else if (response.status >= 500) {
        errorMessage = `Ollama server error (${response.status}). Please check your Ollama installation.`;
        errorType = 'SERVER_ERROR';
      }
      
      return { success: false, error: errorMessage, errorType };
    }
    
    const data = await response.json();
    console.log('[Main Process] Received response from Ollama:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Main Process] Error:', error);
    return { 
      success: false, 
      error: `Unexpected error: ${error.message}`,
      errorType: 'UNKNOWN_ERROR'
    };
  }
});

// Add IPC event for streaming Ollama responses
ipcMain.on('ollama-generate-stream', async (event, { model, prompt }) => {
  try {
    console.log('[Main Process] Streaming request to Ollama:', { model, prompt });
    let response;
    try {
      response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: true }),
      });
    } catch (fetchError) {
      event.sender.send('ollama-generate-stream-error', { error: 'Cannot connect to Ollama service. Please ensure Ollama is running on port 11434.', errorType: 'CONNECTION_ERROR' });
      return;
    }

    if (!response.ok) {
      let errorMessage = `Ollama API request failed with status ${response.status}`;
      let errorType = 'API_ERROR';
      if (response.status === 404) {
        errorMessage = `Model '${model}' not found. Please check the model name or pull the model using: ollama pull ${model}`;
        errorType = 'MODEL_NOT_FOUND';
      } else if (response.status >= 500) {
        errorMessage = `Ollama server error (${response.status}). Please check your Ollama installation.`;
        errorType = 'SERVICE_ERROR';
      }
      event.sender.send('ollama-generate-stream-error', { error: errorMessage, errorType });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop(); // last line may be incomplete
      for (const line of lines) {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            event.sender.send('ollama-generate-stream-data', json);
          } catch (e) {
            // Ignore parse errors for incomplete lines
          }
        }
      }
    }
    // Send any remaining buffer
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        event.sender.send('ollama-generate-stream-data', json);
      } catch (e) {}
    }
    event.sender.send('ollama-generate-stream-end');
  } catch (error) {
    console.error('[Main Process] Streaming Error:', error);
    event.sender.send('ollama-generate-stream-error', { error: error.message });
  }
});

// Add IPC handlers for settings management
ipcMain.handle('settings-get', (event, key) => {
  if (!store) {
    console.error('Store not initialized');
    return null;
  }
  if (key) {
    return store.get(key);
  }
  return store.store; // Return all settings if no key specified
});

ipcMain.handle('settings-set', (event, key, value) => {
  if (!store) {
    console.error('Store not initialized');
    return false;
  }
  store.set(key, value);
  return true;
});

ipcMain.handle('settings-get-all', () => {
  if (!store) {
    console.error('Store not initialized');
    return { ollamaModel: 'gemma3n:e4b', enableLLM: true, fullscreen: false, windowPreset: 'Default' };
  }
  return {
    ollamaModel: store.get('ollamaModel'),
    enableLLM: store.get('enableLLM'),
    fullscreen: store.get('fullscreen'),
    windowPreset: store.get('windowPreset')
  };
});

ipcMain.handle('settings-clear', () => {
  if (!store) {
    console.error('Store not initialized');
    return false;
  }
  store.clear();
  return true;
});

// Window control: fullscreen toggle
ipcMain.handle('window-set-fullscreen', (event, value) => {
  if (!mainWindow) return false;
  try {
    mainWindow.setFullScreen(!!value);
    if (store) store.set('fullscreen', !!value);
    return true;
  } catch (e) {
    console.error('Failed to set fullscreen:', e);
    return false;
  }
});

ipcMain.handle('window-get-fullscreen', () => {
  if (!mainWindow) return false;
  return mainWindow.isFullScreen();
});

// Apply a size preset
ipcMain.handle('window-apply-preset', (event, presetName) => {
  if (!mainWindow) return false;
  const presets = {
    '800x600': { width: 800, height: 600 },
    '960x720': { width: 960, height: 720 },
    '1024x768': { width: 1024, height: 768 },
    '1280x960': { width: 1280, height: 960 },
    '1440x1080': { width: 1440, height: 1080 },
    '1620x1215': { width: 1620, height: 1215 },
    '2560x1920': { width: 2560, height: 1920 },
    '2880x2160': { width: 2880, height: 2160 }
  };
  // Normalize names that may include " (4:3)"
  const normalized = (presetName || '').replace(/\s*\(4:3\)$/, '');
  const p = presets[normalized] || presets['1024x768'];
  mainWindow.setFullScreen(false);
  mainWindow.setSize(p.width, p.height);
  store?.set('fullscreen', false);
  store?.set('windowWidth', p.width);
  store?.set('windowHeight', p.height);
  store?.set('windowPreset', normalized || '1024x768');
  return true;
});

// Add IPC handler for testing Ollama connection
ipcMain.handle('ollama-test-connection', async (event, { model }) => {
  try {
    // Test basic connection to Ollama service
    let response;
    try {
      response = await fetch('http://127.0.0.1:11434/api/version', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (fetchError) {
      return { 
        success: false, 
        error: 'Cannot connect to Ollama service. Please ensure Ollama is running on port 11434.',
        errorType: 'CONNECTION_ERROR'
      };
    }

    if (!response.ok) {
      return { 
        success: false, 
        error: `Ollama service responded with status ${response.status}`,
        errorType: 'SERVICE_ERROR'
      };
    }

    // Test the specific model with a minimal prompt
    try {
      const testResponse = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model, 
          prompt: 'Test', 
          stream: false 
        }),
      });

      if (!testResponse.ok) {
        if (testResponse.status === 404) {
          return { 
            success: false, 
            error: `Model '${model}' not found. Run: ollama pull ${model}`,
            errorType: 'MODEL_NOT_FOUND'
          };
        }
        return { 
          success: false, 
          error: `Model test failed with status ${testResponse.status}`,
          errorType: 'MODEL_ERROR'
        };
      }

      return { 
        success: true, 
        message: `✓ Successfully connected to Ollama and validated model '${model}'`
      };
    } catch (modelError) {
      return { 
        success: false, 
        error: `Model test failed: ${modelError.message}`,
        errorType: 'MODEL_ERROR'
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: `Connection test failed: ${error.message}`,
      errorType: 'UNKNOWN_ERROR'
    };
  }
});

app.whenReady().then(async () => {
    await initializeStore();
    createWindow();
    // Minimal production menu: disable default DevTools shortcuts when packaged
    if (app.isPackaged) {
      const template = [
        {
          label: 'RogueLLMania',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      ];
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 