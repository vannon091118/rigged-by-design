/**
 * Impact: eine Analyse fuer Agentenkontext, Pruefplan und Bericht.
 *
 * Die Bausteine werden nur zusammengefuehrt: `changedFiles` und
 * `selectAffectedTests` (Importgraph, Testziele), der Testkatalog
 * (Beweisklassen), der Gate-Plan (`pipeline-plan`) und der Gate-Cache.
 *
 * Der Pfad ist netzfrei: `pretask` aktualisiert die Basis einmal bewusst,
 * `agent:context` und `test:affected` lesen den vorhandenen Ref. Ein
 * zusaetzlicher Fetch je Kontextaufruf waere Wartezeit ohne Erkenntnis.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changedFiles, selectAffectedTests, subsystemOf } from './affected-tests.mjs';
import { isCached, treeKey } from './gate-cache.mjs';
import { GATES, planGates } from './pipeline-plan.mjs';
import { ROOT } from './report.mjs';
import { IMPACT_AREAS } from './subsystems.mjs';
import { partitionByProof, proofClassOf } from './test-catalog.mjs';
import { contextSummary } from './lane-claims.mjs';

const AREAS = IMPACT_AREAS;

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const areaFor = (file) => AREAS.find((area) => file === area.prefix || file.startsWith(`${area.prefix}/`)) ?? null;

function version() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version ?? 'unbekannt';
  } catch {
    return 'unbekannt';
  }
}

/** Branch, Kopf und Dirty-Status in einem Git-Aufruf statt in vier. */
function treeFacts(key) {
  const raw = git(['status', '--porcelain=v2', '--branch']);
  const head = /^# branch\.oid (\S+)$/m.exec(raw)?.[1] ?? '';
  const branch = /^# branch\.head (\S+)$/m.exec(raw)?.[1] ?? '(unbekannt)';
  const entries = raw.split(/\r?\n/).filter((entry) => entry && !entry.startsWith('#'));
  return {
    key: key.slice(0, 12),
    head: head ? head.slice(0, 7) : git(['rev-parse', '--short', 'HEAD']),
    branch,
    dirty: entries.length > 0,
    changedFiles: entries.length,
  };
}

/**
 * Der Impact eines Arbeitsstands. `profile` bestimmt nur, welche Gates der Plan
 * nennt; die Analyse selbst ist fuer jeden Aufrufer dieselbe.
 */
export function impact(options = {}) {
  const profile = options.profile ?? 'quick';
  const changed = changedFiles({ fetch: options.fetch === true }).sort();
  const selection = selectAffectedTests(changed);
  const split = partitionByProof(selection.tests);
  const key = treeKey();
  const gates = (planGates(profile) ?? []).map((name) => {
    const gate = GATES[name];
    // Derselbe Schluessel wie der Gate-Runner: Profil-Env gehoert dazu, sonst
    // wuerde ein schneller Tests-Lauf den Mechanik-Lauf als "cached" verdecken.
    const gateKey = `${key}\0${JSON.stringify(gate.env ?? {})}`;
    return {
      name: gate.name,
      code: gate.code,
      cached: Boolean(gate.cache) && isCached(gate.name, gateKey),
    };
  });
  const areas = [...new Set(changed.map((file) => subsystemOf(file)).filter(Boolean))];
  const docs = [...new Set(changed.flatMap((file) => areaFor(file)?.docs ?? []))].sort();
  const invariants = [...new Set(changed.flatMap((file) => areaFor(file)?.invariants ?? []))];
  return {
    version: version(),
    tree: treeFacts(key),
    changed,
    systems: areas,
    docs,
    invariants,
    tests: {
      selected: selection.tests,
      runAll: selection.runAll,
      reason: selection.reason,
      fast: split.fast,
      long: split.long.map((test) => ({ file: test, proof: proofClassOf(test) })),
    },
    lanes: contextSummary(),
    gates,
    open: [
      ...(split.long.length > 0
        ? [`${split.long.length} Mechanik-Nachweis(e) laufen nur gezielt: pnpm run test:mechanics`]
        : []),
    ],
  };
}

/**
 * Kompakte Textfassung: feste Beschriftungsspalte, ein Feld je Zeile, nichts
 * doppelt. Kurz genug fuer den Bildschirm, vollstaendig genug fuer eine
 * Entscheidung.
 */
export function summarize(result) {
  const label = (text) => text.padEnd(12);
  const changed = result.changed.length === 0
    ? 'keine'
    : `${result.changed.length} (${result.changed.slice(0, 8).join(', ')}${result.changed.length > 8 ? `, +${result.changed.length - 8}` : ''})`;
  const cached = result.gates.filter((gate) => gate.cached).length;
  const lines = [
    `Kontext ${result.version} · ${result.tree.branch}@${result.tree.head} · Baum ${result.tree.key} · ${result.tree.dirty ? 'schmutzig' : 'sauber'}`,
    '',
    `${label('Aenderungen')}${changed}`,
    `${label('Systeme')}${result.systems.join(', ') || 'keine'}`,
    `${label('Tests')}${result.tests.runAll ? 'vollstaendig' : `${result.tests.selected.length} ausgewaehlt`}${result.tests.reason ? ` · ${result.tests.reason}` : ''}`,
    `${label('Gates')}${result.gates.length} · Cache ${cached}/${result.gates.length} · ${result.gates.map((gate) => gate.name).join(' ')}`,
  ];
  if (result.docs.length > 0) lines.push(`${label('Doku')}${result.docs.map((doc) => `docs/${doc}.md`).join(', ')}`);
  if (result.invariants.length > 0) {
    lines.push(`${label('Invarianten')}`);
    for (const invariant of result.invariants) lines.push(`  · ${invariant}`);
  }
  for (const entry of result.open) lines.push(`${label('Offen')}${entry}`);
  return lines.join('\n');
}

/** Die verdichtete Textzeile: Status, Stand, Umfang in einer Zeile. */
export function oneLineOf(result) {
  const changed = result.changed.length === 0 ? '0 Aenderungen' : `${result.changed.length} Aenderung(en)`;
  const cached = result.gates.filter((gate) => gate.cached).length;
  const tests = result.tests.runAll ? 'Tests alle' : `Tests ${result.tests.selected.length}`;
  return `context ${result.version} ${result.tree.branch}@${result.tree.head} ${result.tree.dirty ? 'schmutzig' : 'sauber'} · ${changed} · ${tests} · Gates ${result.gates.length} (Cache ${cached})`;
}
