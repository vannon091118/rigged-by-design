# GameScout

Local gameplay scouting environment for web games. Control a running browser via CDP, inspect the render layer, record and replay action sequences, compare checkpoints, and observe simulation state — without changing game mechanics.

## Installation

```bash
pnpm add -D @vannon091118/gamescout
pnpm install
```

## Usage

### Start GameScout (Core + MCP + Dashboard)

```bash
npx gamescout start
```

This connects to an existing Chromium instance on `http://127.0.0.1:9222` (remote debugging port), ensures a game tab and a dashboard tab exist in the same browser context, and starts the MCP server (STDIO) and dashboard HTTP server.

### Start MCP server only

```bash
npx gamescout mcp
```

### Start dashboard server only

```bash
npx gamescout dashboard
```

### Run diagnostics

```bash
npx gamescout doctor
```

## Architecture

GameScout consists of four parts:

1. **Core** — CDP connection, session and tab management, actions, recording, replay, compare. Independent of any game engine.
2. **MCP** — Model Context Protocol server for Hermes and other MCP-compatible agents.
3. **Dashboard** — Local web UI served as a second tab in the same Chromium instance.
4. **Framework Adapters** — Optional adapters for PixiJS, RBD Runtime Probe, and other engines.

### Tab Structure

- **Tab 1 (GAME)** — The running game. Primary target for all GameScout actions.
- **Tab 2 (GAMESCOUT DASHBOARD)** — Created automatically by GameScout in the same browser context. Loads the local dashboard UI.

MCP actions always target the game tab explicitly, never the currently active browser tab.

## MCP Tools

| Tool | Description |
|------|-------------|
| `connect` | Connect to CDP and select the game tab |
| `get_preview` | Full-page screenshot |
| `click` | Mouse click at screen coordinates |
| `press_key` | Keyboard key press |
| `inspect` | DOM element inspection at position |
| `annotate` | Mark a rectangular region |
| `record_start` | Start recording actions |
| `record_stop` | Stop recording and return action list |
| `replay` | Replay a recorded action sequence |
| `checkpoint` | Save a checkpoint (screenshot + observations) |
| `compare` | Compare two checkpoints with pixel-diff |

## License

MIT
