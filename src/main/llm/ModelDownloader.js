import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, statSync, renameSync, readdirSync, openSync, readSync, closeSync } from 'fs';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';
import { error, warn } from '../../systems/logger.js';

const inFlightDownloads = new Map();

async function getFinalUrl(url, maxRedirects = 5) {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const response = await new Promise((resolve, reject) => {
        const protocol = new URL(currentUrl).protocol === 'https:' ? https : http;

        const req = protocol.get(currentUrl, (res) => {
          resolve({ status: res.statusCode, location: res.headers.location });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Redirect check timeout'));
        });
      });

      if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
        redirectCount++;
        currentUrl = response.location;
      } else {
        return currentUrl;
      }
    } catch (error) {
      throw new Error(`Failed to resolve final URL: ${error.message}`);
    }
  }

  throw new Error(`Too many redirects (${maxRedirects})`);
}

async function getExpectedTotalFromUrl(url) {
  const protocol = new URL(url).protocol === 'https:' ? https : http;

  try {
    const response = await new Promise((resolve, reject) => {
      const req = protocol.get(url, { headers: { 'Range': 'bytes=0-0' } }, (res) => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          contentRange: res.headers['content-range']
        });
        res.resume();
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Total size fetch timeout'));
      });
    });

    if (response.statusCode === 206 || response.statusCode === 200) {
      const contentRange = response.contentRange;
      if (contentRange) {
        const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          return {
            start: parseInt(match[1], 10),
            end: parseInt(match[2], 10),
            total: parseInt(match[3], 10)
          };
        }
      }

      const contentLength = response.headers['content-length'];
      if (contentLength) {
        return {
          start: 0,
          end: parseInt(contentLength, 10) - 1,
          total: parseInt(contentLength, 10)
        };
      }
    }

    return null;
  } catch (err) {
    error('[ModelDownloader] Failed to fetch total size:', err);
    return null;
  }
}

function parseExpectedTotal(statusCode, headers) {
  const contentLength = headers['content-length'];
  const contentRange = headers['content-range'];

  if (statusCode === 200) {
    if (contentLength) {
      const parsed = parseInt(contentLength, 10);
      return {
        start: 0,
        end: parsed - 1,
        total: parsed
      };
    }
  }

  if (statusCode === 206) {
    if (contentRange) {
      const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (match) {
        const result = {
          start: parseInt(match[1], 10),
          end: parseInt(match[2], 10),
          total: parseInt(match[3], 10)
        };
        return result;
      }
    }
  }

  return null;
}

