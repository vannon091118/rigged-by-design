#!/usr/bin/env node
/** GameScout CLI entry point.
 *
 * Commands:
 *   gamescout start    - Start Core + MCP + Dashboard
 *   gamescout mcp      - Start MCP server only (STDIO)
 *   gamescout dashboard - Start dashboard server only
 *   gamescout doctor   - Run diagnostics
 */

import { startCommand } from './start.js';
import { mcpCommand } from './mcp.js';
import { dashboardCommand } from './dashboard.js';
import { doctorCommand } from './doctor.js';

const command = process.argv[2] ?? 'help';

async function main(): Promise<void> {
  switch (command) {
    case 'start':
      await startCommand();
      break;
    case 'mcp':
      await mcpCommand();
      break;
    case 'dashboard':
      await dashboardCommand();
      break;
    case 'doctor':
      await doctorCommand();
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(`
GameScout CLI v1.0.0

Usage: gamescout <command>

Commands:
  start       Start Core + MCP server + Dashboard
  mcp         Start MCP server only (STDIO)
  dashboard   Start dashboard HTTP server only
  doctor      Run diagnostics
  help        Show this help

Options:
  --cdp-endpoint  CDP endpoint URL (default: http://127.0.0.1:9222)
  --game-url      Game URL (default: http://localhost:3000)
  --dashboard-port Dashboard HTTP port (default: 4321)
`);
      process.exit(0);
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "gamescout help" for usage.');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
