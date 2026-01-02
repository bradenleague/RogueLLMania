const path = require('path');
const ResourceFetcher = require('../src/main/llm/ResourceFetcher');

async function downloadOllama() {
  console.log('Downloading Ollama binary...');
  
  const binaryDir = path.join(process.cwd(), 'resources', 'ollama-binaries');
  
  const fetcher = new ResourceFetcher({
    binaryDir,
    onProgress: (progress) => {
      const percent = progress.total 
        ? `${progress.percent}%` 
        : `${(progress.downloaded / 1024 / 1024).toFixed(1)}MB`;
      
      const speed = progress.speed 
        ? `${(progress.speed / 1024 / 1024).toFixed(2)} MB/s` 
        : '';
      
      console.log(`Download: ${percent} ${speed}`);
    }
  });

  try {
    const binaryPath = await fetcher.downloadBinary(true);
    console.log('✓ Ollama binary downloaded to:', binaryPath);
  } catch (error) {
    console.error('✗ Failed to download Ollama:', error.message);
    process.exit(1);
  }
}

downloadOllama();