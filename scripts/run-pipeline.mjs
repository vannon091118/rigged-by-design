#!/usr/bin/env node
/**
 * Fail-Closed-Pipeline in zwei getrennten Modi.
 *
 * verify  liest ausschliesslich. Kein Gate schreibt; Autofix laeuft hier nie,
 *         damit ein Pruefer nicht vorher die Akte umschreibt.
 * fix     repariert alles Automatische (`--fix`) und protokolliert danach
 *         jede Aenderung und jede Loeschung im Arbeitsbaum.
 *
 * Fuenf Profile: light (Struktur-Turn), dev (Struktur plus betroffene Tests),
 * quick (Entwicklungsfeedback), full (Integration), release (APK/Versionssprung).
 * Schwere Nachweise gehoeren in die CI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';
import { executeStep, runGates } from './lib/gate-runner.mjs';
import { resetTreeKey } from './lib/gate-cache.mjs';
import { GATES, isFixMode, isProfile, normalizeProfile, planGates, PROFILES } from './lib/pipeline-plan.mjs';
import { auditRequired } from './lib/dependency-change.mjs';
import { describeChanges, diffTree } from './lib/tree-changes.mjs';
import { releaseOwner, sweepOrphans } from './lib/process-sweep.mjs';
import { installStopHandlers } from './lib/pipeline-stop.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
// `verify:all` und `--profile=all` sind derselbe Lauf wie `full`; die CI gibt `all` aus.
const PROFILE = normalizeProfile(profileArg ? profileArg.slice('--profile='.length) : 'full');
if (!isProfile(PROFILE)) {
  fail(1, 'ERR-4006', 'pipeline', `unbekanntes Profil ${PROFILE}; erlaubt sind ${PROFILES.join(', ')}`);
  process.exit(1);
}
const FIX = isFixMode(argv);
// `verify:all` ist und bleibt das volle Profil; die kurzen Namen gelten nur fuer die neuen Profile.
const LABEL = PROFILE === 'full' ? 'verify:all' : `verify:${PROFILE}`;
const MODE = FIX ? 'fix' : 'verify';

function readTreeStatus() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return '';
  }
}

/**
 * Autofix ist der einzige schreibende Schritt. Er laeuft ausschliesslich hinter
 * `--fix` und nennt am Ende jede Datei, die er angefasst oder geloescht hat.
 */
async function runAutofix() {
  const before = readTreeStatus();
  console.log(`=== ERR-0911 Autofix (Profil ${PROFILE}) ===`);
  const result = await executeStep({ name: 'autofix', command: 'node', script: 'scripts/autofix-0911.mjs' });
  if (result.output.trim()) process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
  const changes = diffTree(before, readTreeStatus());
  const entries = describeChanges(changes);
  if (entries.length === 0) {
    console.log('autofix: keine Aenderung, Arbeitsbaum unveraendert (idempotent)');
  } else {
    console.log(`autofix: ${entries.length} Aenderung(en) im Arbeitsbaum`);
    for (const entry of entries) console.log(`  ${entry}`);
  }
  resetTreeKey();
  return result.status === 0 ? 0 : 1;
}

installStopHandlers();
sweepOrphans((message) => console.log(`${LABEL}: ${message}`));
console.log(
  FIX
    ? `=== fix (Profil ${PROFILE}) === Autofix schreibt, danach pruefen die Gates denselben Baum`
    : `=== ${LABEL} === rein lesend, kein Gate schreibt Dateien`,
);

let failed = 0;
if (FIX) failed += await runAutofix();
else if (process.env.RBD_VERIFY_FIX === '1') {
  fail(1, 'ERR-4006', 'pipeline', 'RBD_VERIFY_FIX ist abgeschafft; Reparaturen laufen ueber pnpm run fix');
  process.exit(1);
}

/**
 * `--gate` wird vor jedem Filter gelesen. Die Pruefung gegen das Profil darf
 * nicht davon abhaengen, ob ein spaeterer Schritt das Gate gerade entfernt hat:
 * sonst meldet `--gate=audit` "nicht vorgesehen", statt Audit zu erzwingen.
 */
const gateArg = argv.find((value) => value.startsWith('--gate='));
const gateAt = argv.indexOf('--gate');
const gateNext = gateAt >= 0 ? argv[gateAt + 1] : undefined;
const ONLY = gateArg
  ? gateArg.slice('--gate='.length)
  : gateNext && !gateNext.startsWith('--')
    ? gateNext
    : null;
const PROFILE_GATES_LIST = planGates(PROFILE) ?? [];
if (ONLY && !PROFILE_GATES_LIST.includes(ONLY)) {
  fail(1, 'ERR-4011', 'pipeline', `Gate '${ONLY}' ist in ${LABEL} nicht vorgesehen (${PROFILE_GATES_LIST.join(', ')})`);
  process.exit(1);
}

// Audit ist impact-, release- und explizit erzwungen. Ein Skip ist ein eigener,
// ausgewiesener Zustand - kein gruenes Gate und kein stiller Erfolg.
const FORCE_AUDIT = ONLY === 'audit' || PROFILE === 'release' || process.env.RBD_VERIFY_AUDIT === '1';
let skippedAudit = false;
let selected = PROFILE_GATES_LIST.map((key) => {
  const step = { ...GATES[key] };
  if (step.name === 'tests' && PROFILE === 'quick') step.env = { RBD_TEST_PROFILE: 'quick' };
  if (step.name === 'build') step.ready = () => existsSync(join(ROOT, 'dist', 'index.html'));
  return step;
});
if (!FORCE_AUDIT && !auditRequired()) {
  const at = selected.findIndex((step) => step.name === 'audit');
  if (at >= 0) {
    selected.splice(at, 1);
    skippedAudit = true;
    console.log('[skip] audit: keine Dependency-Aenderung; der Skip ist kein Erfolg (RBD_VERIFY_AUDIT=1, --gate=audit oder release erzwingt ihn)');
  }
}

/**
 * Ein einzelnes Gate fuer die CI-Matrix: jeder Job traegt genau ein Gate, damit
 * ein roter Status den Schuldigen nennt. Die Zugehoerigkeit wurde oben bereits
 * gegen die unveraenderte Profil-Liste geprueft.
 */
if (ONLY) {
  selected = selected.filter((step) => step.name === ONLY);
  console.log(`${LABEL}: nur Gate ${ONLY}`);
}
if (selected.length === 0) {
  fail(1, 'ERR-4011', 'pipeline', 'kein Gate ausgewaehlt; ein uebersprungenes Gate ist kein Erfolg');
  process.exit(1);
}

const gateFailures = await runGates(selected);
releaseOwner();
const total = failed + gateFailures.length;
if (total > 0) {
  console.error(`${LABEL}: ${total} Gate(s) rot`);
  process.exit(1);
}
const skipNote = skippedAudit ? ', 1 uebersprungen: audit' : '';
console.log(`${LABEL}: PASS (alle Gates gruen, ${MODE}-Modus${skipNote})`);
process.exit(0);
