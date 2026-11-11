/**
 * Impact: eine Analyse fuer Agentenkontext, Pruefplan und Bericht.
 *
 * Die Bausteine sind vorhanden und werden nur zusammengefuehrt: `changedFiles`
 * und `selectAffectedTests` (Importgraph, Testziele), der Testkatalog
 * (Beweisklassen), der Gate-Plan (`pipeline-plan`) und der Gate-Cache. Nichts
 * hier erfindet Metadaten; jede Aussage kommt aus einer dieser Quellen.
 *
 * Der Modulgraph dieses Pfads importiert bewusst keinen TypeScript-Compiler:
 * `imports.mjs` liest Specifier und Kopfkommentare, damit `agent:context` und
 * `pretask` auch in einem nackten Checkout ohne `node_modules` laufen.
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

/** Was eine Aenderung an Doku und Invarianten mitzieht; die Liste steht in scripts/lib/subsystems.mjs. */
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

/**
 * Der Impact eines Arbeitsstands. `profile` bestimmt nur, welche Gates der Plan
 * nennt; die Analyse selbst ist fuer jeden Aufrufer dieselbe.
 */
export function impact(options = {}) {
  const profile = options.profile ?? 'quick';
  const changed = changedFiles().sort();
  const selection = selectAffectedTests(changed);
  const split = partitionByProof(selection.tests);
  const gates = (planGates(profile) ?? []).map((key) => ({
    name: GATES[key].name,
    code: GATES[key].code,
    cached: isCached(GATES[key].name, treeKey()),
    timeoutMs: GATES[key].timeoutMs,
  }));
  const areas = [...new Set(changed.map((file) => subsystemOf(file)).filter(Boolean))];
  const docs = [...new Set(changed.flatMap((file) => areaFor(file)?.docs ?? []))].sort();
  const invariants = [...new Set(changed.flatMap((file) => areaFor(file)?.invariants ?? []))];
  const status = git(['status', '--porcelain']);
  return {
    version: version(),
    tree: {
      key: treeKey().slice(0, 12),
      head: git(['rev-parse', '--short', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: status.length > 0,
      changedFiles: status.split(/\r?\n/).filter(Boolean).length,
    },
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
      ...(split.long.length > 0 ? [`${split.long.length} lange Nachweis(e) sind lokal nicht erbracht; der CI-Plan fuehrt sie auf dem PR-Commit aus`] : []),
    ],
  };
}

/**
 * Kompakte Textfassung: feste Beschriftungsspalte, ein Feld je Zeile, nichts
 * doppelt. Kurz genug fuer den Bildschirm, vollstaendig genug, dass keine
 * Rueckfrage noetig ist.
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

/**
 * Die verdichtete Textzeile: Status, Stand, Umfang in einer Zeile. Gedacht fuer
 * Kopfzeilen und Protokolle, in denen jeder weitere Satz nur Tokens kostet.
 */
export function oneLineOf(result) {
  const changed = result.changed.length === 0 ? '0 Aenderungen' : `${result.changed.length} Aenderung(en)`;
  const cached = result.gates.filter((gate) => gate.cached).length;
  const tests = result.tests.runAll ? 'Tests alle' : `Tests ${result.tests.selected.length}`;
  return `context ${result.version} ${result.tree.branch}@${result.tree.head} ${result.tree.dirty ? 'schmutzig' : 'sauber'} · ${changed} · ${tests} · Gates ${result.gates.length} (Cache ${cached})`;
}
