# RogueLLMania

RogueLLMania is a roguelike built with Electron and rot.js, featuring LLM-powered narration as its core differentiator. The game uses a local AI model (Qwen3-1.7B) running via llama.cpp to generate atmospheric level introductions and artifact descriptions in real-time.

<img width="990" height="760" alt="Screenshot 2025-08-16 at 2 25 47 PM" src="https://github.com/user-attachments/assets/f7e20f2b-78b2-4716-bc24-b812c7f33ca3" />

## Quickstart

1. Install prerequisites
   - Node.js: visit `https://nodejs.org/`
2. Clone and install
   ```bash
   git clone <repository-url>
   cd RogueLLMania
   npm install
   ```
3. Run the game (development)
   ```bash
   npm run dev
   ```
   This runs with DevTools enabled.

   **First run**: The app will automatically download the LLM model (Qwen3-1.7B, ~1.19GB) with progress tracking. This is a one-time setup.

   Alternatively, start without DevTools:
   ```bash
   npm start
   ```
4. Build the app
   ```bash
   npm run build
   ```
   Open the generated installer (e.g., `.dmg` on macOS, `.exe` on Windows) from the `dist/` directory.


## Controls

- Movement: WASD or Arrow keys
- Diagonals: Q (up-left), E (up-right), Z (down-left), C (down-right) — keypad 7/9/1/3 also work
- Wait/Pass turn: Space
- Inventory: I (toggle)
- Pick up item: G
- Save: Cmd/Ctrl+S
- Load: Cmd/Ctrl+L
- Restart (only when Game Over): R
- Close overlays: Esc

## Testing & Quality

RogueLLMania includes a comprehensive testing framework for validating and improving LLM-generated narration quality:

```bash
# Run all tests
npm test

# Run benchmarks to track quality over time
npm run benchmark
```

## Project Structure

- `public/` — HTML, CSS shell for the renderer
- `src/` — Main source code
  - `ai/brains/` — Monster AI behavior (zombie, chaser)
  - `combat/` — Combat mechanics, stats, factions
  - `content/` — Static content (artifacts, monsters, system messages)
  - `entities/` — Game entities (player, monsters, items, story objects)
  - `levels/` — Level generation (basic, cave, pillared hall), pathfinding
  - `main/llm/` — LLM backend (llama.cpp integration)
    - `ConfigManager.js` — Model config and system prompts
    - `LlamaBridge.js` — High-level LLM API
    - `LlamaManager.js` — Low-level llama.cpp wrapper
    - `ModelDownloader.js` — Model download with resume support
    - `schemas.js` — JSON schemas for structured output
  - `systems/` — Core game systems (renderer, input, FOV, turn engine, world, etc.)
  - `tiles/` — Tile types and definitions
  - `ui/` — UI layer and overlays
    - `overlays/` — Inventory, settings, FTUE, level intro
    - `startScreen.js` — Start screen with model download UI
    - `modelDownloadController.js` — Download state management
    - `overlayManager.js` — Overlay system
  - `game.js` — Game bootstrap and orchestration
  - `llm.js` — Renderer-side LLM client (IPC wrapper)
  - `main.js` — Electron main process

## Platform Support

- **macOS**: Packaged build (.dmg) with code signing. Validated for v0.1.1.
- **Windows**: Packaged build (.exe). Validated for v0.1.0 (v0.1.1 pending).
- **Linux**: Runs via `npm start`/Electron; packaged build (.AppImage) not yet tested.

## Model Information

- **Model**: Qwen3-1.7B-Instruct @ Q4_K_M (~1.19GB download)
- **Why this model?** Small size, fast inference on consumer hardware, good quality for narrative generation
- **Automatic management**: Model downloads on first run with progress tracking and resume support
- **Fully local**: Runs via llama.cpp native bindings (no internet required after download, no external APIs)
- **Storage**: Model stored in user data directory, validated with SHA256 checksums

## Known Issues

 - Death state is a soft pause: On death, the engine is locked and a Game Over message is shown, but any subsequent input queues an action and unlocks the engine. In practice you can still move or load a game until you press R to restart (intended for now); a stricter hard-lock game-over flow is planned.

## License

MIT
