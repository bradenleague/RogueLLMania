# Changelog

All notable changes to this project will be documented in this file.

## 0.1.1

- **macOS Code Signing**
  - Signed builds via GitHub CI for verified distribution

- **LLM Integration Overhaul**
  - Replaced external Ollama dependency with local llama.cpp integration (node-llama-cpp)
  - Added automatic model download (Qwen3-1.7B-Instruct @ Q4_K_M, ~1.19GB)
  - Implemented resumable downloads with SHA256 verification
  - Added First-Time User Experience (FTUE) overlay for model download
  - Real-time download progress tracking (percentage, speed, ETA)
  - Native streaming support with token-by-token emission
  - Removed HTTP API dependency - direct llama.cpp bindings
  - Model validation (GGUF header, SHA256, file size)
  - Slot-based prompt architecture for structured LLM output
  - JSON schema enforcement for reliable parsing

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


