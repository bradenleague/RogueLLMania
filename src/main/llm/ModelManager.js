const { net } = require('electron');

class ModelManager {
  constructor(ollamaManager, configManager) {
    this.ollama = ollamaManager;
    this.config = configManager;
    this.activeDownloads = new Map();
  }

  async listModels() {
    try {
      const url = `${this.ollama.getBaseUrl()}/api/tags`;
      const response = await this._makeRequest(url, 'GET');
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  }

  async isModelDownloaded(modelName) {
    try {
      const models = await this.listModels();
      return models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));
    } catch (error) {
      return false;
    }
  }

  async downloadModel(modelName, options = {}) {
    const { onProgress, signal } = options;

    if (await this.isModelDownloaded(modelName)) {
      console.log('Model already downloaded:', modelName);
      return { success: true, message: 'Model already downloaded' };
    }

    const downloadKey = `${modelName}-${Date.now()}`;
    this.activeDownloads.set(downloadKey, { cancelled: false });

    try {
      const url = `${this.ollama.getBaseUrl()}/api/pull`;
      const payload = {
        model: modelName,
        stream: true
      };

      console.log('Downloading model:', modelName);
      
      const response = await this._makeRequest(url, 'POST', payload, {
        signal,
        onData: (data) => {
          if (signal?.aborted || this.activeDownloads.get(downloadKey)?.cancelled) {
            throw new Error('Download cancelled');
          }

          if (onProgress && data.total) {
            const percent = Math.round((data.completed / data.total) * 100);
            onProgress({
              modelName,
              percent,
              completed: data.completed,
              total: data.total,
              digest: data.digest,
              status: data.status
            });
          }
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      this.activeDownloads.delete(downloadKey);
      return { success: true, message: 'Model downloaded successfully' };
    } catch (error) {
      this.activeDownloads.delete(downloadKey);
      
      if (error.name === 'AbortError' || error.message === 'Download cancelled') {
        console.log('Download cancelled:', modelName);
        return { success: false, cancelled: true, message: 'Download cancelled' };
      }
      
      console.error('Error downloading model:', error);
      throw error;
    }
  }

  cancelDownload(modelName) {
    for (const [key, value] of this.activeDownloads.entries()) {
      if (key.startsWith(modelName) && !value.cancelled) {
        value.cancelled = true;
        console.log('Cancelling download:', key);
        return true;
      }
    }
    return false;
  }

  async getAvailableModels() {
    return this.config.get('models.recommended') || [];
  }

  async getDefaultModel() {
    const recommended = await this.getAvailableModels();
    return recommended.find(m => m.default)?.name || recommended[0]?.name;
  }

  async getRecommendedModel() {
    const mem = this.config.get('memory');
    const recommended = await this.getAvailableModels();
    
    const suitable = recommended.filter(m => m.ramRequired <= mem.total);
    
    if (mem.isLowMemory) {
      const lowMemModel = suitable.find(m => m.name === 'phi3:mini');
      if (lowMemModel) return lowMemModel;
    }
    
    return suitable.find(m => m.default) || suitable[0];
  }

  async deleteModel(modelName) {
    try {
      const url = `${this.ollama.getBaseUrl()}/api/delete`;
      const payload = { name: modelName };
      
      const response = await this._makeRequest(url, 'DELETE', payload);
      
      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.status}`);
      }

      return { success: true, message: 'Model deleted successfully' };
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }

  async getModelInfo(modelName) {
    try {
      const url = `${this.ollama.getBaseUrl()}/api/show`;
      const payload = { name: modelName };
      
      const response = await this._makeRequest(url, 'POST', payload);
      
      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting model info:', error);
      throw error;
    }
  }

  _makeRequest(url, method, body = null, options = {}) {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method,
        url,
        headers: body ? {
          'Content-Type': 'application/json'
        } : undefined
      });

      const dataChunks = [];

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          dataChunks.push(chunk);
          
          if (options.onData) {
            try {
              const text = Buffer.from(chunk).toString('utf-8');
              const lines = text.split('\n').filter(l => l.trim());
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  options.onData(data);
                } catch (e) {
                }
              }
            } catch (e) {
            }
          }
        });

        response.on('end', () => {
          const body = Buffer.concat(dataChunks).toString('utf-8');
          const response = {
            ok: true,
            status: 200,
            json: async () => JSON.parse(body),
            text: async () => body
          };
          resolve(response);
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          request.abort();
          reject(new Error('Request aborted'));
        });
      }

      if (body) {
        request.write(JSON.stringify(body));
      }

      request.end();
    });
  }
}

module.exports = ModelManager;