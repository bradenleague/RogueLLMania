const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { net } = require('electron');

class OllamaManager {
  constructor(configManager, resourceFetcher) {
    this.config = configManager;
    this.fetcher = resourceFetcher;
    this.process = null;
    this.ready = false;
    this.port = null;
    this.healthCheckInterval = null;
    this.startupPromise = null;
  }

  async initialize() {
    await this.config.ensureDirectories();
    const binaryPath = await this.fetcher.downloadBinary();
    
    const verification = await this.fetcher.verifyBinary(binaryPath);
    if (!verification.valid) {
      throw new Error(`Invalid binary: ${verification.reason}`);
    }

    console.log('Ollama binary verified:', binaryPath);
    return binaryPath;
  }

  async start() {
    if (this.process && this.process.pid) {
      console.log('Ollama already running:', this.process.pid);
      return this.startupPromise;
    }

    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this._startProcess();
    return this.startupPromise;
  }

  async _startProcess() {
    try {
      const binaryPath = await this.initialize();
      this.port = this._findAvailablePort();

      console.log('Starting Ollama on port', this.port, 'with binary:', binaryPath);

      const env = {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${this.port}`
      };

      const args = ['serve'];
      
      this.process = spawn(binaryPath, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      this.process.stdout.on('data', (data) => {
        console.log('[Ollama stdout]', data.toString());
      });

      this.process.stderr.on('data', (data) => {
        console.log('[Ollama stderr]', data.toString());
      });

      this.process.on('exit', (code, signal) => {
        console.log(`Ollama process exited: code=${code}, signal=${signal}`);
        this.ready = false;
        this.process = null;
        this.stopHealthCheck();
      });

      this.process.on('error', (error) => {
        console.error('[Ollama error]', error);
        this.ready = false;
        this.process = null;
        this.stopHealthCheck();
      });

      await this._waitForReady();
      this.startHealthCheck();

      console.log('Ollama started successfully on port', this.port);
      return { port: this.port, pid: this.process.pid };
    } catch (error) {
      this.startupPromise = null;
      throw error;
    }
  }

  async _waitForReady() {
    const timeout = this.config.get('ollama.startupTimeout') || 30000;
    const startTime = Date.now();
    const maxRetries = Math.ceil(timeout / 500);

    for (let i = 0; i < maxRetries; i++) {
      try {
        const ready = await this._checkHealth();
        if (ready) {
          this.ready = true;
          return;
        }
      } catch (error) {
        if (i % 10 === 0) {
          console.log(`Waiting for Ollama to start... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Ollama startup timeout after ${timeout}ms`);
  }

  _checkHealth() {
    return new Promise((resolve, reject) => {
      const url = `http://127.0.0.1:${this.port}/api/version`;
      const request = net.request(url);

      request.on('response', (response) => {
        if (response.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`Health check failed: ${response.statusCode}`));
        }
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this._checkHealth();
        this.ready = true;
      } catch (error) {
        console.warn('Health check failed:', error);
        this.ready = false;
      }
    }, 30000);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async stop() {
    console.log('Stopping Ollama...');
    this.stopHealthCheck();

    if (this.process) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Ollama did not exit gracefully, killing...');
          this.process.kill('SIGKILL');
          this.process = null;
          this.ready = false;
          this.startupPromise = null;
          resolve();
        }, 5000);

        this.process.once('exit', () => {
          clearTimeout(timeout);
          this.process = null;
          this.ready = false;
          this.startupPromise = null;
          console.log('Ollama stopped');
          resolve();
        });

        try {
          this.process.kill('SIGTERM');
        } catch (error) {
          clearTimeout(timeout);
          console.error('Error stopping Ollama:', error);
          this.process = null;
          this.ready = false;
          this.startupPromise = null;
          resolve();
        }
      });
    }
  }

  getBaseUrl() {
    if (!this.ready || !this.port) {
      throw new Error('Ollama is not ready');
    }
    return `http://127.0.0.1:${this.port}`;
  }

  _findAvailablePort() {
    const startPort = this.config.get('ollama.port') || 11434;
    
    for (let port = startPort; port < startPort + 100; port++) {
      try {
        const net = require('net');
        const server = net.createServer();
        server.listen(port);
        server.close();
        return port;
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('Could not find available port');
  }

  isRunning() {
    return !!(this.process && this.process.pid && !this.process.killed);
  }
}

module.exports = OllamaManager;