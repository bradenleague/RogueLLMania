import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { createLlamaSystem } from './main/llm/index.js';
import { info, error, warn, debug } from './systems/logger.js';

let mainWindow;
let store; // Will be initialized with dynamic import
let llmBridge; // New LLM bridge instance
let llmInitialized = false;

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
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-started', data);
            }
        });

        llamaSystem.bridge.on('model-download-progress', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-progress', data);
            }
        });

        llamaSystem.bridge.on('model-download-complete', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('llm-model-download-complete', data);
            }
        });

        llamaSystem.bridge.on('model-download-error', (data) => {
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

// Check for model and download if needed
async function checkAndDownloadModel() {
    try {
        const { existsSync } = await import('fs');
        const { join } = await import('path');
        const model = llmBridge.config.getTargetModel();
        const modelPath = join(app.getPath('userData'), 'models', 'qwen2.5', 'main', model.filename);

        if (!existsSync(modelPath)) {
            info('[Main] Model not found, starting download');

            // Notify renderer to show FTUE
            if (mainWindow) {
                mainWindow.webContents.send('model-download-starting', {
                    name: model.name,
                    sizeGB: model.sizeGB
                });
            }

            try {
                const downloadResult = await llmBridge.downloadModel('qwen:1.5b', (progress) => {
                    if (mainWindow) {
                        mainWindow.webContents.send('model-download-progress', progress);
                    }
                });

                info('[Main] Model download result:', downloadResult);

                if (downloadResult.success) {
                    info('[Main] Model download completed successfully');

                    // Download complete
                    if (mainWindow) {
                        mainWindow.webContents.send('model-download-complete');
                    }
                } else {
                    throw new Error(downloadResult.error || 'Download failed with unknown error');
                }
            } catch (err) {
                error('[Main] Model download failed:', err);
                if (mainWindow) {
                    mainWindow.webContents.send('model-download-error', { error: err.message });
                }
            }
        } else {
            info('[Main] Model already downloaded, skipping download');
        }
    } catch (err) {
        error('[Main] Error checking for model:', err);
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

      // Check and download model if needed
      if (llmResult.success) {
        await checkAndDownloadModel();
      }
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