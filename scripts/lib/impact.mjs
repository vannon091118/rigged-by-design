/**
 * Impact: eine Analyse fuer Agentenkontext, Pruefplan und Bericht.
 *
 * Die Bausteine sind vorhanden und werden nur zusammengefuehrt: `changedFiles`
 * und `selectAffectedTests` (Importgraph, Testziele), der Testkatalog
 * (Beweisklassen), der Gate-Plan (`pipeline-plan`) und der Gate-Cache. Nichts
 * hier erfindet Metadaten; jede Aussage kommt aus einer dieser Quellen.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changedFiles, selectAffectedTests, subsystemOf } from './affected-tests.mjs';
import { isCached, treeKey } from './gate-cache.mjs';
import { GATES, planGates } from './pipeline-plan.mjs';
import { ROOT } from './report.mjs';
import { partitionByProof, proofClassOf } from './test-catalog.mjs';

/** Was eine Aenderung an Doku und Invarianten mitzieht. Erste Uebereinstimmung gilt. */
const AREAS = Object.freeze([
  {
    prefix: 'src/core/economy',
    docs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['Betraege sind ganzzahlige Mikro-Einheiten; jede Buchung ist eine Ledger-Zeile', 'keine Geldquelle ausser EXTERNAL_WORLD'],
  },
  {
    prefix: 'src/core/rng',
    docs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['kein Math.random/Date.now/new Date; Zufall nur aus dem geseedeten Prng', 'gameplay und presentation teilen nie einen Strom'],
  },
  {
    prefix: 'src/core/sim/narrative',
    docs: ['ARCHITECTURE', 'NARRATIVE-ENGINE', 'EVENT-NARRATIVE-ENGINE-TASKPLAN'],
    invariants: ['WorldState.narrative ist der einzige persistente Narrativ-Zustand', 'Facts sind der Ereignisstrom, das Journal bleibt Spielerhistorie'],
  },
  {
    prefix: 'src/store',
    docs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['ein Eigentuemer pro Zustand: world, ledger, PRNG und Save liegen im world-store', 'Save-Migration nur vorwaerts, v3/v4 verworfen'],
  },
  { prefix: 'src/ui', docs: ['ARCHITECTURE', 'PRODUCT'], invariants: ['UI liest Snapshots und haelt keinen zweiten Spielzustand'] },
  { prefix: 'src/render', docs: ['ARCHITECTURE', 'ASSETS'], invariants: ['Renderer zieht Zufall nur aus src/render/rng.ts'] },
  { prefix: 'scripts', docs: ['CI-GATES', 'ESCALATION', 'ARCHITECTURE'], invariants: ['kein Gate schreibt im Verify-Lauf'] },
  { prefix: '.github', docs: ['CI-GATES', 'ESCALATION'], invariants: ['der Pflichtstatus heisst Fail-Closed Gates'] },
  { prefix: 'content', docs: ['NARRATIVE-ENGINE'], invariants: ['Texte sind Darstellung, nie Spielregel'] },
  { prefix: 'src/Config', docs: ['AGENTS', 'ARCHITECTURE'], invariants: ['eine Config, ein Ort in src/Config'] },
  { prefix: 'docs', docs: [], invariants: ['sechs Pflichtdokumente, Marker via docs:sync'] },
]);

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
    gates,
    open: [
      ...(selection.runAll ? [] : []),
      ...(split.long.length > 0 ? [`${split.long.length} lange Nachweis(e) sind lokal nicht erbracht; Delegation: npm run ci:long`] : []),
    ],
  };
}

/** Kompakte Textfassung: Einstiegspunkte statt ganzer Dokumente. */
export function summarize(result) {
  const lines = [
    `Impact ${result.version} · ${result.tree.branch}@${result.tree.head} · Baum ${result.tree.key}${result.tree.dirty ? ' (schmutzig)' : ''}`,
    `Aenderungen: ${result.changed.length === 0 ? 'keine' : result.changed.slice(0, 12).join(', ')}${result.changed.length > 12 ? ` (+${result.changed.length - 12})` : ''}`,
    `Systeme: ${result.systems.join(', ') || 'keine'}`,
    `Tests: ${result.tests.runAll ? 'alle' : `${result.tests.selected.length} ausgewaehlt`}${result.tests.reason ? ` (${result.tests.reason})` : ''}`,
    `Gates: ${result.gates.map((gate) => `${gate.name}${gate.cached ? '[cache]' : ''}`).join(' ')}`,
  ];
  if (result.docs.length > 0) lines.push(`Doku: docs/${result.docs.join('.md, docs/')}.md`);
  if (result.invariants.length > 0) lines.push(`Invarianten: ${result.invariants.join(' | ')}`);
  for (const entry of result.open) lines.push(`Offen: ${entry}`);
  return lines.join('\n');
}
