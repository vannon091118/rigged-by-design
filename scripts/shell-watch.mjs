#!/usr/bin/env node
/**
 * Lokaler Shell-Watcher. Er laeuft neben der guarded Shell, schreibt eine
 * parsefreie Statuszeile fuer den Prompt und eskaliert nur bei Aenderungen:
 * Receipt gueltig/ungueltig, neuer Verstoss, Budget rot. Kein Netz, kein
 * GitHub, keine Actions; der Zustand liegt unter `.verify-cache/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { guardState, guardStatusLine } from './lib/shell-guard.mjs';
import { ROOT } from './lib/report.mjs';

const root = process.env.RBD_GUARD_ROOT || ROOT;
const statusPath = join(root, '.verify-cache', 'shell-watch.status');
const interval = Number(process.env.RBD_WATCH_MS ?? 1500);
mkdirSync(dirname(statusPath), { recursive: true });

let previous = '';
let previousCount = -1;
let previousReceipt = '';

function publish() {
  const line = guardStatusLine(root);
  const state = guardState(root);
  writeFileSync(statusPath, `${line}\n`, 'utf8');
  if (line === previous && state.count === previousCount && String(state.receipt) === previousReceipt) return;
  const first = previous === '';
  previous = line;
  previousCount = state.count;
  previousReceipt = String(state.receipt);
  if (first && line.startsWith('OK')) {
    process.stderr.write(`[RBD-WATCHER] ${line}\n`);
    return;
  }
  if (line.startsWith('ROT')) {
    process.stderr.write(`\n[RBD-WATCHER] ESKALATION: ${line}\n`);
    process.stderr.write('[RBD-WATCHER] `pnpm rbd docs read` ausfuehren; bis dahin blockiert die Shell Arbeitstools.\n');
  } else if (state.count > previousCount && state.last) {
    process.stderr.write(`\n[RBD-WATCHER] Verstoss ${state.count}: ${state.last.code} · ${state.last.reason}\n`);
  } else {
    process.stderr.write(`\n[RBD-WATCHER] ${line}\n`);
  }
}

publish();
const timer = setInterval(publish, Number.isFinite(interval) && interval >= 500 ? interval : 1500);
const stop = () => {
  clearInterval(timer);
  try {
    writeFileSync(statusPath, 'STOPPED · Watcher beendet\n', 'utf8');
  } catch {
    // Der Shell-Exit darf nie an einem Statusfile scheitern.
  }
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
