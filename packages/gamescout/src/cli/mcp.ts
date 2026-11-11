#!/usr/bin/env node
/** gamescout mcp — Start MCP server only (STDIO).
 *
 * Connects to Chromium via CDP and exposes GameScout tools over MCP STDIO.
 * Diagnostics go to stderr, never stdout.
 */

import { GameScoutCore } from '../core/index.js';
import { McpServer } from '../mcp/server.js';

async function mcpCommand(): Promise<void> {
  const cdpEndpoint = process.env.GAMESCOUT_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
  const gameUrl = process.env.GAMESCOUT_GAME_URL ?? 'http://localhost:3000';

  const core = new GameScoutCore({
    cdpEndpoint,
    gameUrl,
  });

  process.stderr.write('[gamescout mcp] Connecting to CDP...\n');

  try {
    await core.connect();
    process.stderr.write(`[gamescout mcp] CDP connected: ${core.getSnapshot().gameTab?.url ?? 'unknown'}\n`);
  } catch (err) {
    process.stderr.write(`[gamescout mcp] CDP connection failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const mcpServer = new McpServer(core);
  const mcpTransport = new (await import('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport();
  await mcpServer.connect(mcpTransport);
  process.stderr.write('[gamescout mcp] MCP server ready on STDIO\n');

  // Keep process alive
  return new Promise(() => {
    // Intentionally empty: process runs until explicitly terminated
  });
}

export { mcpCommand };
