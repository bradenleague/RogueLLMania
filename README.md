# RogueLLMania

RogueLLMania is a roguelike built with Electron and rot.js, featuring LLM-powered narration as its core experience. The game can be played without the LLM enabled, but narration will use simpler, deterministic text.

<img width="990" height="760" alt="Screenshot 2025-08-16 at 2 25 47 PM" src="https://github.com/user-attachments/assets/f7e20f2b-78b2-4716-bc24-b812c7f33ca3" />

## Quickstart

1. Install prerequisites
   - Node.js: visit `https://nodejs.org/`
   - Ollama: visit `https://ollama.com`
2. Clone and install
   ```bash
   git clone <repository-url>
   cd first-rogue-like
   npm install
   ```
3. Pull the model (for LLM features)
   ```bash
   ollama pull gemma3n:e4b
   ```
4. Run the game (development)
   ```bash
   npm run dev
   ```
   This runs with DevTools enabled.
   
   Alternatively, start via Electron (no builder output):
   ```bash
   npm start
   ```
5. Build the app
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

## LLM Settings

- Open the settings overlay (gear icon in the top-right).
- Model: set the Ollama model (default `gemma3n:e4b`).
- Enable/disable LLM generation: toggle “Enable LLM Generation”. When disabled, the game uses deterministic fallback text.
- You can test connectivity and model availability from Settings → “TEST CONNECTION”.

## Project Structure

- `public/` — HTML, CSS shell for the renderer
- `src/` — Main source code
  - `ai/` — Monster AI “brains”
  - `combat/` — Combat, stats, factions
  - `content/` — Static content (artifacts, monsters, system messages)
  - `entities/` — Game entities (player, monsters, objects)
  - `levels/` — Level generation, pathfinding, tiles
  - `systems/` — Core systems (renderer, input, world, FOV, settings, etc.)
  - `tiles/` — Tile definitions
  - `ui/` — HUD, overlays (inventory, settings, level intro)
  - `game.js` — Game bootstrap and orchestration
  - `ollama.js` — Ollama integration and streaming

## Platform Support

- macOS: packaged build (.dmg) validated for 0.1.0.
- Windows: packaged build (.exe) validated for 0.1.0.
- Linux: runs via `npm start`/Electron; packaged build not yet tested.

## Model Information

- Default model: `gemma3n:e4b` (chosen for small size and fast local performance).
- Any Ollama model should work. You can change the model in Settings.
- Chain-of-thought (CoT) is not required. If a model emits CoT or auxiliary tags, the game ignores them and extracts the final description.

## Known Issues

 - Death state is a soft pause: On death, the engine is locked and a Game Over message is shown, but any subsequent input queues an action and unlocks the engine. In practice you can still move or load a game until you press R to restart (intended for now); a stricter hard-lock game-over flow is planned.

## License

MIT
