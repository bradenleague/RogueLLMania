// Settings management system using IPC to communicate with main process

const { ipcRenderer } = window.require('electron');

/**
 * Get the current ollama model setting
 * @returns {Promise<string>} The ollama model name
 */
export async function getOllamaModel() {
    return await ipcRenderer.invoke('settings-get', 'ollamaModel');
}

/**
 * Set the ollama model setting
 * @param {string} model The ollama model name
 * @returns {Promise<boolean>} Success status
 */
export async function setOllamaModel(model) {
    return await ipcRenderer.invoke('settings-set', 'ollamaModel', model);
}

/**
 * Get the LLM enable/disable setting
 * @returns {Promise<boolean>} Whether LLM is enabled
 */
export async function isLLMEnabled() {
    return await ipcRenderer.invoke('settings-get', 'enableLLM');
}

/**
 * Set the LLM enable/disable setting
 * @param {boolean} enabled Whether LLM should be enabled
 * @returns {Promise<boolean>} Success status
 */
export async function setLLMEnabled(enabled) {
    return await ipcRenderer.invoke('settings-set', 'enableLLM', enabled);
}

/**
 * Get all settings as an object
 * @returns {Promise<object>} All current settings
 */
export async function getAllSettings() {
    return await ipcRenderer.invoke('settings-get-all');
}

/**
 * Reset all settings to defaults
 * @returns {Promise<boolean>} Success status
 */
export async function resetSettings() {
    return await ipcRenderer.invoke('settings-clear');
}

/** Window controls **/
export async function getFullscreen() {
    return await ipcRenderer.invoke('window-get-fullscreen');
}

export async function setFullscreen(enabled) {
    return await ipcRenderer.invoke('window-set-fullscreen', !!enabled);
}

export async function applyWindowPreset(presetName) {
    return await ipcRenderer.invoke('window-apply-preset', presetName);
}