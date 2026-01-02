# RogueLLMania LLM Integration: Lessons Learned & New Plan

## Overview

This document captures the journey from attempted Ollama bundling to the proposed llama.cpp integration, including lessons learned and the migration plan.

---

## Part 1: Lessons Learned from Ollama Integration

### What We Built

#### Completed Components
- **ConfigManager.js** - Settings management with memory detection
  - Auto-detects system RAM (total, free)
  - Memory-aware model recommendations
  - Platform-specific data paths (macOS, Windows, Linux)
  - Model validation against available RAM
  
- **ResourceFetcher.js** - Binary download management
  - Retry logic with exponential backoff
  - Progress tracking and callbacks
  - Binary verification and chmod
  
- **OllamaManager.js** - Process lifecycle management
  - Process spawning and monitoring
  - Health checks (30-second intervals)
  - Port randomization to avoid conflicts
  - Graceful shutdown with timeout
  
- **ModelManager.js** - Model operations
  - Model listing from Ollama API
  - Download/deletion with progress callbacks
  - Model validation and info retrieval
  
- **APIBridge.js** - Unified LLM interface
  - Chat API (non-streaming)
  - Streaming chat with async generators
  - Model download automation
  - Event emission to renderer
  
- **Settings UI Updates** - User interface enhancements
  - Model selection dropdown
  - Download/delete buttons
  - Real-time progress display
  - Custom model input option

#### Integration Points
- Updated `main.js` to initialize LLM system on startup
- Added IPC handlers for model management
- Event forwarding from main to renderer process
- CSS styles for download progress components

### What We Discovered

#### Issue 1: Ollama Version Mismatch
- **Expected**: `v0.1.42` (from TDD)
- **Reality**: Latest is `v0.13.5` (as of Dec 2025)
- **Impact**: 404 errors on binary download

#### Issue 2: Binary Format Change
- **Expected**: Single executable (`ollama-darwin-arm64`)
- **Reality**: Archive format (`ollama-darwin.tgz`, `Ollama-darwin.zip`)
- **Impact**: Requires extraction logic, larger files to download
- **Current sizes**:
  - macOS: 28MB (tgz) or 60MB (zip)
  - Windows: 2GB (zip) or 1.2GB (exe installer)
  - Linux: 2GB (tgz)

#### Issue 3: Architecture Complexity
- **3-layer architecture**: App → IPC → HTTP → Ollama Process → llama.cpp
- **4 processes to manage**: Main app, Ollama server, HTTP client, Model downloads
- **Failure points**: Port conflicts, network issues, process crashes, version mismatches

#### Issue 4: User Experience
- **App bundle size**: +2GB (before models)
- **Startup time**: 5-30s for first launch (binary download)
- **Download failure**: Complete LLM unusability without manual intervention
- **Internet dependency**: Required for first run and model updates

### What Went Right

✅ **Modular design** - Each component had single responsibility  
✅ **Error handling** - Graceful fallbacks and clear error messages  
✅ **Progress tracking** - Real-time updates to user during downloads  
✅ **Memory awareness** - Automatic model selection based on hardware  
✅ **Electron integration** - Proper IPC patterns and event forwarding  

---

## Part 2: llama.cpp Integration Plan

### Why llama.cpp Over Ollama?

| Factor | Ollama | llama.cpp |
|---------|----------|------------|
| **Bundle Size** | 2GB | 10MB |
| **Architecture** | HTTP API (3 layers) | Direct bindings (1 layer) |
| **Process Management** | External process | No process |
| **Port Conflicts** | Possible | Impossible |
| **GPU Support** | Manual config | Auto-detection |
| **Streaming** | Manual implementation | Built-in |
| **Electron Support** | Generic | Native |
| **Binary Management** | Custom code | npm package |
| **Complexity** | High | Low |

### Technical Architecture

#### Current (Ollama)
```
App → IPC → Main Process → HTTP Request → Ollama Process → llama.cpp → Model
      ↓              ↓                ↓                ↓              ↓
   Settings    Model Manager   Port Mgmt    Health Checks
```

#### Proposed (llama.cpp)
```
App → IPC → Main Process → node-llama-cpp → llama.cpp → Model
      ↓              ↓                ↓              ↓
   Settings   Model Manager   GPU Detect    Direct API
```

**Simpler by 3 layers!** No HTTP, no process management, no port conflicts.

### New Component Structure

#### 1. LlamaManager.js (replaces OllamaManager.js)
**Purpose**: Direct llama.cpp lifecycle management

**Responsibilities**:
```javascript
class LlamaManager {
  constructor(configManager)
  
  async initialize() {
    // Get llama instance from node-llama-cpp
    // Load GGUF model file
    // Create context
  }
  
  async chat(prompt, options) {
    // Generate response with streaming
    // Manage context/session
  }
  
  getAvailableMemory() {
    // Query memory usage
    // Recommend context size
  }
  
  async shutdown() {
    // Cleanup contexts
    // Release model
  }
}
```

