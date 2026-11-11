import { DashboardServer } from '../dashboard/server.js';
import { createId } from '../core/id.js';

async function dashboardCommand(): Promise<void> {
  const port = parseInt(process.env.GAMESCOUT_DASHBOARD_PORT ?? '4321', 10);
  const sessionToken = process.env.GAMESCOUT_SESSION_TOKEN ?? createId('token');

  process.stderr.write('[gamescout dashboard] Starting dashboard server...\n');

  // Note: In standalone mode, the dashboard server needs a Core instance.
  // For now, start a minimal standalone dashboard that connects to CDP directly.
  const { GameScoutCore } = await import('../core/index.js');

  const cdpEndpoint = process.env.GAMESCOUT_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
  const gameUrl = process.env.GAMESCOUT_GAME_URL ?? 'http://localhost:3000';

  const core = new GameScoutCore({
    cdpEndpoint,
    dashboardPort: port,
    gameUrl,
    sessionToken,
  });

  try {
    await core.connect();
    process.stderr.write('[gamescout dashboard] CDP connected\n');
  } catch (err) {
    process.stderr.write(`[gamescout dashboard] CDP connection failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const dashboardServer = new DashboardServer(core, { port, sessionToken });
  await dashboardServer.start();

  try {
    const dashboardUrl = `http://127.0.0.1:${port}/__gamescout__/dashboard`;
    await core.ensureDashboardTab(dashboardUrl);
    process.stderr.write(`[gamescout dashboard] Dashboard tab: ${dashboardUrl}\n`);
  } catch (err) {
    process.stderr.write(`[gamescout dashboard] Warning: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  process.stderr.write('[gamescout dashboard] Ready.\n');

  // Keep process alive
  return new Promise(() => {
    // Intentionally empty: process runs until explicitly terminated
  });
}

export { dashboardCommand };
