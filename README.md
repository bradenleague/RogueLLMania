# RogueLLMania

RogueLLMania is a roguelike built with Electron and rot.js, featuring LLM-powered narration as its core experience. The game can be played without LLM enabled, but narration will use simpler, deterministic text.

<img width="990" height="760" alt="Screenshot 2025-08-16 at 2 25 47 PM" src="https://github.com/user-attachments/assets/f7e20f2b-78b2-4716-bc24-b812c7f33ca3" />

## Quickstart

1. Install prerequisites
   - Node.js: visit `https://nodejs.org/`
2. Clone and install
   ```bash
   git clone <repository-url>
   cd first-rogue-like
   npm install
    ```
 3. Run the game (development)
    ```bash
    npm run dev
    ```
    This runs with DevTools enabled.

    The first time you run the app, you'll be prompted to download the LLM model (Qwen2.5-1.5B, ~1.07GB). The download happens automatically with progress tracking.

   Alternatively, start via Electron (no builder output):
    ```bash
    npm start
    ```
 4. Build the app
    ```bash
    npm run build
    ```
    Open the generated installer (e.g., `.dmg` on macOS, `.exe` on Windows, or the equivalent for your platform) under `dist/`.


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

# Run tests in watch mode
npm test:watch

# Run with coverage
npm test:coverage

# Run benchmarks to track quality over time
npm run benchmark
```

See [tests/README.md](tests/README.md) for detailed testing documentation and [docs/PROMPT_IMPROVEMENT_GUIDE.md](docs/PROMPT_IMPROVEMENT_GUIDE.md) for tips on improving narration quality.

## LLM Settings

- Open the settings overlay (gear icon in the top-right).
- Model: Qwen2.5-1.5B-Instruct is the default model, downloaded and managed automatically.
- Enable/disable LLM generation: toggle "Enable LLM Generation". When disabled, game uses deterministic fallback text.
- You can test model loading and generation from Settings → "TEST CONNECTION".
- Model downloads automatically on first run. You can re-download or delete the model from Settings.

## Project Structure

- `public/` — HTML, CSS shell for the renderer
- `src/` — Main source code
   - `ai/` — Monster AI "brains"
   - `combat/` — Combat, stats, factions
   - `content/` — Static content (artifacts, monsters, system messages)
   - `entities/` — Game entities (player, monsters, objects)
   - `levels/` — Level generation, pathfinding, tiles
   - `main/llm/` — LLM integration with llama.cpp
   - `systems/` — Core systems (renderer, input, world, FOV, settings, etc.)
   - `tiles/` — Tile definitions
   - `ui/` — HUD, overlays (inventory, settings, level intro)
   - `game.js` — Game bootstrap and orchestration
    - `llm.js` — Renderer wrapper for LLM integration (uses llama.cpp backend)

## Platform Support

- macOS: packaged build (.dmg) validated for 0.1.0.
- Windows: packaged build (.exe) validated for 0.1.0.
- Linux: runs via `npm start`/Electron; packaged build not yet tested.

## Model Information

- Default model: Qwen2.5-1.5B-Instruct @ Q4_K_M (chosen for small size and fast local performance).
- Model is managed automatically by the app. Downloads happen in-app with progress tracking.
- Runs locally via llama.cpp native bindings (no external HTTP API required).
- Chain-of-thought (CoT) is not required. If a model emits CoT or auxiliary tags, the game ignores them and extracts the final description.

## Known Issues

 - Death state is a soft pause: On death, the engine is locked and a Game Over message is shown, but any subsequent input queues an action and unlocks the engine. In practice you can still move or load a game until you press R to restart (intended for now); a stricter hard-lock game-over flow is planned.

## License

MIT
