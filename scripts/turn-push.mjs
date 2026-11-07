#!/usr/bin/env node
/** Turn-Abschluss: optional affected-Tests, alles stagen, verify:all, deutscher Steam-Notes-Commit, Push nach main. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { bumpPatch } from './version-bump.mjs';
import { IDENTITY } from './lib/identity.mjs';
import { claimForBranch } from './lib/lane-claims.mjs';
import { scopeChanges } from './lib/staging-scope.mjs';
import {
  classifyPaths,
  describeDiff,
  evaluateNotes,
  hasCodeChanges,
  parseNameStatus,
  REQUIRED_SECTIONS,
} from './lib/body-sync.mjs';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitRun = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const npmRun = (args) =>
  spawnSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
const TARGET_BRANCH = 'main';
const MAX_PUSH_VERSUCHE = 3;

// Light ist der Normalfall: Lint, LOC, Typecheck, Doku-, Tree- und Redundanz-Gate.
// Tests, Build und Audit gehoeren nach GitHub Actions und laufen nicht in jedem
// Turn. Breiter pruefen: `--profile=quick` (schnelle halbe Suite) oder
// `--profile=full` (verify:all, lokal die Ausnahme).
const args = process.argv.slice(2);
const profileArg = args.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'light';
if (!['light', 'quick', 'full'].includes(PROFILE)) {
  fail(1, 'ERR-4024', 'turn:finish', `unbekanntes Profil ${PROFILE}; erlaubt sind light, quick und full`);
  process.exit(1);
}
const VERIFY_SCRIPT = PROFILE === 'full' ? 'verify:all' : `verify:${PROFILE}`;

// main ist PR-Ziel, nie Agent-Arbeitsbranch. Ein Turn auf main bricht hier ab,
// statt in den Branch-Schutz zu laufen und den Commit lokal liegen zu lassen.
const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch === TARGET_BRANCH) {
  fail(1, 'ERR-4023', 'turn:finish', 'main ist PR-Ziel; auf einer Lane arbeiten (git switch -c lane/<domäne>/<task>)');
  process.exit(1);
}
const EXPLICIT_AFFECTED = args.includes('--affected');
const SKIP_AFFECTED = args.includes('--no-affected') || PROFILE !== 'light';
const paths = args.filter((value) => !value.startsWith('--'));
console.log(`turn:finish: Profil ${PROFILE} (${VERIFY_SCRIPT})${SKIP_AFFECTED ? '' : ' + betroffene schnelle Tests'}`);

/** Geaenderte Pfade; bei einem Rename beide Seiten. */
const changedPaths = () =>
  git(['status', '--porcelain'])
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => line.slice(2).trim().split(' -> '))
    .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);

