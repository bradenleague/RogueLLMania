import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'path';
import { createLlamaSystem } from './main/llm/index.js';
import { info, error, warn, debug } from './systems/logger.js';

let mainWindow;
let store; // Will be initialized with dynamic import
let llmBridge; // New LLM bridge instance
let llmInitialized = false;
let downloadJustCompleted = false;

// Initialize settings store with dynamic import
async function initializeStore() {
    const { default: Store } = await import('electron-store');
    store = new Store({
        defaults: {
            llmModel: 'phi3:mini',
            enableLLM: true,
            fullscreen: false,
            windowWidth: 1200,
            windowHeight: 800,
            windowPreset: 'Default'
        }
    });
}

// Initialize llama.cpp system
async function initializeLLM() {
    try {
        const llamaSystem = await createLlamaSystem({
            appDataPath: app.getPath('userData')
        });

        await llamaSystem.bridge.initialize();

        // Set up event forwarding to renderer
        llamaSystem.bridge.on('model-download-started', (data) => {
            info('[Main] LlamaBridge emitted model-download-started, forwarding to renderer');
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-started', data);
                info('[Main] Sent llm-model-download-started to renderer');
            } else {
                warn('[Main] Cannot forward event - mainWindow is null');
            }
        });

        llamaSystem.bridge.on('model-download-progress', (data) => {
            info('[Main] LlamaBridge emitted model-download-progress', data.percent ? `${data.percent.toFixed(1)}%` : '');
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-progress', data);
            }
        });

        llamaSystem.bridge.on('model-download-complete', (data) => {
            info('[Main] LlamaBridge emitted model-download-complete, forwarding to renderer');
            info('[Main] Event data:', JSON.stringify(data));
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-complete', data);
                info('[Main] Sent llm-model-download-complete to renderer');
            } else {
                warn('[Main] Cannot forward event - mainWindow is null');
            }
        });

        llamaSystem.bridge.on('model-download-error', (data) => {
            error('[Main] LlamaBridge emitted model-download-error, forwarding to renderer');
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-error', data);
            }
        });

        llmBridge = llamaSystem.bridge;
        llmInitialized = true;

        info('llama.cpp initialized successfully');
        return { success: true, mode: 'llama.cpp' };
    } catch (err) {
        error('Failed to initialize llama.cpp:', err);
        llmInitialized = false;

        return {
            success: false,
            error: error.message,
            mode: 'none',
            message: 'llama.cpp initialization failed. LLM features will be unavailable.'
        };
    }
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

// Add IPC handler for LLM generation
ipcMain.handle('llm-generate', async (event, { model, prompt, stream, temperature, maxTokens }) => {
  try {
    debug('[Main Process] LLM generation request:', { model, prompt: prompt.substring(0, 50) });
    
    if (!llmInitialized || !llmBridge) {
      return { 
        success: false, 
        error: 'LLM not initialized',
        errorType: 'NOT_INITIALIZED'
      };
    }
    
    const result = await llmBridge.chat({
      prompt,
      model,
      temperature,
      maxTokens,
      stream: false
    });
    
    return result;
  } catch (err) {
    error('[Main Process] LLM generation error:', err);
    return { 
      success: false, 
      error: error.message,
      errorType: 'GENERATION_ERROR'
    };
  }
});

// Add IPC event for streaming LLM responses
ipcMain.on('llm-generate-stream', async (event, { model, prompt, temperature, maxTokens }) => {
  try {
    debug('[Main Process] LLM streaming request:', { model, prompt: prompt.substring(0, 50) });
    
    if (!llmInitialized || !llmBridge) {
      event.sender.send('llm-generate-stream-error', { error: 'LLM not initialized', errorType: 'NOT_INITIALIZED' });
      return;
    }
    
    await llmBridge.chatStream({
      prompt,
      model,
      temperature,
      maxTokens
    }, (chunk) => {
      event.sender.send('llm-generate-stream-data', { content: chunk });
    });
    
    event.sender.send('llm-generate-stream-end');
  } catch (err) {
    error('[Main Process] LLM streaming error:', err);
    event.sender.send('llm-generate-stream-error', { error: err.message, errorType: 'STREAM_ERROR' });
  }
});

// Check model status helper function
async function checkModelStatus() {
    info('[Main] checkModelStatus called');
    if (!llmInitialized || !llmBridge) {
        info('[Main] LLM not initialized');
        return { status: 'checking' };
    }

    try {
        const { existsSync, statSync } = await import('fs');
        const { join } = await import('path');
        const model = llmBridge.config.getTargetModel();
        const modelPath = join(app.getPath('userData'), 'models', 'qwen2.5', 'main', model.filename);

        info('[Main] Checking model at:', modelPath);

        if (existsSync(modelPath)) {
            const stats = statSync(modelPath);
            info('[Main] Model file exists, size:', stats.size, 'expected:', model.expectedSize);

            // Check if it's a complete, valid download
            if (stats.size === model.expectedSize) {
                info('[Main] Model is complete and valid');
                return {
                    status: 'ready',
                    model: model,
                    modelPath: modelPath
                };
            }
        }

        // Check for partial download
        const partialPath = modelPath + '.partial';
        if (existsSync(partialPath)) {
            const stats = statSync(partialPath);
            info('[Main] Partial download found, size:', stats.size);

            // Auto-resume download
            info('[Main] Auto-resuming download');
            startDownload();

            return {
                status: 'downloading',
                model: model,
                isResuming: true,
                downloaded: stats.size,
                total: model.expectedSize,
                percent: (stats.size / model.expectedSize) * 100
            };
        } else {
            info('[Main] No model or partial file found');
            return { status: 'ready_to_download' };
        }
    } catch (err) {
        error('[Main] Error checking model status:', err);
        return { status: 'error', error: err.message };
    }
}