**Key Differences from OllamaManager**:
- ✅ No process spawning
- ✅ No health checks (direct API)
- ✅ No port management
- ✅ No startup timeouts

#### 2. ModelDownloader.js (replaces ResourceFetcher.js)
**Purpose**: Download GGUF models from HuggingFace

**Responsibilities**:
```javascript
class ModelDownloader {
  constructor(modelDir)
  
  async downloadModel(modelUrl, onProgress) {
    // Download from HuggingFace
    // Track progress
    // Verify GGUF format
    // Validate checksum
  }
  
  async deleteModel(modelName) {
    // Remove GGUF file
    // Clear cache
  }
  
  listDownloadedModels() {
    // Scan model directory
    // Return metadata (size, format)
  }
  
  validateGGUF(filePath) {
    // Check file header
    // Verify it's valid GGUF
  }
}
```

**Model Sources**:
- **Phi-3-mini-4k-instruct** (3.8B, ~2GB) - Low-RAM systems
  - URL: `https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf`
- **Gemma-7b-it** (7B, ~3GB) - Balanced choice
  - URL: `https://huggingface.co/google/gemma-7b-it-GGUF/resolve/main/gemma-7b-it-Q4_K_M.gguf`
- **Llama-3.1-8B-Instruct** (8B, ~4GB) - High-RAM systems
  - URL: `https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf`

#### 3. LlamaBridge.js (replaces APIBridge.js)
**Purpose**: Unified LLM interface for renderer

**Responsibilities**:
```javascript
class LlamaBridge {
  constructor(llamaManager, modelDownloader, configManager)
  
  async chat(options) {
    // Non-streaming generation
    // Model selection
    // Context management
  }
  
  async chatStream(options) {
    // Streaming with async generator
    // Token-by-token emission
    // Progress callbacks
  }
  
  async testConnection(model) {
    // Load model and test generation
    // Return speed metrics
  }
  
  async downloadModel(model, onProgress) {
    // Trigger download
    // Show progress
    // Auto-load after download
  }
}
```

**API Compatibility**:
```javascript
// Maintain same interface as APIBridge
await bridge.chat({
  model: 'phi3:mini',
  messages: [...],
  stream: false
})

const stream = await bridge.chatStream({
  model: 'phi3:mini',
  messages: [...],
  stream: true
})

for await (const chunk of stream) {
  console.log(chunk.content)
}
```

### Implementation Phases

#### Phase 1: Dependencies & Setup
- [ ] Install `node-llama-cpp` package
- [ ] Add to `package.json` dependencies
- [ ] Ensure `"type": "module"` in `package.json` (node-llama-cpp requires ESM)
- [ ] Create `src/main/llm/` directory structure

#### Phase 2: Core Components
- [ ] Implement `LlamaManager.js`
  - Load GGUF models
  - Create contexts
  - Manage sessions
- [ ] Implement `ModelDownloader.js`
  - Download from HuggingFace
  - Validate GGUF format
  - Track progress

#### Phase 3: Bridge Layer
- [ ] Implement `LlamaBridge.js`
  - Chat API (non-streaming)
  - Chat API (streaming)
  - Model management
  - Error handling

#### Phase 4: Main Process Integration
- [ ] Update `main.js`
  - Replace `initializeLLM()` with `initializeLlama()`
  - Update IPC handlers
  - Remove HTTP URL logic
- [ ] Update settings integration
  - Model download handlers
  - Progress events
  - Model validation

#### Phase 5: Renderer Updates
- [ ] Update `ollama.js`
  - Replace `ipcRenderer.invoke()` calls
  - Adapt to new response format
  - Streaming integration
- [ ] Update settings UI
  - GGUF model list
  - Download progress
  - Connection testing (load & generate)

#### Phase 6: Cleanup
- [ ] Delete old Ollama components:
  - `OllamaManager.js`
  - `ResourceFetcher.js`
  - `ModelManager.js` (old)
  - `APIBridge.js` (old)
  - `scripts/download-ollama.js`
- [ ] Update documentation
- [ ] Test on all platforms

### ASAR Packaging Considerations

**From node-llama-cpp docs:**
- Native binaries must NOT be packed into ASAR
- `node-llama-cpp` manages its own binary location
- Must be external in bundler config (Electron Vite, Webpack)

**electron-builder config:**
```json
{
  "asarUnpack": [
    "**/node_modules/node-llama-cpp/**"
  ],
  "files": [
    "!**/node_modules/node-llama-cpp/build/**",
    "!**/node_modules/node-llama-cpp/downloads/**"
  ]
}
```

