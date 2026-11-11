#!/usr/bin/env node
/** gamescout doctor — Run diagnostics.
 *
 * Checks CDP connectivity, game tab availability, and GameScout module health.
 */

import { GameScoutCore } from '../core/index.js';

async function doctorCommand(): Promise<void> {
  const cdpEndpoint = process.env.GAMESCOUT_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
  const gameUrl = process.env.GAMESCOUT_GAME_URL ?? 'http://localhost:3000';

  console.log('GameScout Doctor v1.0.0\n');

  let allOk = true;

  // Check CDP connectivity
  console.log('1. CDP connectivity...');
  try {
    const core = new GameScoutCore({ cdpEndpoint, gameUrl });
    await core.connect();
    const snap = core.getSnapshot();
    console.log(`   OK: Connected to ${snap.gameTab?.url ?? 'unknown'}`);
    console.log(`   Game tab title: ${snap.gameTab?.title ?? 'unknown'}`);
    console.log(`   Viewport: ${JSON.stringify(snap.gameTab?.viewport ?? null)}`);
    await core.disconnect();
  } catch (err) {
    console.log(`   FAIL: ${err instanceof Error ? err.message : String(err)}`);
    allOk = false;
  }

  // Check dependencies
  console.log('2. Dependencies...');
  try {
    require.resolve('@modelcontextprotocol/sdk');
    console.log('   OK: @modelcontextprotocol/sdk');
  } catch {
    console.log('   FAIL: @modelcontextprotocol/sdk not found');
    allOk = false;
  }
  try {
    require.resolve('playwright-core');
    console.log('   OK: playwright-core');
  } catch {
    console.log('   FAIL: playwright-core not found');
    allOk = false;
  }
  try {
    require.resolve('pngjs');
    console.log('   OK: pngjs');
  } catch {
    console.log('   FAIL: pngjs not found');
    allOk = false;
  }
  try {
    require.resolve('pixelmatch');
    console.log('   OK: pixelmatch');
  } catch {
    console.log('   FAIL: pixelmatch not found');
    allOk = false;
  }

  console.log(`\n${allOk ? 'All checks passed.' : 'Some checks failed.'}`);
  process.exit(allOk ? 0 : 1);
}

export { doctorCommand };
