// Settings management system using IPC to communicate with main process

const { ipcRenderer } = window.require('electron');

/**
 * Get current LLM model setting
 * @returns {Promise<string>} The LLM model name
 */
export async function getLLMModel() {
    return await ipcRenderer.invoke('settings-get', 'llmModel');
}

/**
 * Set LLM model setting
 * @param {string} model The LLM model name
 * @returns {Promise<boolean>} Success status
 */
export async function setLLMModel(model) {
    return await ipcRenderer.invoke('settings-set', 'llmModel', model);
}

/**
 * Get LLM enable/disable setting
 * @returns {Promise<boolean>} Whether LLM is enabled
 */
export async function isLLMEnabled() {
    return await ipcRenderer.invoke('settings-get', 'enableLLM');
}

/**
 * Set LLM enable/disable setting
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
