#!/usr/bin/env node
/** Balance-Spur: startet den 40-Tage-Messlauf als eigenen Prueflauf und legt den Bericht ab. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const days = Number(arg('days', process.env.RBD_DAYS ?? 40));
const seed = Number(arg('seed', process.env.RBD_SEED ?? 12345));
if (!Number.isSafeInteger(days) || days < 1 || days > 400) {
  fail(1, 'ERR-2001', 'balance', `ungueltige Tageszahl ${days}; erlaubt sind 1 bis 400`);
  process.exit(1);
}
if (!Number.isSafeInteger(seed)) {
  fail(1, 'ERR-2001', 'balance', `ungueltiger Seed ${seed}`);
  process.exit(1);
}

const artifacts = join(ROOT, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const report = join(artifacts, `balance-${seed}-${days}d.md`);

console.log(`balance: ${days} Tage, Seed ${seed}, Bericht ${report}`);
const run = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'src/Config/vite.config.ts', 'src/core/sim/__tests__/balance-operating.test.ts'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, RBD_BALANCE: '1', RBD_DAYS: String(days), RBD_SEED: String(seed), RBD_BALANCE_OUT: report },
  },
);

if (!existsSync(report)) {
  fail(1, 'ERR-2001', 'balance', 'der Messlauf hat keinen Bericht geschrieben');
  process.exit(1);
}
const lines = readFileSync(report, 'utf8').split(/\r?\n/).length;
if (run.status === 0) {
  console.log(`balance: PASS, ${lines} Zeilen Bericht in ${report}`);
} else {
  console.log(`balance: FAIL (Exit-Code ${run.status}), ${lines} Zeilen Bericht in ${report}`);
}
process.exit(run.status === 0 ? 0 : 1);
