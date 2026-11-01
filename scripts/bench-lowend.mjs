#!/usr/bin/env node
/**
 * Low-End-Profil: derselbe Benchmark, auf einen Kern gepinnt.
 * Das ist eine Emulation, kein echter Test auf schwacher Hardware; die
 * gemessenen Werte und die Grenzen stehen in docs/ARCHITECTURE.md.
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const cpu = os.cpus()[0]?.model ?? 'unbekannte CPU';
console.log(`Low-End-Profil: ${cpu} · ${os.cpus().length} logische Kerne`);
const canPin = spawnSync('taskset', ['-c', '0', 'true'], { stdio: 'ignore' }).status === 0;
if (canPin) console.log('Pinne den Lauf auf einen Kern (taskset -c 0).');
else console.log('taskset fehlt: Volllast-Messung ohne Kern-Pinning.');

const result = canPin
  ? spawnSync('taskset', ['-c', '0', 'pnpm', 'exec', 'vitest', 'bench', '--run', '--config', 'src/Config/vite.config.ts'], { stdio: 'inherit' })
  : spawnSync('pnpm', ['exec', 'vitest', 'bench', '--run', '--config', 'src/Config/vite.config.ts'], { stdio: 'inherit' });

if (result.error) {
  console.error(`Benchmark konnte nicht starten: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