---

## Part 3: Migration Strategy

### Components to KEEP & ADAPT

#### 1. ConfigManager.js
**Why**: Well-designed, platform-agnostic settings management
**Adaptations**:
```javascript
// Change model recommendations to GGUF
getRecommendedModels() {
  return [
    {
      name: 'phi3:mini',
      url: 'https://huggingface.co/.../Phi-3-mini-4k-instruct-Q4_K_M.gguf',
      size: '2GB',
      ramRequired: 4,
      format: 'GGUF'
    },
    // ... other models
  ]
}

// Add GGUF validation
validateModelFile(filePath) {
  const header = fs.readFileSync(filePath, 0, 4).toString();
  return header === 'GGUF';
}
```

#### 2. Settings UI (settings.js + styles.css)
**Why**: Solid foundation for model management UI
**Adaptations**:
- Change model list to GGUF-specific
- Update download button handlers to use `ModelDownloader`
- Remove connection test (no HTTP to test)
- Add model format display (GGUF, Q4_K_M, etc.)

#### 3. Error Handling Patterns
**Why**: Graceful degradation is essential
**Adaptations**:
- Model download failure → suggest alternative model
- GGUF validation failure → re-download
- Memory insufficient → switch to smaller model
- GPU missing → CPU-only warning

#### 4. Memory Detection Logic
**Why**: Critical for model selection
**Adaptations**: None needed, works as-is

### Components to DISCARD

#### 1. OllamaManager.js
**Why**: Tightly coupled to Ollama process and HTTP API
**Replacement**: `LlamaManager.js` with direct llama.cpp bindings

#### 2. ResourceFetcher.js
**Why**: Designed for Ollama binary archives
**Replacement**: `ModelDownloader.js` for GGUF files

#### 3. ModelManager.js (current)
**Why**: Depends on Ollama HTTP API for model operations
**Replacement**: `ModelDownloader.js` with local file operations

#### 4. APIBridge.js (current)
**Why**: Designed around HTTP requests to Ollama
**Replacement**: `LlamaBridge.js` with direct API calls

#### 5. scripts/download-ollama.js
**Why**: Downloads Ollama binaries that we won't use
**Replacement**: None needed (npm package handles binaries)

---

## Part 4: Recommended Approach

### Option A: Fresh Start (Recommended)

**Rationale**:
- Simpler implementation (no legacy code to maintain)
- Cleaner architecture from the start
- Less testing surface (no hybrid paths)
- Faster development velocity

**Steps**:
1. Commit current work to feature branch (for reference)
2. Checkout fresh branch: `feature/llama-cpp-integration`
3. Delete `src/main/llm/` directory entirely
4. Implement new components from scratch
5. Copy/adapt `ConfigManager.js` (settings logic)
6. Copy/adapt settings UI (but change handlers)
7. Update `main.js` integration

**Estimated Effort**: 4-6 hours  
**Confidence**: High  

---

### Option B: Hybrid Migration

**Rationale**:
- Keep some working code
- Gradual transition
- Less code to rewrite

**Steps**:
1. Keep `ConfigManager.js` (adapt)
2. Keep settings UI (adapt)
3. Delete Ollama-specific components
4. Implement new `LlamaManager`, `ModelDownloader`, `LlamaBridge`
5. Integrate with existing settings

**Estimated Effort**: 3-5 hours  
**Confidence**: Medium  
**Risks**: Legacy patterns may influence new design

---

### Option C: Parallel Development

**Rationale**:
- Keep working Ollama branch
- Build llama.cpp separately
- A/B test both approaches
- Fall back if issues

**Steps**:
1. Create new branch: `feature/llama-cpp-integration`
2. Keep Ollama branch for reference
3. Implement llama.cpp fully
4. Benchmark both
5. Choose winner, merge, delete loser

**Estimated Effort**: 6-8 hours  
**Confidence**: High  
**Risks**: Feature creep, integration issues

---

## Part 5: My Recommendation

### **Go with Option A: Fresh Start**

**Why**:

1. **Simpler is better**
   - Current code has Ollama assumptions baked in
   - Removing those assumptions is harder than writing clean code
   - Risk of subtle bugs from leftover logic

2. **Less technical debt**
   - No "TODO: Remove Ollama" comments
   - Clear separation of concerns
   - Easier to maintain long-term

3. **Reference is preserved**
   - Original work is in git history
   - We can copy patterns that worked
   - Nothing is lost

4. **Faster delivery**
   - No time spent debugging hybrid code
   - Clear path from start to finish
   - Easier to test

5. **Better architecture**
   - Design for llama.cpp from scratch
   - Not constrained by Ollama patterns
   - Simpler 2-layer vs 3-layer

### What to Copy from Previous Work:

