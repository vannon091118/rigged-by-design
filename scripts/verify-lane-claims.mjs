#!/usr/bin/env node
/**
 * verify-lane-claims: Prüft, ob der aktuelle Branch einen Lane-Claim hat,
 * alle gestagten Dateien innerhalb der Allowlist liegen, die acht Meta-Dateien
 * für Feature-Lanes gesperrt bleiben und keine Kollision mit einer anderen
 * offenen Lane besteht.
 *
 * Die Meta-Sperre lässt genau den Schreibpfad des Systems durch: Doku-Marker,
 * Versionszeile und Lockfile-Zeile. Jede andere Änderung an einer Meta-Datei
 * braucht einen Claim, der den Pfad ausdrücklich führt.
 *
 * Exit 0 = OK, Exit 1 = Claim fehlt, Verletzung oder Kollision.
 */
import { execFileSync } from 'node:child_process';
import {
  loadClaimsStrict,
  findCollisions,
  META_FILES,
  OWNERS,
  BRANCH_PATTERN,
  LEGACY_PREFIXES,
  selectClaim,
  botClaim,
  auditRegisterAgainstBase,
  COORDINATION_FILES,
  isTaskContractPath,
} from './lib/lane-claims.mjs';
import { filterMergedCollisions } from './lib/claim-evidence.mjs';
import { generatedOnlyDiff } from './lib/generated-files.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', errors: 'replace' }).trim();

// `--ci` prüft den PR-Diff gegen die Basis statt den lokalen Index. Ohne diesen
// Modus waere die Claim-Sperre nur lokal: ein Cloud-Agent ohne Hooks schriebe
// ausserhalb jeder Allowlist, und niemand saehe es.
const CI = process.argv.includes('--ci');
const BASE_REF = process.env.BASE_REF ?? 'origin/main';
// Ohne HEAD_REF prueft der CI-Modus den ausgecheckten Stand. Fuer eine
// Vorabpruefung aller Lanes von einem Branch aus laesst sich damit die
// Remote-Ref der jeweiligen Lane als Diff-Kopf setzen.
const HEAD_REF = process.env.HEAD_REF ?? 'HEAD';
const RANGE = CI ? `${BASE_REF}...${HEAD_REF}` : null;

// Ein Merge bringt fremde Arbeit mit. Bewertet wird nur, was der Branch
// gegenueber der Basis wirklich selbst hinzufuegt - sonst wuerde jeder Merge
// von main als Lane-Verstoss gelten und liesse sich nie committen.
const MERGING = (() => {
  try {
    return git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']) !== '';
  } catch {
    return false;
  }
})();
const DIFF_BASE = CI ? RANGE : (MERGING ? BASE_REF : null);

const branch = process.env.BRANCH || (CI ? process.env.GITHUB_HEAD_REF : '') || git(['rev-parse', '--abbrev-ref', 'HEAD']);

// Fail-closed: ein kaputtes oder fehlendes Register ist ein Befund, kein Freibrief.
let allClaims;
try {
  allClaims = loadClaimsStrict();
} catch (error) {
  console.error(`[ERR-4019] verify-lane-claims: Claim-Register nicht lesbar (${error instanceof Error ? error.message : 'unbekannt'}).`);
  console.error('  Governance ist fail-closed: erst das Register reparieren, dann committen.');
  process.exit(1);
}

/** Genau ein Claim pro Lane-ID und pro Branch. Doppelte Eintraege sind ein Loch. */
for (const key of ['id', 'branch']) {
  const seen = new Set();
  for (const entry of allClaims) {
    if (seen.has(entry[key])) {
      console.error(`[ERR-4019] verify-lane-claims: doppelter ${key} '${entry[key]}' im Claim-Register.`);
      process.exit(1);
    }
    seen.add(entry[key]);
  }
}

const claims = allClaims.filter((c) => c.status === 'open');
// Ein gemergter Claim gilt fuer seinen eigenen Branch weiter: so landet der
// Register-Nachtrag auf dem Branch der zuletzt gemergten Lane, ohne dass ein
// neuer offener Claim mit bereits gemergtem PR entsteht.
const laneClaim = selectClaim(allClaims, branch);
const claim = laneClaim ?? botClaim(branch);
const bot = laneClaim === null && claim !== null;