export class ModelDownloader {
  constructor(modelDir) {
    this.modelDir = modelDir;
    this.lastContentLength = null;
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!existsSync(this.modelDir)) {
      mkdirSync(this.modelDir, { recursive: true });
    }
  }

  getModelPath(modelName) {
    return join(this.modelDir, modelName);
  }

  async downloadModelResumable(model, onProgress) {
    const modelKey = model.id || model.filename;

    if (inFlightDownloads.has(modelKey)) {
      return inFlightDownloads.get(modelKey);
    }

    const downloadPromise = this._performDownload(model, onProgress);
    inFlightDownloads.set(modelKey, downloadPromise);

    try {
      const result = await downloadPromise;
      return result;
    } finally {
      inFlightDownloads.delete(modelKey);
    }
  }

  async _performDownload(model, onProgress) {
    const targetPath = join(this.modelDir, model.filename);
    const partialPath = targetPath + '.partial';

    if (existsSync(targetPath)) {
      const stats = statSync(targetPath);
      if (stats.size === model.expectedSize) {
        const validation = await this.validateModel(targetPath, model, null);
        if (validation.valid) {
          return {
            success: true,
            message: 'Model already downloaded and validated',
            path: targetPath,
            size: stats.size
          };
        } else {
          unlinkSync(targetPath);
        }
      } else {
        unlinkSync(targetPath);
      }
    }

    if (existsSync(partialPath)) {
      const partialStats = statSync(partialPath);
      console.log(`[ModelDownloader] Found partial file: ${partialStats.size} bytes`);

      const firstBytes = this.getFirstBytes(partialPath, 4);
      if (!firstBytes || firstBytes.header !== 'GGUF') {
        console.log('[ModelDownloader] Partial file has invalid GGUF header, deleting and restarting');
        unlinkSync(partialPath);
      } else {
        console.log('[ModelDownloader] Partial file has valid GGUF header, will resume');
      }
    }

    const finalUrl = await getFinalUrl(model.url);
    console.log(`[ModelDownloader] Final download URL: ${finalUrl}`);

    return new Promise((resolve, reject) => {
      let startByte = 0;
      if (existsSync(partialPath)) {
        const stats = statSync(partialPath);
        startByte = stats.size;
        console.log(`[ModelDownloader] Resuming download from byte ${startByte}`);
      }

      const protocol = new URL(finalUrl).protocol === 'https:' ? https : http;
      let downloadedBytes = startByte;
      let totalBytes = model.expectedSize;
      let startTime = Date.now();

      const options = startByte > 0 ? { headers: { 'Range': `bytes=${startByte}-` } } : {};

      const request = protocol.get(finalUrl, options, async (response) => {
        console.log(`[ModelDownloader] Response status: ${response.statusCode}`);
        console.log(`[ModelDownloader] Response headers:`, JSON.stringify({
          'content-length': response.headers['content-length'],
          'content-range': response.headers['content-range']
        }));

        const rangeInfo = parseExpectedTotal(response.statusCode, response.headers);
        if (rangeInfo !== null) {
          if (response.statusCode === 206) {
            if (startByte > 0 && rangeInfo.start !== startByte) {
              warn(`[ModelDownloader] Warning: Range mismatch - requested ${startByte}, got ${rangeInfo.start}`);
            }
          }
          this.lastContentLength = rangeInfo.total;
          totalBytes = rangeInfo.total;
          console.log(`[ModelDownloader] Expected total size: ${totalBytes} bytes`);
          if (response.statusCode === 206) {
            console.log(`[ModelDownloader] Content-Range: bytes ${rangeInfo.start}-${rangeInfo.end}/${rangeInfo.total}`);
          }
        } else {
          console.log(`[ModelDownloader] Could not parse total size from headers, falling back to expected size: ${model.expectedSize} bytes`);
          totalBytes = model.expectedSize;
        }

        if (response.statusCode === 416) {
          console.log('[ModelDownloader] Range not satisfiable, fetching real total size');
          if (existsSync(partialPath)) {
            const stats = statSync(partialPath);
            const rangeInfo = await getExpectedTotalFromUrl(finalUrl);

            if (rangeInfo !== null) {
              totalBytes = rangeInfo.total;
              console.log(`[ModelDownloader] Real total size from server: ${totalBytes} bytes`);
            } else {
              console.log(`[ModelDownloader] Could not fetch total size from server, using expected size: ${model.expectedSize}`);
              totalBytes = model.expectedSize;
            }

            console.log(`[ModelDownloader] Partial file size: ${stats.size}, Total: ${totalBytes}`);

            if (stats.size >= totalBytes) {
              console.log('[ModelDownloader] Partial file complete, validating');
              this.validateModel(partialPath, model, totalBytes)
                .then(validationResult => {
                  if (validationResult.valid) {
                    renameSync(partialPath, targetPath);
                    resolve({ success: true, message: 'Download complete', path: targetPath, size: totalBytes });
                  } else {
                    console.log(`[ModelDownloader] Validation failed: ${validationResult.reason}`);
                    if (validationResult.reason === 'hash') {
                      console.log('[ModelDownloader] Checksum mismatch, deleting partial file');
                      unlinkSync(partialPath);
                      reject(new Error('Downloaded file checksum mismatch'));
                    } else if (validationResult.reason === 'header') {
                      const firstBytes = this.getFirstBytes(partialPath, 16);
                      console.log('[ModelDownloader] Invalid GGUF header detected');
                      console.log('[ModelDownloader] First 16 bytes (hex):', firstBytes ? firstBytes.hex : 'N/A');
                      console.log('[ModelDownloader] First 4 bytes (ASCII):', firstBytes ? firstBytes.header : 'N/A');
                      console.log('[ModelDownloader] Download URL:', model.url);
                      console.log('[ModelDownloader] Expected filename:', model.filename);
                      console.log('[ModelDownloader] Keeping partial file for manual inspection');
                      reject(new Error('Downloaded file has invalid GGUF header. File may be corrupted.'));
                    } else {
                      console.log(`[ModelDownloader] Keeping partial file (${stats.size}/${totalBytes} bytes) for resume`);
                      reject(new Error(`Download incomplete (${stats.size}/${totalBytes} bytes)`));
                    }
                  }
                })
                .catch(reject);
              return;
            } else {
              console.log(`[ModelDownloader] Partial file too small (${stats.size}/${totalBytes}), keeping for resume`);
              reject(new Error(`Download incomplete (${stats.size}/${totalBytes} bytes)`));
            }
          } else {
            reject(new Error('Range not satisfiable, no partial file found'));
          }
          return;
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const fileStream = createWriteStream(partialPath, { flags: startByte > 0 ? 'a' : 'w' });

        let headerValidated = startByte > 0;

        response.on('data', (chunk) => {
          if (!headerValidated) {
            const header = chunk.toString('ascii', 0, 4);
            if (header !== 'GGUF') {
              error('[ModelDownloader] Invalid GGUF header detected in first chunk, aborting download');
              error('[ModelDownloader] First 4 bytes:', header);
              error('[ModelDownloader] First 16 bytes (hex):', chunk.subarray(0, Math.min(16, chunk.length)).toString('hex'));
              fileStream.destroy();
              request.destroy();
              unlinkSync(partialPath);
              reject(new Error('Invalid GGUF header detected. Wrong file type or corrupted server response.'));
              return;
            }
            headerValidated = true;
            console.log('[ModelDownloader] GGUF header validated in first chunk');
          }

          downloadedBytes += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const speedMB = elapsed > 0 ? (chunk.length / (1024 * 1024)) / elapsed : 0;

          if (onProgress && totalBytes > 0) {
            const percent = Math.min((downloadedBytes / totalBytes) * 100, 100);
            onProgress({
              type: 'downloading',
              downloaded: downloadedBytes,
              total: totalBytes,
              percent,
              speed: speedMB
            });
          }
        });

        pipeline(response, fileStream)
          .then(() => {
            const finalSize = statSync(partialPath).size;
            console.log(`[ModelDownloader] Pipeline complete, partial file size: ${finalSize}`);

            if (onProgress) {
              onProgress({
                type: 'verifying',
                downloaded: finalSize,
                total: totalBytes,
                percent: Math.min((finalSize / totalBytes) * 100, 100),
                speed: 0
              });
            }

            this.validateModel(partialPath, model, totalBytes)
              .then(validationResult => {
                if (validationResult.valid) {
                  renameSync(partialPath, targetPath);
                  console.log(`[ModelDownloader] Renamed to: ${targetPath}`);

                  if (onProgress) {
                    onProgress({
                      type: 'complete',
                      downloaded: totalBytes,
                      total: totalBytes,
                      percent: 100,
                      speed: 0
                    });
                  }
                  resolve({
                    success: true,
                    message: 'Download complete',
                    path: targetPath,
                    size: totalBytes
                  });
                } else {
                  const partialSize = statSync(partialPath).size;

                  if (validationResult.reason === 'hash') {
                    console.log('[ModelDownloader] Checksum mismatch after download complete, deleting partial file');
                    unlinkSync(partialPath);
                    reject(new Error('Downloaded file checksum mismatch'));
                  } else if (validationResult.reason === 'header') {
                    const firstBytes = this.getFirstBytes(partialPath, 16);
                    console.log('[ModelDownloader] Invalid GGUF header detected after download complete');
                    console.log('[ModelDownloader] First 16 bytes (hex):', firstBytes ? firstBytes.hex : 'N/A');
                    console.log('[ModelDownloader] First 4 bytes (ASCII):', firstBytes ? firstBytes.header : 'N/A');
                    console.log('[ModelDownloader] Download URL:', model.url);
                    console.log('[ModelDownloader] Expected filename:', model.filename);
                    console.log('[ModelDownloader] Partial file path:', partialPath);
                    console.log('[ModelDownloader] Keeping partial file for manual inspection');
                    reject(new Error('Downloaded file has invalid GGUF header. File may be corrupted.'));
                  } else {
                    console.log(`[ModelDownloader] Download incomplete (${partialSize}/${totalBytes} bytes). Keeping partial file for resume.`);
                    reject(new Error(`Download incomplete (${partialSize}/${totalBytes} bytes)`));
                  }
                }
              })
              .catch(reject);
          })
          .catch(reject);
      });

      request.on('error', (error) => {
        error('[ModelDownloader] Request error:', error);
        if (existsSync(partialPath) && statSync(partialPath).size === 0) {
          unlinkSync(partialPath).catch(() => {});
        }
        reject(error);
      });

      request.setTimeout(3600000, () => {
        error('[ModelDownloader] Request timeout');
        request.destroy();
        reject(new Error('Download timeout (60 minutes)'));
      });
    });
  }

  async deleteModel(modelName) {
    try {
      const modelPath = this.getModelPath(modelName);

      if (!existsSync(modelPath)) {
        return { success: false, error: 'Model file not found' };
      }

      unlinkSync(modelPath);

      const partialPath = modelPath + '.partial';
      if (existsSync(partialPath)) {
        unlinkSync(partialPath).catch(() => {});
      }

      return {
        success: true,
        message: 'Model deleted successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  listDownloadedModels() {
    try {
      const files = [];
      const entries = readdirSync(this.modelDir);

      for (const entry of entries) {
        const fullPath = join(this.modelDir, entry);
        const stats = statSync(fullPath);

        if (stats.isFile() && entry.endsWith('.gguf') && !entry.endsWith('.partial')) {
          const isValid = this.validateGGUFSync(fullPath);

          if (isValid) {
            files.push({
              name: entry,
              path: fullPath,
              size: stats.size,
              sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
              format: 'GGUF'
            });
          }
        }
      }

      return files.sort((a, b) => b.size - a.size);
      } catch (err) {
        error('Failed to list models:', err);
      return [];
    }
  }

  async validateGGUF(filePath) {
    try {
      const buffer = Buffer.alloc(4);
      const file = await createReadStream(filePath);

      await new Promise((resolve, reject) => {
        file.once('readable', () => {
          const bytesRead = file.read(buffer, 0, 4);
          file.close();

          if (bytesRead !== 4) {
            reject(new Error('Could not read file header'));
            return;
          }

          const header = buffer.toString('ascii', 0, 4);
          if (header !== 'GGUF') {
            reject(new Error('Invalid GGUF header'));
            return;
          }

          resolve();
        });
      });

      return true;
    } catch (err) {
      error('GGUF validation failed:', err);
      return false;
    }
  }

  validateGGUFSync(filePath) {
    try {
      const fd = openSync(filePath, 'r');
      const buffer = Buffer.alloc(4);
      readSync(fd, buffer, 0, 4, 0);
      closeSync(fd);

      const header = buffer.toString('ascii', 0, 4);
      return header === 'GGUF';
    } catch (error) {
      return false;
    }
  }

  getFirstBytes(filePath, byteCount = 16) {
    try {
      const fd = openSync(filePath, 'r');
      const buffer = Buffer.alloc(byteCount);
      const bytesRead = readSync(fd, buffer, 0, byteCount, 0);
      closeSync(fd);

      return {
        header: buffer.toString('ascii', 0, 4),
        hex: buffer.subarray(0, bytesRead).toString('hex'),
        bytes: bytesRead
      };
  } catch (err) {
    error(`[ModelDownloader] getFirstBytes error for ${filePath}:`, err);
      return null;
    }
  }

  async validateModel(filePath, model, contentLength = null) {
    try {
      console.log(`[ModelDownloader] Validating model at ${filePath}`);

      const stats = statSync(filePath);
      const expectedSize = contentLength || model.expectedSize;

      if (stats.size !== expectedSize) {
        console.log(`[ModelDownloader] Size mismatch: expected ${expectedSize}, got ${stats.size}`);
        return { valid: false, reason: 'size' };
      }

      if (!this.validateGGUFSync(filePath)) {
        console.log('[ModelDownloader] Invalid GGUF header');
        return { valid: false, reason: 'header' };
      }

      const hash = await this.computeSHA256(filePath);
      console.log(`[ModelDownloader] SHA256 computed: ${hash}, expected: ${model.sha256}`);
      if (hash !== model.sha256) {
        console.log(`[ModelDownloader] SHA256 mismatch: expected ${model.sha256}, got ${hash}`);
        return { valid: false, reason: 'hash' };
      }

      console.log('[ModelDownloader] Model validation successful');
      return { valid: true };
  } catch (err) {
    error('[ModelDownloader] Model validation failed:', err);
      return { valid: false, reason: 'error', error: error.message };
    }
  }

  async computeSHA256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });
  }

  getModelInfo(modelPath) {
    try {
      const stats = statSync(modelPath);
      const isValid = this.validateGGUFSync(modelPath);

      return {
        path: modelPath,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        isValid,
        format: isValid ? 'GGUF' : 'Unknown'
      };
    } catch (error) {
      return null;
    }
  }
}
