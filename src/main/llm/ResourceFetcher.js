const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ResourceFetcher {
  constructor(options = {}) {
    this.binaryDir = options.binaryDir;
    this.onProgress = options.onProgress || (() => {});
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 60000;
  }

  getBinaryUrls() {
    const platform = process.platform;
    const arch = process.arch;
    const baseVersion = 'v0.1.42';

    const urls = {
      'darwin-arm64': `https://github.com/ollama/ollama/releases/download/${baseVersion}/ollama-darwin-arm64`,
      'darwin-x64': `https://github.com/ollama/ollama/releases/download/${baseVersion}/ollama-darwin-amd64`,
      'win32-x64': `https://github.com/ollama/ollama/releases/download/${baseVersion}/ollama-windows-amd64.exe`,
      'linux-x64': `https://github.com/ollama/ollama/releases/download/${baseVersion}/ollama-linux-amd64`
    };

    const key = `${platform}-${arch}`;
    return urls[key] || null;
  }

  getBinaryName() {
    const platform = process.platform;
    if (platform === 'darwin') {
      return 'ollama-darwin';
    } else if (platform === 'win32') {
      return 'ollama.exe';
    } else {
      return 'ollama-linux';
    }
  }

  async downloadBinary(force = false) {
    const url = this.getBinaryUrls();
    if (!url) {
      throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
    }

    const binaryName = this.getBinaryName();
    const binaryPath = path.join(this.binaryDir, binaryName);

    if (fs.existsSync(binaryPath) && !force) {
      console.log('Binary already exists:', binaryPath);
      return binaryPath;
    }

    await this.ensureDirectory();

    console.log('Downloading Ollama binary from:', url);
    const startTime = Date.now();

    const tempPath = binaryPath + '.download';

    await this.downloadWithRetry(url, tempPath, {
      onProgress: (downloaded, total) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = downloaded / elapsed;
        const percent = total ? Math.round((downloaded / total) * 100) : 0;
        this.onProgress({
          type: 'binary',
          downloaded,
          total,
          percent,
          speed,
          elapsed
        });
      }
    });

    await fs.promises.chmod(tempPath, 0o755);
    await fs.promises.rename(tempPath, binaryPath);

    console.log('Download complete:', binaryPath);
    return binaryPath;
  }

  async downloadWithRetry(url, destination, options = {}) {
    let lastError;
    const maxRetries = options.maxRetries || this.maxRetries;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.downloadFile(url, destination, options);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Download attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Download failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  downloadFile(url, destination, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destination);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const req = protocol.get(url, { timeout: this.timeout }, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destination);
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        totalBytes = parseInt(res.headers['content-length'], 10);

        res.pipe(file);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (options.onProgress) {
            options.onProgress(downloadedBytes, totalBytes);
          }
        });

        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      req.on('error', (error) => {
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(error);
      });

      req.setTimeout(this.timeout, () => {
        req.abort();
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(new Error('Download timeout'));
      });
    });
  }

  async ensureDirectory() {
    await fs.promises.mkdir(this.binaryDir, { recursive: true });
  }

  async verifyBinary(binaryPath) {
    if (!fs.existsSync(binaryPath)) {
      return { valid: false, reason: 'Binary not found' };
    }

    const stats = fs.statSync(binaryPath);
    const fileSize = stats.size;

    if (fileSize < 1024 * 1024) {
      return { valid: false, reason: 'Binary too small (<1MB)' };
    }

    return { valid: true, size: fileSize };
  }
}

module.exports = ResourceFetcher;