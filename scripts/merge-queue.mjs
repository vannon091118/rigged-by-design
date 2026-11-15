#!/usr/bin/env node
/**
 * CLI zum Merge-Queue-Koordinator (#913).
 *
 *   node scripts/merge-queue.mjs --comments <datei.json> [--expected-chain <hash>] [--write <snapshot>]
 *
 * Eingabe ist der Issue-Kommentarverlauf als JSON (`[{id, createdAt, author:{login}, body}]`),
 * wie ihn `gh issue view --json comments` oder der REST-Fallback liefert.
 * Ausgabe ist die rekonstruierte Queue; Exit 0 nur bei READY, sonst 1 (HOLD).
 * `--write` legt einen abgeleiteten Snapshot ab, der nie Quelle ist.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildMergeState } from './lib/merge-queue.mjs';

const argv = process.argv.slice(2);
const value = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : '';
};

const file = value('--comments');
if (!file) {
  console.error('merge-queue: --comments <datei.json> fehlt');
  process.exit(2);
}

let comments;
try {
  comments = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`merge-queue: Kommentare nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  process.exit(2);
}
if (!Array.isArray(comments)) {
  console.error('merge-queue: Kommentarverlauf muss ein Array sein');
  process.exit(2);
}

const state = buildMergeState(comments, { expectedChainHead: value('--expected-chain') });
const snapshot = {
  ready: state.ready,
  hold: state.hold,
  plan: state.plan,
  participants: state.participants,
  queue: state.queue,
  chainHead: state.chain.head,
};
const target = value('--write');
if (target) writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
process.exit(state.ready ? 0 : 1);
