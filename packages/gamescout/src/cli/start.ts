#!/usr/bin/env node
/** gamescout start — Start Core + MCP server + Dashboard.
 *
 * Connects to Chromium via CDP, ensures game tab and dashboard tab,
 * starts MCP server (STDIO) and dashboard HTTP server (loopback).
 */

import { createId } from '../core/id.js';
import { GameScoutCore } from '../core/index.js';
import { McpServer } from '../mcp/server.js';
import { DashboardServer } from '../dashboard/server.js';
import { DASHBOARD_PATH } from '../core/cdp.js';

async function startCommand(): Promise<void> {
  const cdpEndpoint = process.env.GAMESCOUT_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
  const gameUrl = process.env.GAMESCOUT_GAME_URL ?? 'http://localhost:3000';
  const dashboardPort = parseInt(process.env.GAMESCOUT_DASHBOARD_PORT ?? '4321', 10);
  const sessionToken = process.env.GAMESCOUT_SESSION_TOKEN ?? createId('token');

  const core = new GameScoutCore({
    cdpEndpoint,
    dashboardPort,
    gameUrl,
    sessionToken,
  });

  process.stderr.write('[gamescout] Connecting to CDP...\n');

  try {
    await core.connect();
    process.stderr.write(`[gamescout] CDP connected: ${core.getSnapshot().gameTab?.url ?? 'unknown'}\n`);
  } catch (err) {
    process.stderr.write(`[gamescout] CDP connection failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  // Start MCP server (STDIO)
  const mcpServer = new McpServer(core);
  const mcpTransport = new (await import('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport();
  await mcpServer.connect(mcpTransport);
  process.stderr.write('[gamescout] MCP server started on STDIO\n');

  // Start dashboard HTTP server (loopback only)
  const dashboardUrl = `http://127.0.0.1:${dashboardPort}${DASHBOARD_PATH}`;
  const dashboardServer = new DashboardServer(core, { port: dashboardPort, sessionToken });
  await dashboardServer.start();
  process.stderr.write(`[gamescout] Dashboard HTTP server: http://127.0.0.1:${dashboardPort}\n`);

  // Ensure dashboard tab exists in the browser
  try {
    await core.ensureDashboardTab(dashboardUrl);
    process.stderr.write(`[gamescout] Dashboard tab opened: ${dashboardUrl}\n`);
  } catch (err) {
    process.stderr.write(`[gamescout] Warning: Could not open dashboard tab: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  process.stderr.write('[gamescout] Ready.\n');

  // Keep process alive
  return new Promise(() => {
    // Intentionally empty: process runs until explicitly terminated
  });
}

export { startCommand };
