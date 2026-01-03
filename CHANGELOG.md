# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0

- **LLM Integration Overhaul**
  - Replaced external Ollama dependency with local llama.cpp integration
  - Added automatic model download (Qwen2.5-1.5B-Instruct @ Q4_K_M)
  - Implemented resumable downloads with SHA256 verification
  - Added First-Time User Experience (FTUE) overlay for model download
  - Real-time download progress tracking (percentage, speed)
  - Native streaming support with token-by-token emission
  - Removed HTTP API dependency - direct llama.cpp bindings
  - Model validation (GGUF header, SHA256, file size)

## 0.1.0

- Initial public release
- Core gameplay loop with 8-directional movement and turn engine
- Procedural level generation with multiple level types
- Inventory system and item pickup
- Save (Cmd/Ctrl+S) and Load (Cmd/Ctrl+L)
- Restart on Game Over (R)
- LLM-powered level introductions via Ollama (default model `gemma3n:e4b`)
- In-game Settings overlay with LLM toggle and model selection
- macOS build via `npm run build` (DMG)