/**
 * `main` ist der geschützte Zweig: dort gilt der Remote-Schutz mit dem
 * Pflichtstatus "Fail-Closed Gates", nicht die Lane-Allowlist. Ein Claim auf
 * main wäre eine zweite Wahrheit neben dem Branch-Schutz.
 */
if (branch === 'main') {
  console.log('verify-lane-claims: main ist durch den Branch-Schutz gedeckt; Lane-Allowlist gilt nur für Arbeitsbranches.');
  process.exit(0);
}

if (!claim) {
  console.error(`[ERR-4019] verify-lane-claims: Kein Lane-Claim für Branch '${branch}' in .lane-claims/`);
  console.error('  Erst einen Claim mit `pnpm run claim:register` registrieren (AGENTS.md § Governance / Lanes).');
  process.exit(1);
}

/** Feste Owner: eine Lane ohne benannten Owner ist keine Lane. */
if (!bot && !OWNERS.includes(claim.owner)) {
  console.error(`[ERR-4019] verify-lane-claims: Owner '${claim.owner}' ist nicht im festen Roster (${OWNERS.join(', ')}).`);
  process.exit(1);
}

if (!bot && !BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
  console.error(`[ERR-4019] verify-lane-claims: Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>.`);
  process.exit(1);
}

if (claim.status === 'merged') {
  console.log(`verify-lane-claims: '${claim.id}' ist gemergt; der Branch fuehrt unter derselben Allowlist weiter.`);
}

