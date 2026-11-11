#!/usr/bin/env node
/**
 * Ein Aufruf, ein Kontext: Aenderungen, Systeme, Invarianten, Tests, Gates und
 * bereits gueltige Cache-Treffer. Ohne `--json` strukturiert, mit `--line` als
 * eine Zeile, mit `--json` als Agentensicht und mit `--full` vollstaendig.
 *
 * Die Agentensicht traegt nur die Felder, die eine Entscheidung brauchen. Die
 * vollstaendige Fassung (inklusive Lane-Pfaden und Gate-Timeouts) landet unter
 * `.verify-cache/agent-context.json`; so geht kein 65-KB-Block durch den Chat.
 *
 * Der Kontext ersetzt keine Codepruefung; er erspart die wiederholte
 * Bestandsaufnahme aus Git, Importgraph, Katalog und Doku.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { impact, oneLineOf } from './lib/impact.mjs';
import { compact } from './lib/compact.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const result = impact({ profile: profileArg ? profileArg.slice('--profile='.length) : 'quick' });

/** Ausgabe erst nach dem Flush beenden; `process.exit` wuerde den Puffer kappen. */
const write = (text) => new Promise((resolve) => process.stdout.write(text, resolve));

/**
 * Vollstaendige Fassung neben den Cache legen. Sie ist fluechtig wie der
 * Cache, nicht Teil des Commits und nur fuer Werkzeuge und Debugging gedacht.
 */
function persistFull() {
  const file = join(ROOT, '.verify-cache', 'agent-context.json');
  try {
    mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
    const text = `${JSON.stringify(result, null, 2)}\n`;
    writeFileSync(file, text, 'utf8');
    return { file: relative(ROOT, file).replaceAll('\\', '/'), bytes: Buffer.byteLength(text) };
  } catch {
    return { file: null, bytes: 0 };
  }
}

/** Nur die Felder, aus denen ein Agent seinen naechsten Schritt ableitet. */
function forAgent({ file, bytes }) {
  const lanes = result.lanes ?? { open: [], collisions: [], parked: [] };
  return {
    version: result.version,
    tree: result.tree,
    changed: result.changed,
    systems: result.systems,
    docs: result.docs,
    invariants: result.invariants,
    // Bei runAll ist `selected` die vollstaendige Suite: als Liste nur Rauschen.
    // Die Zaehler sagen dasselbe; die Namen stehen in der vollstaendigen Datei.
    tests: {
      runAll: result.tests.runAll,
      reason: result.tests.reason,
      counts: {
        selected: result.tests.selected.length,
        fast: result.tests.fast.length,
        long: result.tests.long.length,
      },
      ...(result.tests.runAll ? {} : { selected: result.tests.selected, fast: result.tests.fast }),
      long: result.tests.long,
    },
    gates: result.gates.map((gate) => ({ name: gate.name, code: gate.code, cached: gate.cached })),
    lanes: {
      open: lanes.open.map((lane) => ({ id: lane.id, owner: lane.owner })),
      collisions: lanes.collisions.map((entry) => ({
        lane: entry.lane,
        against: entry.collisions.map((conflict) => ({ lane: conflict.lane, reason: conflict.reason }) ),
      })),
      parked: lanes.parked.map((lane) => ({ id: lane.id, owner: lane.owner })),
    },
    open: result.open,
    full: file,
    fullBytes: bytes,
  };
}

if (argv.includes('--full')) {
  await write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}
if (argv.includes('--json')) {
  // Die Agentensicht bleibt klein; die vollstaendige Fassung liegt daneben.
  await write(`${JSON.stringify(forAgent(persistFull()), null, 2)}\n`);
  process.exit(0);
}
if (argv.includes('--line')) {
  const laneInfo = result.lanes.open.length > 0
    ? ` · Lanes offen: ${result.lanes.open.map((l) => l.id).join(',')}`
    : '';
  const collisionInfo = result.lanes.collisions.length > 0
    ? ` · Kollisionen: ${result.lanes.collisions.length}`
    : '';
  await new Promise((resolve) => process.stdout.write(`${oneLineOf(result)}${laneInfo}${collisionInfo}\n`, resolve));
  process.exit(0);
}
const cachedGates = result.gates.filter((gate) => gate.cached).length;
const lanes = result.lanes ?? { open: [], collisions: [], parked: [] };
const hooksPath = (() => {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
})();

// Ein Block statt sechs Absaetze: der Agent liest Status, Umfang, Claim und
// den naechsten Befehl. Alles Weitere nur mit RBD_VERBOSE=1.
console.log(compact({
  status: lanes.collisions.length > 0 ? 'ROT' : lanes.open.length > 0 ? 'INFO' : 'GRUEN',
  headline: `${result.version} · ${result.tree.branch}@${result.tree.head} · Baum ${result.tree.key} · ${result.tree.dirty ? 'schmutzig' : 'sauber'}`,
  facts: [
    ['Aenderung', result.changed.length === 0
      ? 'keine'
      : `${result.changed.length}: ${result.changed.slice(0, 6).join(', ')}${result.changed.length > 6 ? ` +${result.changed.length - 6}` : ''}`],
    ['Systeme', result.systems.join(', ') || 'keine'],
    ['Tests', result.tests.runAll ? 'vollstaendig' : `${result.tests.selected.length} ausgewaehlt${result.tests.reason ? ` (${result.tests.reason})` : ''}`],
    ['Gates', `${result.gates.length} · Cache ${cachedGates} · ${result.gates.map((gate) => gate.name).join(' ')}`],
    ['Claim', lanes.open.length === 0 ? 'keine offenen Lanes' : `${lanes.open.length} offen · ${lanes.collisions.length} Kollision`],
    ['Hooks', hooksPath === '.githooks' ? 'aktiv' : 'nicht aktiv · pnpm run hooks:install'],
    ['Naechster', 'pnpm run agent:pretask --brief · pnpm run agent:verify'],
  ],
  details: [
    ...result.docs.map((doc) => `Doku: docs/${doc}.md`),
    ...result.invariants.map((entry) => `Invariante: ${entry}`),
    ...result.open.map((entry) => `Offen: ${entry}`),
    ...lanes.open.map((lane) => `Lane: ${lane.id} (${lane.owner}) · ${lane.pathAllowlist.length} Pfad(e)`),
    ...lanes.collisions.flatMap((coll) => coll.collisions.map((conflict) => `Kollision: ${coll.lane} vs ${conflict.lane} · ${conflict.reason || 'Contract'}`)),
    ...lanes.parked.map((lane) => `Parked: ${lane.id} (${lane.owner})`),
  ],
}));
// Kein `process.exit` am Ende: der Prozess soll den Puffer selbst ausleeren.
process.exitCode = 0;
