const { net } = require('electron');
const { EventEmitter } = require('events');

class APIBridge extends EventEmitter {
  constructor(ollamaManager, modelManager, configManager) {
    super();
    this.ollama = ollamaManager;
    this.models = modelManager;
    this.config = configManager;
    this.activeRequests = new Map();
  }

  async chat(options) {
    const { model, messages, temperature, maxTokens } = options;
    
    try {
      await this._ensureReady(model);
      
      const url = `${this.ollama.getBaseUrl()}/api/generate`;
      const prompt = this._messagesToPrompt(messages);
      
      const payload = {
        model,
        prompt,
        stream: false,
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens || 1000
        }
      };

      const response = await this._makeRequest(url, 'POST', payload);
      
      if (!response.ok) {
        throw this._handleError(response.status);
      }

      const data = await response.json();
      
      return {
        content: data.response,
        model,
        tokens: {
          prompt: data.prompt_eval_count || 0,
          completion: data.eval_count || 0,
          total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      };
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async chatStream(options) {
    const { model, messages, temperature, maxTokens } = options;
    
    try {
      await this._ensureReady(model);
      
      const url = `${this.ollama.getBaseUrl()}/api/generate`;
      const prompt = this._messagesToPrompt(messages);
      
      const requestId = `stream-${Date.now()}`;
      
      const payload = {
        model,
        prompt,
        stream: true,
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens || 1000
        }
      };

      return this._createStream(url, payload, requestId);
    } catch (error) {
      console.error('Chat stream error:', error);
      throw error;
    }
  }

  _createStream(url, payload, requestId) {
    const self = this;
    let cancelled = false;
    this.activeRequests.set(requestId, { cancelled });

    async function* generator() {
      try {
        let buffer = [];
        let accumulatedChunks = [];

        const result = await new Promise((resolve, reject) => {
          const request = net.request({
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' }
          });

          request.on('response', (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`Request failed: ${response.statusCode}`));
              return;
            }

            response.on('data', (chunk) => {
              if (cancelled) {
                request.abort();
                return;
              }

              buffer.push(chunk);
              const text = Buffer.concat(buffer).toString('utf-8');
              buffer = [];
              
              const lines = text.split('\n').filter(l => l.trim());
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  
                  if (data.response) {
                    accumulatedChunks.push({
                      content: data.response,
                      done: data.done
                    });
                  }
                  
                  if (data.done) {
                    resolve(accumulatedChunks);
                    return;
                  }
                } catch (e) {
                }
              }
            });

            response.on('end', () => {
              if (accumulatedChunks.length === 0) {
                reject(new Error('Stream ended with no data'));
              } else {
                resolve(accumulatedChunks);
              }
            });

            response.on('error', (error) => {
              reject(error);
            });
          });

          request.on('error', (error) => {
            reject(error);
          });

          request.write(JSON.stringify(payload));
          request.end();
        });

        for (const chunk of result) {
          if (cancelled) break;
          yield chunk;
        }
      } finally {
        self.activeRequests.delete(requestId);
      }
    }

    const stream = generator();
    
    stream.cancel = () => {
      cancelled = true;
      const req = this.activeRequests.get(requestId);
      if (req) req.cancelled = true;
    };

    return stream;
  }

  _messagesToPrompt(messages) {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  _ensureReady(model) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.ollama.ready) {
          console.log('Ollama not ready, starting...');
          await this.ollama.start();
        }

        const isDownloaded = await this.models.isModelDownloaded(model);
        
        if (!isDownloaded) {
          console.log('Model not downloaded, triggering download:', model);
          
          this.emit('model-download-started', { model });
          
          try {
            await this.models.downloadModel(model, {
              onProgress: (progress) => {
                this.emit('model-download-progress', progress);
              }
            });
            this.emit('model-download-complete', { model });
          } catch (error) {
            this.emit('model-download-error', { model, error: error.message });
            throw new Error(`Failed to download model: ${error.message}`);
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async _makeRequest(url, method, body = null) {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method,
        url,
        headers: body ? { 'Content-Type': 'application/json' } : undefined
      });

      const dataChunks = [];

      request.on('response', (response) => {
        response.on('data', (chunk) => dataChunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(dataChunks).toString('utf-8');
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            json: async () => JSON.parse(body),
            text: async () => body
          });
        });
        response.on('error', reject);
      });

      request.on('error', reject);

      if (body) {
        request.write(JSON.stringify(body));
      }
      request.end();
    });
  }

  _handleError(status) {
    switch (status) {
      case 404:
        return new Error('Model not found');
      case 400:
        return new Error('Bad request');
      case 500:
        return new Error('Ollama server error');
      case 503:
        return new Error('Ollama service unavailable');
      default:
        return new Error(`Request failed with status ${status}`);
    }
  }

  async testConnection(model) {
    try {
      await this._ensureReady(model);
      
      const result = await this.chat({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10
      });

      return {
        success: true,
        message: 'Connection successful',
        model
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model
      };
    }
  }

  async getModels() {
    return this.models.listModels();
  }

  async getAvailableModels() {
    return this.models.getAvailableModels();
  }

  async downloadModel(model, onProgress) {
    return this.models.downloadModel(model, { onProgress });
  }

  async deleteModel(model) {
    return this.models.deleteModel(model);
  }

  async getConfig() {
    return this.config.getAll();
  }

  setModel(model) {
    return this.config.validateModelChoice(model);
  }

  async shutdown() {
    await this.ollama.stop();
  }
}

module.exports = APIBridge;