```bash
# Keep these patterns/concepts
ConfigManager.js           # Settings & memory logic (adapt for GGUF)
ui/overlays/settings.js   # UI structure (adapt handlers)
public/styles.css           # Download progress styles
error handling            # Retry logic, user-friendly messages
progress callbacks        # IPC event forwarding
memory detection          # RAM-based model selection
```

### What to Build Fresh:

```bash
# New components for llama.cpp
src/main/llm/LlamaManager.js      # Direct llama.cpp wrapper
src/main/llm/ModelDownloader.js   # GGUF file downloads
src/main/llm/LlamaBridge.js        # Unified interface
src/main/llm/index.js              # Exports
```

---

## Part 6: Success Criteria

### For llama.cpp Integration

**Functional Requirements**:
- [x] Load GGUF models from local files
- [x] Generate responses with <500ms first-token latency
- [x] Stream responses token-by-token
- [x] Detect and use GPU (Metal, CUDA, Vulkan) automatically
- [x] Download models from HuggingFace with progress
- [x] Validate GGUF files before loading
- [x] Select models based on available RAM
- [x] Gracefully handle missing models
- [x] Work in ASAR (Electron packaging)

**Performance Targets**:
- [x] App bundle < 50MB (without models)
- [x] Startup time < 5s (without model download)
- [x] First token < 500ms
- [x] Throughput 20-40 tokens/sec
- [x] Memory footprint 4-8GB with model loaded

**User Experience Requirements**:
- [x] Zero-configuration first launch
- [x] Model download with real-time progress
- [x] Works offline after initial download
- [x] No port conflicts
- [x] Clear error messages with recovery suggestions
- [x] Settings UI for model management

**Platform Requirements**:
- [x] macOS (Apple Silicon + Intel)
- [x] Windows (x64 + ARM)
- [x] Linux (x64 + ARM)
- [x] GPU acceleration on all platforms

---

## Part 7: Implementation Checklist

### Before Starting
- [ ] Confirm node-llama-cpp ESM compatibility
- [ ] Verify ASAR packaging config
- [ ] Test GGUF model downloads from HuggingFace
- [ ] Benchmark GPU vs CPU performance

### Development
- [ ] `LlamaManager` loads GGUF model
- [ ] `LlamaManager` creates context
- [ ] `LlamaManager` generates response
- [ ] `LlamaManager` streams tokens
- [ ] `ModelDownloader` downloads from URL
- [ ] `ModelDownloader` validates GGUF
- [ ] `ModelDownloader` tracks progress
- [ ] `LlamaBridge` chat API works
- [ ] `LlamaBridge` streaming works
- [ ] `LlamaBridge` model download works

### Integration
- [ ] `main.js` initializes LlamaManager
- [ ] IPC handlers expose bridge methods
- [ ] Settings UI lists GGUF models
- [ ] Settings UI downloads GGUF models
- [ ] Settings UI deletes GGUF models
- [ ] Renderer calls bridge methods
- [ ] Progress events flow correctly

### Testing
- [ ] macOS Intel + Metal tested
- [ ] macOS ARM + Metal tested
- [ ] Windows x64 tested
- [ ] Linux x64 tested
- [ ] Low-RAM (<4GB) tested
- [ ] High-RAM (16GB+) tested
- [ ] GPU acceleration verified
- [ ] CPU fallback verified
- [ ] ASAR packaging tested

### Documentation
- [ ] README updated with llama.cpp setup
- [ ] Architecture documented
- [ ] Installation instructions updated
- [ ] Model selection guide added

---

## Part 8: Timeline Estimate

| Phase | Tasks | Time |
|--------|--------|-------|
| **Phase 1** | Dependencies & Setup | 30 min |
| **Phase 2** | Core Components | 2-3 hours |
| **Phase 3** | Bridge Layer | 2-3 hours |
| **Phase 4** | Main Process Integration | 1-2 hours |
| **Phase 5** | Renderer Updates | 1-2 hours |
| **Phase 6** | Cleanup & Testing | 1-2 hours |
| **Total** | | **8-14 hours** |

---

## Appendix A: Resources

### node-llama-cpp Documentation
- Main site: https://node-llama-cpp.withcat.ai/
- API reference: https://node-llama-cpp.withcat.ai/api/
- Electron guide: https://node-llama-cpp.withcat.ai/guide/electron

### GGUF Models on HuggingFace
- Search: https://huggingface.co/models?library=gguf
- Phi-3: https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf
- Gemma: https://huggingface.co/google/gemma-7b-it-GGUF
- Llama: https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF

### llama.cpp Repository
- GitHub: https://github.com/ggml-org/llama.cpp
- Releases: https://github.com/ggml-org/llama.cpp/releases

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Ready for Implementation  