// Kein globales `git add -A`: der Index bekommt genau die Pfade des Claims
// plus die Versionsdateien. Fremde WIP eines parallelen Agenten bleibt im
// Arbeitsbaum, auch wenn die Vorabpruefung sie nicht als fremd erkennt.
const stage = () => {
  if (paths.length > 0) {
    git(['add', '--', ...paths]);
    return;
  }
  const claim = claimForBranch(currentBranch);
  if (!claim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${currentBranch}'; kein Staging ohne Allowlist`);
    process.exit(1);
  }
  const scope = scopeChanges({ changed: changedPaths(), allowlist: claim.pathAllowlist });
  if (!scope.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${scope.foreign.slice(0, 8).join(', ')}`);
    process.exit(1);
  }
  const list = [...new Set([...scope.allowed, 'package.json', 'pnpm-lock.yaml'])];
  git(['add', '-A', '--', ...list]);
};

// Erst pruefen, ob ueberhaupt etwas ansteht: ein Bump ohne Aenderung erzeugte leere Versions-Commits.
const schmutz = git(['status', '--porcelain', ...(paths.length > 0 ? ['--', ...paths] : [])]);
const offenVorab = Number(git(['rev-list', '--count', `origin/${TARGET_BRANCH}..HEAD`]));
if (!schmutz && offenVorab === 0) {
  console.log('turn:finish: keine Aenderungen zu committen');
  process.exit(0);
}
// Fremde Arbeit gehoert nicht in diesen Commit: Vor Bump und Staging wird der
// Arbeitsbaum gegen den eigenen Claim geprueft. `git add -A` darf keine WIP
// eines parallelen Agenten einsammeln; ein Pfad ausserhalb der Allowlist ist
// ein Befund (ERR-4019), keine stille Mitnahme.
if (paths.length === 0 && schmutz) {
  const claim = claimForBranch(currentBranch);
  if (!claim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${currentBranch}'; erst Claim eintragen, dann committen`);
    process.exit(1);
  }
  // `git()` trimmt die Gesamtausgabe; die erste Zeile hat damit kein
  // fuehrendes Leerzeichen mehr. `slice(2).trim()` liest beide Formen richtig,
  // sonst verloere ein Pfad wie `.lane-claims/claims.json` seinen Punkt und
  // gaelte als fremd.
  const changed = git(['status', '--porcelain'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(2).trim())
    .map((path) => path.split(' -> ').pop());
  const scope = scopeChanges({ changed, allowlist: claim.pathAllowlist });
  if (!scope.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${scope.foreign.slice(0, 8).join(', ')}; fremde Arbeit bleibt unangetastet`);
    process.exit(1);
  }
  console.log(`turn:finish: ${scope.allowed.length} Pfad(e) im Claim-Scope`);
}

// Entwicklungsstufe vor dem Versions-Bump: Ein Bump aendert package.json und
// wuerde die Auswahl auf alle Tests ausweiten. Der volle Verify-Lauf folgt
// trotzdem unveraendert; affected verkuerzt full/release nicht.
// Der lokale Abschluss führt die betroffenen schnellen Tests aus, BEVOR die
// Version gebumpt wird. Danach würde package.json als geänderte Konfiguration
// gelten und die Auswahl auf die ganze Suite ausweiten. quick/full führen ihre
// Tests ohnehin im Verify-Profil aus; dort wäre ein zweiter Lauf Doppelarbeit.
if (EXPLICIT_AFFECTED) {
  console.log('turn:finish: --affected ist jetzt das Standardverhalten; --no-affected überspringt es');
}
if (!SKIP_AFFECTED) {
  console.log('turn:finish: betroffene schnelle Tests vor dem Versions-Bump');
  // Eine alte Delegationsliste darf einen Turn ohne lange Nachweise nicht
  // faelschlich als "offen" melden.
  rmSync(resolve(ROOT, '.verify-cache', 'delegated.json'), { force: true });
  const affected = npmRun(['run', 'test:affected']);
  if (affected.status !== 0) {
    fail(1, 'ERR-4026', 'turn:finish', 'betroffene Tests sind rot; kein Commit und kein Push');
    process.exit(1);
  }
  let delegated = [];
  try {
    delegated = JSON.parse(readFileSync(resolve(ROOT, '.verify-cache', 'delegated.json'), 'utf8')).tests ?? [];
  } catch {
    // Keine lange Auswahl ist ein gültiger Zustand.
  }
  if (delegated.length > 0) {
    console.log(`turn:finish: ${delegated.length} lange Nachweis(e) offen; CI führt sie auf dem PR-Commit aus`);
    for (const test of delegated) console.log(`  offen: ${test}`);
  }
}
// Die Version gehoert in den Commit, nicht in einen Nachlauf: so bleibt main nach dem Push stehen.
// Ein zweiter Lauf nach rotem Gate darf nicht erneut bumpen, sonst springt die Version pro Versuch.
if (schmutz) {
  let headVersion = '';
  try {
    headVersion = JSON.parse(git(['show', 'HEAD:package.json'])).version ?? '';
  } catch {
    // Ohne package.json im HEAD wird gebumpt.
  }
  const treeVersion = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
  console.log(treeVersion === headVersion
    ? `turn:finish: Version ${bumpPatch()} gebumpt`
    : `turn:finish: Version ${treeVersion} bereits gebumpt (HEAD ${headVersion})`);
}

// Marker und Inventar VOR der Pruefung setzen: der Docs-Gate prueft
// INVENTORY-Abdeckung gegen git ls-files. Neue Dateien muessen dort schon
// erfasst sein, sonst ist verify:docs rot, obwohl der Pre-Commit-Hook sie
// erst spaeter schreiben wuerde.
if (paths.length > 0) {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs', '--staged'], { cwd: ROOT, stdio: 'ignore' });
  spawnSync(process.execPath, ['scripts/build-inventory.mjs'], { cwd: ROOT, stdio: 'ignore' });
  git(['add', '--', 'docs/INVENTORY.md']);
} else {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs'], { cwd: ROOT, stdio: 'ignore' });
}

const verify = npmRun(['run', VERIFY_SCRIPT]);
if (verify.status !== 0) {
  fail(1, 'ERR-4024', 'turn:finish', `${VERIFY_SCRIPT} ist rot; kein Commit und kein Push`);
  process.exit(1);
}
stage();
const staged = git(['diff', '--cached', '--name-only']);
// Ein früherer Lauf kann einen Commit erzeugt haben, der den Push nicht mehr geschafft hat.
// Ohne diesen Zweig würde der nächste Lauf "keine Aenderungen" melden und den Commit
// stillschweigend liegen lassen.
const offen = Number(git(['rev-list', '--count', `origin/${TARGET_BRANCH}..HEAD`]));
if (!staged) {
  if (offen === 0) {
    console.log('turn:finish: keine Aenderungen zu committen');
    process.exit(0);
  }
  console.log(`turn:finish: ${offen} Commit(s) warten noch auf den Push; kein neuer Commit noetig`);
}

const files = staged.split(/\r?\n/).filter(Boolean);
console.log(`turn:finish: ${files.length} Datei(en) gestaged`);
// Der Diff entscheidet, ob eine Vorlage ueberhaupt zulaessig ist. Die alte
// generische Behauptung ("laeuft ueber den Store-Vertrag") war fuer jede
// Aenderung falsch, die genau das nicht tut. Echte Codeaenderungen brauchen
// inhaltliche Notes; reine Doku- und Versionsaenderungen werden ehrlich benannt.
const entries = parseNameStatus(git(['diff', '--cached', '--name-status']));
const groups = classifyPaths(entries);
const notesPath = resolve(ROOT, '.turn-notes.md');
const notes = existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : '';
const notesCheck = evaluateNotes(notes);
if (!notesCheck.ok && hasCodeChanges(groups)) {
  const code = [...groups.runtime, ...groups.tests, ...groups.content, ...groups.tooling]
    .slice(0, 8)
    .map((entry) => entry.path)
    .join(', ');
  fail(1, 'ERR-4006', 'turn:finish', `Codeaenderung ohne inhaltliche .turn-notes.md (${code}); kein irrefuehrender Commit`);
  process.exit(1);
}
let message;
if (notesCheck.ok) {
  message = notes.trim();
} else {
  message = [
    `Doku/Governance: ${files.length} Datei(en) aktualisiert`,
    '',
    REQUIRED_SECTIONS[0],
    ...describeDiff(entries, { groups }).map((line) => `- ${line}`),
    '',
    REQUIRED_SECTIONS[1],
    '- Keine Runtime-, Test- oder Inhaltsaenderung im Diff; geaendert sind nur Dokumentation, Governance oder die Versionszeile.',
    '',
    REQUIRED_SECTIONS[2],
    '- Offene Punkte stehen in docs/ROADMAP.md; dieser Commit behauptet keine Spielaenderung.',
  ].join('\n');
}

const gitDir = git(['rev-parse', '--git-dir']);
const messageFile = resolve(ROOT, gitDir, 'TURN_COMMIT_MSG');
writeFileSync(messageFile, `${message}\n`);
spawnSync(process.execPath, ['scripts/sanitize-commit.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
const gate = spawnSync(process.execPath, ['scripts/verify-commit-msg.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
if (gate.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', 'Commit-Nachricht besteht das Notes-Gate nicht');
  process.exit(1);
}

// Zwei Commits mit demselben Titel sind fast immer eine liegengebliebene Notes-Datei.
const titel = (readFileSync(messageFile, 'utf8').split('\n', 1)[0] ?? '').trim();
if (titel && titel === git(['log', '-1', '--pretty=%s'])) {
  fail(1, 'ERR-4006', 'turn:finish', `Titel "${titel}" ist identisch mit HEAD; neue .turn-notes.md schreiben`);
  process.exit(1);
}

// Identitaet fest verdrahtet: Committer bleibt der Eigentuemer, egal welcher
// Runner, welche Sandbox oder welches lokale `git config` gerade aktiv ist.
git(['-c', `user.name=${IDENTITY.name}`, '-c', `user.email=${IDENTITY.email}`, 'commit', '-F', messageFile]);
// Verbraucht: sonst traegt die naechste Runde denselben Text wieder ein.
if (existsSync(notesPath)) {
  rmSync(notesPath, { force: true });
  console.log('turn:finish: .turn-notes.md verbraucht');
}
console.log(`turn:finish: Commit ${git(['rev-parse', '--short', 'HEAD'])} erstellt`);

/**
 * Remote-Rueckstand zaehlen, oder null wenn der Remote nicht erreichbar ist.
 *
 * Seit die Version im Turn gebumpt wird, bewegt der Release-Workflow `main` nicht mehr.
 * Das Nachziehen bleibt als Netz fuer den Fall, dass jemand anders auf main pusht.
 */
const rueckstand = () => {
  if (gitRun(['fetch', 'origin']).status !== 0) return null;
  try {
    return Number(git(['rev-list', '--count', `HEAD..origin/${TARGET_BRANCH}`]));
  } catch {
    return null;
  }
};

/** Lokal auf den Remote aufsetzen; bei Dreck im Arbeitsbaum stasht rebase selbst. */
const neuAufsetzen = (anzahl) => {
  console.log(`turn:finish: origin/${TARGET_BRANCH} ist um ${anzahl} Commit(s) voraus; ich setze lokal neu auf`);
  const dreckig = git(['status', '--porcelain']);
  const args = ['rebase', ...(dreckig ? ['--autostash'] : []), `origin/${TARGET_BRANCH}`];
  if (gitRun(args).status === 0) return true;
  gitRun(['rebase', '--abort']);
  return false;
};

/**
 * Nach dem Push: lokal nur gemergte Wegwerf-Branches entfernen. Nie fatal —
 * ein liegengebliebener Zweig darf den Turn nicht rot machen.
 */
const aufraeumen = () => {
  const cleanup = spawnSync(process.execPath, ['scripts/branch-cleanup.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (cleanup.status !== 0) console.log('turn:finish: Branch-Aufraeumen uebersprungen');
};

/**
 * Pushen mit Nachziehen: Erst wenn der Remote aktuell ist, geprueft wurde und der Push
 * trotzdem abgelehnt wird, handelt es sich um Branch-Schutz und nicht um Rebase-Rueckstand.
 */
let branchSchutz = false;
let grund = `Push auf ${TARGET_BRANCH} nicht moeglich`;
for (let versuch = 1; versuch <= MAX_PUSH_VERSUCHE; versuch += 1) {
  const rueck = rueckstand();
  if (rueck === null) {
    grund = `kein Zugriff auf origin/${TARGET_BRANCH}`;
    break;
  }
  if (rueck > 0) {
    if (!neuAufsetzen(rueck)) {
      grund = `Merge-Konflikt beim Nachziehen von origin/${TARGET_BRANCH}`;
      break;
    }
    // Der neu aufgesetzte Baum enthaelt Remote-Arbeit und wurde noch nie geprueft.
    if (npmRun(['run', VERIFY_SCRIPT]).status !== 0) {
      fail(1, 'ERR-4024', 'turn:finish', `${VERIFY_SCRIPT} nach dem Nachziehen ist rot; kein Push, der Commit bleibt lokal`);
      process.exit(1);
    }
    stage();
    if (git(['diff', '--cached', '--name-only'])) {
      git(['commit', '--amend', '--no-edit']);
      console.log(`turn:finish: nach dem Nachziehen amendiert: ${git(['rev-parse', '--short', 'HEAD'])}`);
    }
    continue;
  }
  if (gitRun(['push', '-u', 'origin', 'HEAD']).status === 0) {
    console.log(`turn:finish: PASS, Arbeitsbranch ${currentBranch} gepusht (promote legt den PR gegen ${TARGET_BRANCH} an)`);
    aufraeumen();
    process.exit(0);
  }
  const erneut = rueckstand();
  if (erneut !== null && erneut > 0) {
    console.log(`turn:finish: origin/${TARGET_BRANCH} lief waehrend des Pushes weiter; neuer Versuch`);
    continue;
  }
  branchSchutz = true;
  break;
}

if (!branchSchutz) {
  fail(1, 'ERR-4008', 'turn:finish', `${grund}; der Commit bleibt lokal liegen`);
  process.exit(1);
}
const pushBranch = gitRun(['push', '-u', 'origin', 'HEAD']);
if (pushBranch.status !== 0) {
  fail(1, 'ERR-4008', 'turn:finish', `Push auf ${TARGET_BRANCH} und auf den Arbeitsbranch fehlgeschlagen`);
  process.exit(1);
}
aufraeumen();
fail(1, 'ERR-4023', 'turn:finish', `Direkter Push auf ${TARGET_BRANCH} abgelehnt; Branch gepusht. Fokussierter PR gegen ${TARGET_BRANCH} noetig`);
process.exit(1);
