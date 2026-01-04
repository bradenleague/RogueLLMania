import { LlamaManager } from './LlamaManager.js';
import { ModelDownloader } from './ModelDownloader.js';
import { ConfigManager } from './ConfigManager.js';
import { LlamaBridge } from './LlamaBridge.js';

export { LlamaManager, ModelDownloader, ConfigManager, LlamaBridge };

export async function createLlamaSystem(options = {}) {
  const { appDataPath } = options;
  
  const config = new ConfigManager({ appDataPath });
  const modelDownloader = new ModelDownloader(config.getModelDir());
  const llamaManager = new LlamaManager(config);
  const bridge = new LlamaBridge(llamaManager, modelDownloader, config);
  
  return {
    config,
    modelDownloader,
    llamaManager,
    bridge
  };
}