/** Erster Commit im Bereich, der das Register beruehrt; leer heisst: keiner. */
function firstTouchCommit(range) {
  try {
    return (
      execFileSync('git', ['rev-list', '--reverse', range, '--', '.lane-claims'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split(/\r?\n/)
        .find(Boolean) ?? ''
    );
  } catch {
    return '';
  }
}

/** Registerstand an einer Ref; `null` heisst: nicht lesbar (fail-closed). */
function registerAt(ref) {
  const entries = [];
  try {
    const data = JSON.parse(
      execFileSync('git', ['show', `${ref}:.lane-claims/claims.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    );
    if (!Array.isArray(data)) return null;
    entries.push(...data);
  } catch {
    // Kein Legacy-Register an dieser Ref: Claim-Dateien koennen trotzdem existieren.
  }
  try {
    const names = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', '.lane-claims/claims'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter((name) => name.endsWith('.json'));
    for (const name of names) {
      const data = JSON.parse(
        execFileSync('git', ['show', `${ref}:${name}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
      );
      entries.push(...(Array.isArray(data) ? data : [data]));
    }
  } catch {
    // Kein Claim-Verzeichnis an dieser Ref.
  }
  return entries.length > 0 ? entries : null;
}

/**
 * Die Basis ist die vertrauenswuerdige Wahrheit fuer die Allowlist. Zusaetzlich
 * zaehlt die erste Beruehrung des Registers im PR als Registrierung: sonst
 * koennte eine Lane ihren Claim mit jedem Push weiter ausdehnen, weil die
 * Basis den Branch noch gar nicht kennt. Eine Selbsterweiterung ist damit
 * selbst dann sichtbar, wenn sie ueber mehrere Commits verteilt wird.
 */
if (CI) {
  const baseRegister = registerAt(BASE_REF);
  if (!baseRegister) {
    console.error(`[ERR-4019] verify-lane-claims: Claim-Register der Basis '${BASE_REF}' nicht lesbar; ohne Basis keine Freigabe.`);
    process.exit(1);
  }
  const firstTouch = firstTouchCommit(`${BASE_REF}..${HEAD_REF}`);
  const firstRegister = firstTouch ? registerAt(firstTouch) : null;
  const audit = auditRegisterAgainstBase({
    baseClaims: baseRegister,
    registrationClaims: firstRegister ?? baseRegister,
    nextClaims: allClaims.map((entry) => entry.toJSON()),
    branch,
  });
  if (!audit.ok) {
    console.error(`[ERR-4019] verify-lane-claims: Claim-Register gegen die Basis veraendert (${branch}):`);
    for (const entry of audit.violations) console.error(`  - ${entry}`);
    console.error('  Eine Lane erweitert weder ihre eigene Allowlist noch fremde Claims; Registerpflege ist Governance.');
    process.exit(1);
  }
  console.log('verify-lane-claims: Register gegen die Basis geprueft (keine Selbsterweiterung).');
}

// Die acht Meta-Dateien kommen aus scripts/lib/lane-claims.mjs: eine Liste fuer
// Gate und turn:finish, damit die Sperre nicht an zwei Stellen driftet.

/** Hook-Dateien: sie gehören der Governance-Lane, nie einer Feature-Lane. */
const HOOK_FILES = Object.freeze(['.githooks/pre-commit', '.githooks/commit-msg']);

/** Der mechanische Schreibpfad des Systems: Doku-Marker und Versionszeile. */
const SYSTEM_LINE = /^[+-](<!--\s*rbd-doc:.*-->|"version":\s*".*",?|)\s*$/;

/** Geaenderte Diff-Zeilen einer Datei; `null` heisst: Diff nicht lesbar. */
function diffLines(file) {
  let diff;
  try {
    diff = DIFF_BASE
      ? git(['diff', '--unified=0', DIFF_BASE, '--', file])
      : git(['diff', '--cached', '--unified=0', '--', file]);
  } catch {
    return null;
  }
  return diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
}

function onlySystemLines(file) {
  const changed = diffLines(file);
  if (changed === null) return false;
  if (changed.length === 0) return true;
  return changed.every((line) => SYSTEM_LINE.test(line));
}

const staged = (DIFF_BASE
  ? git(['diff', '--name-only', '--diff-filter=ACMR', DIFF_BASE])
  : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
).split(/\r?\n/).filter(Boolean);

// CI prueft den ganzen Branch-Diff, also auch Arbeit, die aus bereits
// gemergten Lanes stammt. Deren Pfade sind gedeckt - aber nur durch Claims,
// die wirklich als `merged` registriert sind. Ein Pfad ohne jeden Claim
// bleibt eine Verletzung, auch in CI.
// CI und Merge pruefen einen Stand, der fremde Arbeit enthaelt; nur ein
// normaler Commit prueft ausschliesslich die eigene Arbeit.
const mergedClaims = (CI || MERGING) ? allClaims.filter((c) => c.status === 'merged') : [];

// Loeschungen fremder Lane-Dateien sind eine Uebergabe, kein Schreiben: die
// Governance-Lane gibt zurueck, was eine andere Lane besitzt. Der Diff zeigt
// nur die Loeschung; der Pfad bleibt der anderen Lane zugeordnet.
const deletedFiles = new Set((DIFF_BASE
  ? git(['diff', '--name-only', '--diff-filter=D', DIFF_BASE])
  : git(['diff', '--cached', '--name-only', '--diff-filter=D'])
).split(/\r?\n/).filter(Boolean));

const violations = [];
const allowedBySystem = [];
const generatedMeta = [];
const inherited = [];
const handedOver = [];

for (const file of staged) {
  // Koordinationsdateien sind Werkzeug jeder Lane (Register, PIN-Freigabe);
  // sie brauchen keinen Allowlist-Eintrag und kollidieren nicht.
  if (COORDINATION_FILES.includes(file)) continue;
  // Task-Vertraege sind ebenfalls Lane-Werkzeug; das Vertrags-Gate prueft
  // Claim-Bindung und Phasenwechsel, nicht die Allowlist.
  if (isTaskContractPath(file)) continue;
  if (HOOK_FILES.includes(file)) {
    if (!claim.allowsPath(file)) violations.push(`${file} (Hook-Datei nur mit Claim)`);
    continue;
  }
  if (META_FILES.includes(file)) {
    // Generierte Anteile gehoeren ihrem Generator, nicht der Lane: Inventur,
    // Roadmap-Fortschritt und Doku-Marker entstehen deterministisch und sind
    // fuer jede Lane erlaubt. Handinhalt in derselben Datei bleibt gesperrt.
    if (generatedOnlyDiff(file, diffLines(file))) {
      generatedMeta.push(file);
      continue;
    }
    if (claim.allowsPath(file)) continue;
    if (onlySystemLines(file)) {
      allowedBySystem.push(file);
      continue;
    }
    violations.push(`${file} (Meta-Datei: nur Marker/Version; alles andere braucht einen Claim)`);
    continue;
  }
  if (claim.allowsPath(file)) continue;
  // Marker sind mechanisch: eine Zeile, die nur den kanonischen Doku-Marker
  // setzt, gehoert keinem Feature und braucht keine Lane. Dieselbe Auslegung
  // nutzt der Governance-Freeze; ohne sie erzeugt jede Marker-Normalisierung
  // einen Claim-Konflikt in jeder Lane.
  if (onlySystemLines(file)) {
    allowedBySystem.push(file);
    continue;
  }
  const mergedOwner = mergedClaims.find((c) => c.allowsPath(file));
  if (mergedOwner) {
    inherited.push(`${file} <- ${mergedOwner.id}`);
    continue;
  }
  if (deletedFiles.has(file)) {
    const owner = allClaims.find((c) => c !== claim && c.allowsPath(file));
    if (owner) {
      handedOver.push(`${file} -> ${owner.id}`);
      continue;
    }
  }
  violations.push(file);
}

if (violations.length > 0) {
  console.error(`[ERR-4019] verify-lane-claims: Dateien außerhalb der Lane-Allowlist für '${branch}':`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error(`  Erlaubte Pfade: ${claim.pathAllowlist.join(', ')}`);
  console.error(`  Meta-Dateien (gesperrt): ${META_FILES.join(', ')}`);
  process.exit(1);
}

// Eine Lane, deren Arbeit nachweislich gemergt ist, ist keine Kollision mehr,
// sondern ein veralteter Eintrag. Der geteilte Filter kennt beide Belege: den
// gemergten PR (braucht `gh`) und den baumgleichen Commit auf `main` aus der
// lokalen Historie (Squash-Merge, kein `gh` noetig). Ohne jeden Nachweis
// bleibt es fail-closed bei der Kollision. Pretask nutzt denselben Filter,
// damit Start und Gate nicht auseinanderlaufen.
const collisions = bot
  ? []
  : filterMergedCollisions({
      collisions: findCollisions(claim),
      claims,
      baseRef: BASE_REF,
      onMerged: (collision, evidence) => {
        console.log(`  ${collision.lane}: ${evidence.why}; als merged behandelt (Register nachziehen)`);
      },
    });
if (collisions.length > 0) {
  console.error(`[ERR-4019] verify-lane-claims: Lane-Kollisionen für '${branch}':`);
  for (const coll of collisions) {
    console.error(`  vs ${coll.lane}: ${coll.reason}`);
    if (coll.contractConflict.length > 0) {
      console.error(`    Contract-Konflikt: ${coll.contractConflict.join(', ')}`);
    }
  }
  process.exit(1);
}

if (inherited.length > 0) {
  console.log(`verify-lane-claims: ${inherited.length} Pfad(e) aus gemergten Lanes uebernommen:`);
  for (const entry of inherited) console.log(`  ${entry}`);
}

if (handedOver.length > 0) {
  console.log(`verify-lane-claims: ${handedOver.length} Pfad(e) an die besitzende Lane zurueckgegeben:`);
  for (const entry of handedOver) console.log(`  ${entry}`);
}

const systemNote = [
  allowedBySystem.length > 0 ? `${allowedBySystem.length} Meta-Datei(en) nur mit Marker/Version` : '',
  generatedMeta.length > 0 ? `${generatedMeta.length} generierte Inventur` : '',
].filter(Boolean).join(', ').replace(/^/, ', davon ').replace(/^, davon $/, '');
const scope = CI ? `CI-Diff ${RANGE}` : (MERGING ? `Merge-Diff ${DIFF_BASE}` : 'gestagte Dateien');
console.log(`  Branch-Ref: ${CI ? HEAD_REF : 'HEAD'}`);
console.log(`verify-lane-claims: Branch '${branch}' ist claim-konform (${staged.length} ${scope}${systemNote}).`);
process.exit(0);
