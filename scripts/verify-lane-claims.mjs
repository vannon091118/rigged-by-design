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
import { loadClaimsStrict, findCollisions, OWNERS, BRANCH_PATTERN, LEGACY_PREFIXES } from './lib/lane-claims.mjs';

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
const claim = claims.find((c) => c.branch === branch);

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
  console.error(`[ERR-4019] verify-lane-claims: Kein Lane-Claim für Branch '${branch}' in .lane-claims/claims.json`);
  console.error('  Erst einen Claim registrieren (scripts/lib/lane-claims.mjs, AGENTS.md § Governance / Lanes).');
  process.exit(1);
}

/** Feste Owner: eine Lane ohne benannten Owner ist keine Lane. */
if (!OWNERS.includes(claim.owner)) {
  console.error(`[ERR-4019] verify-lane-claims: Owner '${claim.owner}' ist nicht im festen Roster (${OWNERS.join(', ')}).`);
  process.exit(1);
}

if (!BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
  console.error(`[ERR-4019] verify-lane-claims: Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>.`);
  process.exit(1);
}

/**
 * Die acht Meta-Dateien. Sie sind für Feature-Lanes gesperrt: ein Agent darf
 * sie nicht inhaltlich schreiben. Das System schreibt nur Marker und Version
 * (Pre-Commit-Hook, doc-sync, version-bump); genau dieser Schreibpfad bleibt
 * erlaubt, damit ein Commit nicht an seiner eigenen Pflege scheitert.
 */
const META_FILES = Object.freeze([
  'AGENTS.md',
  'docs/INVENTORY.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVTAGEBUCH.md',
  'docs/ROADMAP.md',
  'package.json',
  'pnpm-lock.yaml',
]);

/** Hook-Dateien: sie gehören der Governance-Lane, nie einer Feature-Lane. */
const HOOK_FILES = Object.freeze(['.githooks/pre-commit', '.githooks/commit-msg']);

/** Der mechanische Schreibpfad des Systems: Doku-Marker und Versionszeile. */
const SYSTEM_LINE = /^[+-](<!--\s*rbd-doc:.*-->|"version":\s*".*",?|)\s*$/;

function onlySystemLines(file) {
  let diff;
  try {
    diff = DIFF_BASE
      ? git(['diff', '--unified=0', DIFF_BASE, '--', file])
      : git(['diff', '--cached', '--unified=0', '--', file]);
  } catch {
    return false;
  }
  const changed = diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
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
const inherited = [];
const handedOver = [];

for (const file of staged) {
  if (HOOK_FILES.includes(file)) {
    if (!claim.allowsPath(file)) violations.push(`${file} (Hook-Datei nur mit Claim)`);
    continue;
  }
  if (META_FILES.includes(file)) {
    if (claim.allowsPath(file)) continue;
    if (onlySystemLines(file)) {
      allowedBySystem.push(file);
      continue;
    }
    violations.push(`${file} (Meta-Datei: nur Marker/Version; alles andere braucht einen Claim)`);
    continue;
  }
  if (claim.allowsPath(file)) continue;
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

const collisions = findCollisions(claim);
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

const systemNote = allowedBySystem.length > 0 ? `, davon ${allowedBySystem.length} Meta-Datei(en) nur mit Marker/Version` : '';
const scope = CI ? `CI-Diff ${RANGE}` : (MERGING ? `Merge-Diff ${DIFF_BASE}` : 'gestagte Dateien');
console.log(`  Branch-Ref: ${CI ? HEAD_REF : 'HEAD'}`);
console.log(`verify-lane-claims: Branch '${branch}' ist claim-konform (${staged.length} ${scope}${systemNote}).`);
process.exit(0);