// IPC handler for checking model status (both on and handle)
ipcMain.on('check-model-status', async () => {
    info('[Main] check-model-status (on) handler called');
    const status = await checkModelStatus();
    if (mainWindow) {
        mainWindow.webContents.send('model-status', status);
    }
});

ipcMain.handle('check-model-status', async () => {
    info('[Main] check-model-status (handle) handler called');
    return await checkModelStatus();
});

// IPC handler for retrying download
ipcMain.on('retry-model-download', () => {
    startDownload();
});

// IPC handler for opening model folder
ipcMain.on('open-model-folder', async () => {
    try {
        const modelDir = path.join(app.getPath('userData'), 'models', 'qwen2.5', 'main');
        await shell.openPath(modelDir);
    } catch (err) {
        error('[Main] Failed to open model folder:', err);
    }
});

// IPC handler for getting model path
ipcMain.handle('get-model-path', () => {
    if (!llmInitialized || !llmBridge) {
        return null;
    }
    return llmBridge.config.getModelDir();
});

// Start download process
function startDownload() {
    info('[Main] startDownload() called');
    if (!llmInitialized || !llmBridge) {
        error('[Main] Cannot start download - LLM not initialized');
        return;
    }

    const model = llmBridge.config.getTargetModel();
    info('[Main] Starting download of model:', model.id);

    // Note: LlamaBridge emits its own events (model-download-started, model-download-progress, model-download-complete)
    // which get forwarded to the renderer in the initializeLLM() function. We don't need to send duplicate events here.
    llmBridge.downloadModel('qwen:1.5b', (progress) => {
        // Progress is already being forwarded via LlamaBridge events
        // This callback is just for logging if needed
    }).then(result => {
        info('[Main] Model download result:', result);

        if (result.success) {
            info('[Main] Model download completed successfully, path:', result.path);

            // Re-check model status after a delay to ensure renderer has processed completion
            // Also send the ready status directly with the model path to avoid race conditions
            info('[Main] Re-checking model status after download (with delay)');
            setTimeout(() => {
                const model = llmBridge.config.getTargetModel();
                const modelPath = require('path').join(app.getPath('userData'), 'models', 'qwen2.5', 'main', model.filename);
                info('[Main] Sending ready status with modelPath:', modelPath);
                if (mainWindow) {
                    mainWindow.webContents.send('model-status', {
                        status: 'ready',
                        modelPath: modelPath,
                        model: model
                    });
                }
            }, 200);
        }
    }).catch(err => {
        error('[Main] Model download failed:', err);
    });
}

// Add IPC handlers for settings management
ipcMain.handle('settings-get', (event, key) => {
  if (!store) {
    warn('Store not initialized');
    return null;
  }
  if (key) {
    return store.get(key);
  }
  return store.store; // Return all settings if no key specified
});

ipcMain.handle('settings-set', (event, key, value) => {
  if (!store) {
    warn('Store not initialized');
    return false;
  }
  store.set(key, value);
  return true;
});

ipcMain.handle('settings-get-all', () => {
  if (!store) {
    warn('Store not initialized');
    return { llmModel: 'phi3:mini', enableLLM: true, fullscreen: false, windowPreset: 'Default' };
  }
  return {
    llmModel: store.get('llmModel'),
    enableLLM: store.get('enableLLM'),
    fullscreen: store.get('fullscreen'),
    windowPreset: store.get('windowPreset')
  };
});

ipcMain.handle('settings-clear', () => {
  if (!store) {
    warn('Store not initialized');
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
    if (store)     store.set('fullscreen', !!value);
    return true;
  } catch (e) {
    error('Failed to set fullscreen:', e);
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

// Add IPC handler for testing LLM connection
ipcMain.handle('llm-test-connection', async (event, { model }) => {
  try {
    if (!llmInitialized || !llmBridge) {
      return { 
        success: false, 
        error: 'LLM not initialized',
        errorType: 'NOT_INITIALIZED'
      };
    }
    
    const result = await llmBridge.testConnection(model);
    return result;
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      errorType: 'TEST_ERROR'
    };
  }
});

// IPC handlers for LLM model management

ipcMain.handle('llm-get-available-models', async () => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  try {
    const models = await llmBridge.getAvailableModels();
    return { success: true, models };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-get-downloaded-models', async () => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  try {
    const models = await llmBridge.getModels();
    return { success: true, models };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-download-model', async (event, { model }) => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  
  try {
    const onProgress = (progress) => {
      event.sender.send('llm-model-download-progress', progress);
    };
    
    const result = await llmBridge.downloadModel(model, onProgress);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-delete-model', async (event, { model }) => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  
  try {
    const result = await llmBridge.deleteModel(model);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-get-config', async () => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  try {
    const config = await llmBridge.getConfig();
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-set-model', async (event, { model }) => {
  if (!llmInitialized || !llmBridge) {
    return { success: false, error: 'LLM not initialized' };
  }
  try {
    const validation = llmBridge.setModel(model);
    return { success: validation.valid, ...validation };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
    await initializeStore();
    createWindow();

    // Initialize llama.cpp system
    const llmResult = await initializeLLM();
    info('LLM initialization result:', llmResult);

    // Notify renderer about LLM initialization status
    if (mainWindow) {
      mainWindow.webContents.send('llm-initialized', llmResult);
    }

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

app.on('window-all-closed', async () => {
  // Shut down llama.cpp when closing
  if (llmInitialized && llmBridge) {
    try {
      await llmBridge.shutdown();
      info('LLM system shut down');
    } catch (err) {
      error('Error shutting down LLM:', err);
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 