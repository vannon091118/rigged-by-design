#!/usr/bin/env node
/** Turn-Abschluss: betroffene Tests, verify:light, Commit und Push auf den Arbeitsbranch. Kein Auto-Rebase, kein Force-Push; der PR wird durch promote gemergt. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { bumpPatch } from './version-bump.mjs';
import { IDENTITY } from './lib/identity.mjs';
import { claimForBranch } from './lib/lane-claims.mjs';
import {
  loadTaskContractForClaim,
  makeTaskContract,
  readPullRequestState,
  transitionTaskContract,
  validateTaskContract,
  writeTaskContract,
} from './lib/task-contract.mjs';
import { explicitScope, scopeChanges } from './lib/staging-scope.mjs';
import { classifyConflicts } from './lib/generated-files.mjs';
import { afterTaskState, writeAfterTask } from './task-state.mjs';
import {
  classifyPaths,
  describeDiff,
  evaluateNotes,
  hasCodeChanges,
  parseNameStatus,
  REQUIRED_SECTIONS,
} from './lib/body-sync.mjs';
import { resolve } from 'node:path';
import { causeBlock, causeForGate, localCauses } from './agent-cause.mjs';
import { fail, ROOT } from './lib/report.mjs';
import { shouldResumePendingCommit } from './lib/pending-commit.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitRun = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const npmRun = (args) =>
  spawnSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
/** Roter Befund mit derselben Gate/Fix/Repro-Zeile wie `agent:cause`. */
const showCause = (findings) => {
  const block = causeBlock(findings);
  if (block) console.error(`\n${block}`);
};
const TARGET_BRANCH = 'main';

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
// Standard ist der lokale Preflight ohne Tests und ohne Typecheck: die CI
// prueft den gepushten Kopf. `--tests` und `--verify` sind das ausdrueckliche
// Opt-in; quick/full bleiben die breiteren Opt-ins.
const RUN_AFFECTED = !args.includes('--no-tests') && (args.includes('--tests') || PROFILE !== 'light');
const RUN_VERIFY = !args.includes('--no-verify') && (args.includes('--verify') || PROFILE !== 'light');

// main ist PR-Ziel, nie Agent-Arbeitsbranch. Ein Turn auf main bricht hier ab,
// statt in den Branch-Schutz zu laufen und den Commit lokal liegen zu lassen.
const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch === TARGET_BRANCH) {
  fail(1, 'ERR-4023', 'turn:finish', 'main ist PR-Ziel; auf einer Lane arbeiten (git switch -c lane/<domäne>/<task>)');
  process.exit(1);
}
const branchClaim = claimForBranch(currentBranch);
// Der Vertrag ist die Wahrheit; fehlt er, entsteht er beim ersten Turn aus
// dem Claim. Die Phasenpruefung laeuft gegen den im HEAD committeten Stand.
const contractLoad = branchClaim ? loadTaskContractForClaim(branchClaim) : { contract: null, file: null, error: null };
if (contractLoad.error) {
  fail(1, 'ERR-4019', 'turn:finish', contractLoad.error);
  process.exit(1);
}
let taskContract = contractLoad.contract;
if (branchClaim && !taskContract) {
  taskContract = makeTaskContract(branchClaim, {
    baseSha: git(['merge-base', 'HEAD', `origin/${TARGET_BRANCH}`]) || branchClaim.baseSha,
    nextAction: 'Erste Aenderung im Claim-Scope; danach turn:finish ohne Flags.',
  });
}
if (branchClaim && taskContract) {
  const contractCheck = validateTaskContract(taskContract, { claim: branchClaim, branch: currentBranch });
  if (!contractCheck.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Task-Vertrag ungueltig: ${contractCheck.violations.join('; ')}`);
    process.exit(1);
  }
}
const EXPLICIT_AFFECTED = args.includes('--affected');
const SKIP_AFFECTED = !RUN_AFFECTED;
const paths = args.filter((value) => !value.startsWith('--'));
console.log(`turn:finish: lokaler Preflight${RUN_AFFECTED ? ' + betroffene Tests' : ''}${RUN_VERIFY ? ` + ${VERIFY_SCRIPT}` : ''} (CI prueft den Push)`);

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
    git(['add', '-A', '--', ...paths]);
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
const resumePending = shouldResumePendingCommit({ worktreeClean: !schmutz, pendingCommits: offenVorab });
if (!schmutz && offenVorab === 0) {
  console.log('turn:finish: keine Aenderungen zu committen');
  process.exit(0);
}
if (resumePending) {
  console.log(`turn:finish: ${offenVorab} verifizierte Commit(s) warten; setze Integration und Push ohne neuen Bump fort`);
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

if (paths.length > 0) {
  if (!branchClaim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${currentBranch}'; explizite Pfade ohne Allowlist`);
    process.exit(1);
  }
  const explicit = explicitScope({ paths, allowlist: branchClaim.pathAllowlist });
  if (!explicit.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${explicit.foreign.join(', ')}`);
    process.exit(1);
  }
  console.log(`turn:finish: ${explicit.allowed.length} explizite Pfad(e) im Claim-Scope`);
}

// Entwicklungsstufe vor dem Versions-Bump: Ein Bump aendert package.json und
// wuerde die Auswahl auf alle Tests ausweiten. Der volle Verify-Lauf folgt
// trotzdem unveraendert; affected verkuerzt full/release nicht.
// Der lokale Abschluss führt die betroffenen schnellen Tests aus, BEVOR die
// Version gebumpt wird. Danach würde package.json als geänderte Konfiguration
// gelten und die Auswahl auf die ganze Suite ausweiten. quick/full führen ihre
// Tests ohnehin im Verify-Profil aus; dort wäre ein zweiter Lauf Doppelarbeit.
if (EXPLICIT_AFFECTED) {
  console.log('turn:finish: --affected ist ein Opt-in; Standard ist der Preflight ohne Tests, die CI prueft.');
}
let delegated = [];
if (!resumePending && !SKIP_AFFECTED) {
  console.log('turn:finish: betroffene schnelle Tests vor dem Versions-Bump');
  // Eine alte Delegationsliste darf einen Turn ohne lange Nachweise nicht
  // faelschlich als "offen" melden.
  rmSync(resolve(ROOT, '.verify-cache', 'delegated.json'), { force: true });
  const affected = npmRun(['run', 'test:affected']);
  if (affected.status !== 0) {
    fail(1, 'ERR-4026', 'turn:finish', 'betroffene Tests sind rot; kein Commit und kein Push');
    showCause([causeForGate('affected')]);
    process.exit(1);
  }
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
// INVENTORY-Abdeckung gegen git ls-files. Eigene Dateien muessen zuerst im
// Index stehen, sonst fehlen sie der Inventur und verify:docs blockiert den
// Task vor seinem regulären Staging-Schritt.
if (!resumePending) stage();
if (!resumePending && paths.length > 0) {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs', '--staged'], { cwd: ROOT, stdio: 'ignore' });
} else if (!resumePending) {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs'], { cwd: ROOT, stdio: 'ignore' });
}
if (!resumePending) {
  spawnSync(process.execPath, ['scripts/build-inventory.mjs'], { cwd: ROOT, stdio: 'ignore' });
  git(['add', '--', 'docs/INVENTORY.md']);
  const dependencyMatrix = spawnSync(process.execPath, ['scripts/sync-dependency-matrix.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (dependencyMatrix.status !== 0) {
    fail(1, 'ERR-4013', 'turn:finish', 'Dependency-Matrix konnte nicht synchronisiert werden; kein Commit und kein Push');
    process.exit(1);
  }
  git(['add', '--', 'docs/DEPENDENCY-MATRIX.md']);
}

if (RUN_VERIFY) {
  const verify = npmRun(['run', VERIFY_SCRIPT]);
  if (verify.status !== 0) {
    fail(1, 'ERR-4024', 'turn:finish', `${VERIFY_SCRIPT} ist rot; kein Commit und kein Push`);
    showCause(localCauses());
    process.exit(1);
  }
} else {
  console.log('turn:finish: kein lokales verify (CI prueft den Push); --verify erzwingt den Light-Lauf');
}
// Der Push ist die Uebergabe an die CI. Der Vertrag wechselt deshalb erst
// hier nach CI_PENDING; der Phasenwechsel wird gegen den HEAD-Stand geprueft.
if (!resumePending && branchClaim && taskContract) {
  const prState = readPullRequestState({ branch: currentBranch });
  const pr = prState.known && prState.number
    ? { number: prState.number, url: prState.url, state: prState.state, headSha: prState.headSha }
    : taskContract.pr;
  const transition = transitionTaskContract(
    taskContract,
    'CI_PENDING',
    {
      pr,
      nextAction: 'PR wird erzeugt/aktualisiert; CI meldet; nächster Schritt: PRETASK.',
    },
    { previous: contractLoad.contract },
  );
  if (!transition.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Phasenwechsel ungueltig: ${transition.violations.join('; ')}`);
    process.exit(1);
  }
  taskContract = transition.contract;
  writeTaskContract(contractLoad.file, taskContract);
  git(['add', '--', contractLoad.file]);
  console.log(`turn:finish: Task-Vertrag ${taskContract.phase} (Revision ${taskContract.revision})`);
}
if (!resumePending) stage();
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

let files = [];
if (!resumePending) {
files = staged.split(/\r?\n/).filter(Boolean);
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
// Eine Export-Entfernung ist nur nachvollziehbar, wenn die Notes die
// Verbraucherkette nennen. Das Gate kann die Kette nicht semantisch beweisen,
// aber es verhindert den blinden Cut ohne dokumentierte Pruefung.
const removedExports = git(['diff', '--cached', '-U0'])
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('---') && /^-\s*export\b/.test(line));
if (removedExports.length > 0 && !/(?:kette|chain|import|re-export|aufrufer|verbraucher)/i.test(notes)) {
  fail(
    1,
    'ERR-4003',
    'turn:finish',
    `Export-Entfernung ohne Chain-Trace in .turn-notes.md (${removedExports.length} Zeile(n)); Import-/Re-Export-/Aufrufer-Kette dokumentieren und reparieren, nicht blind cutten`,
  );
  process.exit(1);
}
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
}
const baseSha = (() => {
  try {
    return git(['merge-base', 'HEAD', `origin/${TARGET_BRANCH}`]);
  } catch {
    return branchClaim?.baseSha ?? '';
  }
})();
const commitSha = git(['rev-parse', 'HEAD']);
const afterTask = {
  state: afterTaskState({ gateOk: true, pushed: false }),
  branch: currentBranch,
  head: commitSha,
  base: baseSha,
  claim: branchClaim ? { id: branchClaim.id, owner: branchClaim.owner, branch: branchClaim.branch } : null,
  own: files,
  foreign: [],
  tests: { profile: RUN_VERIFY ? PROFILE : 'none', script: RUN_VERIFY ? VERIFY_SCRIPT : null, affected: RUN_AFFECTED, delegated },
  gate: { ok: true, profile: RUN_VERIFY ? PROFILE : 'none', script: RUN_VERIFY ? VERIFY_SCRIPT : null },
  next: [`git push -u origin ${currentBranch}`, 'PR wird erzeugt/aktualisiert; CI meldet; naechster Schritt: PRETASK'],
};
writeAfterTask(afterTask);

const rueckstand = () => {
  if (gitRun(['fetch', 'origin']).status !== 0) return null;
  try {
    return Number(git(['rev-list', '--count', `HEAD..origin/${TARGET_BRANCH}`]));
  } catch {
    return null;
  }
};
const rueck = rueckstand();
if (rueck === null) {
  fail(1, 'ERR-4008', 'turn:finish', `origin/${TARGET_BRANCH} nicht lesbar; kein Push ohne Vergleich`);
  process.exit(1);
}
/** Bereits veroeffentlicht: Rebase wuerde fremde Historie umschreiben. Dann
 * wird die Basis gemergt; ein unveroeffentlichter Branch geht through
 * `integrate --apply` (Rebase plus Regeneration). */
const publishedBranch = () =>
  spawnSync('git', ['rev-parse', '--verify', `origin/${currentBranch}`], { cwd: ROOT, stdio: 'ignore' }).status === 0;

const conflictedFiles = () =>
  git(['diff', '--name-only', '--diff-filter=U']).split(/\r?\n/).filter(Boolean);

/** Generierte Artefakte, die jede Integration neu schreiben muss. */
const GENERATED_PATHS = ['docs/INVENTORY.md', 'docs/ROADMAP.md', 'content/narrative/registry', 'src/core/sim/narrative/composer'];

const regenerateGenerated = () => {
  const regenerated = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts', 'sync-generated.mjs'), '--all'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (regenerated.status !== 0) return false;
  if (!git(['status', '--porcelain', '--', ...GENERATED_PATHS])) return true;
  git(['add', '-A', '--', ...GENERATED_PATHS]);
  return true;
};

/**
 * Nach der Integration muss die Regeneration im Commit landen: ein sauberer
 * Merge enthaelt die neuen Dateien der Basis, aber nicht die daraus folgende
 * Inventur. Ohne diesen Commit geht ein Baum in die CI, dessen Doku-Gate rot
 * ist, obwohl der Merge gelungen ist. Der Commit beruehrt nur generierte
 * Artefakte und ist damit ein Pflege-Commit.
 */
const commitRegeneration = () => {
  if (!regenerateGenerated()) return false;
  if (!git(['status', '--porcelain', '--', ...GENERATED_PATHS])) return true;
  const messageFile = resolve(ROOT, git(['rev-parse', '--git-dir']), 'TURN_REGEN_MSG');
  writeFileSync(
    messageFile,
    [
      'Regeneration nach der Integration (Inventur, Registry)',
      '',
      '### Changes (Was ist neu)',
      '- Inventur, Roadmap-Fortschritt und Runtime-Registry sind nach der integrierten Basis neu erzeugt.',
      '',
      '### Technische Basis & Kausalität',
      '- Der Merge bringt neue Dateien mit; `git ls-files` und die Registry haetten sonst einen anderen Stand als der Baum, und das Doku-Gate waere rot.',
      '',
      '### Ausblick (Nächste Schritte)',
      '- CI prueft diesen Commit; danach PR und Merge.',
      '',
    ].join('\n'),
  );
  git(['add', '-A', '--', ...GENERATED_PATHS]);
  return gitRun(['commit', '-F', messageFile]).status === 0;
};

/** Ein Reparaturpfad statt eines Abbruchs: der Commit existiert bereits, also
 * wird die Basis integriert und nur ein echter Quellkonflikt eskaliert. */
const integrateBeforePush = () => {
  if (publishedBranch()) {
    const merged = gitRun(['merge', '--no-edit', `origin/${TARGET_BRANCH}`]);
    if (merged.status !== 0) {
      const { generated, source } = classifyConflicts(conflictedFiles());
      if (source.length > 0) {
        gitRun(['merge', '--abort']);
        fail(1, 'ERR-4008', 'turn:finish', `Quellkonflikt gegen origin/${TARGET_BRANCH}: ${source.slice(0, 8).join(', ')}; Commit bleibt erhalten, Konflikt manuell loesen`);
        process.exit(1);
      }
      for (const file of generated) {
        gitRun(['checkout', '--ours', '--', file]);
        gitRun(['add', '--', file]);
      }
      if (!regenerateGenerated()) {
        gitRun(['merge', '--abort']);
        fail(1, 'ERR-4008', 'turn:finish', 'Regeneration der generierten Artefakte fehlgeschlagen; Merge zurueckgesetzt');
        process.exit(1);
      }
      const continued = gitRun(['merge', '--continue']);
      if (continued.status !== 0) {
        gitRun(['merge', '--abort']);
        fail(1, 'ERR-4008', 'turn:finish', 'Merge nach der Regeneration nicht fortsetzbar; Zustand zurueckgesetzt');
        process.exit(1);
      }
    }
    if (!commitRegeneration()) {
      fail(1, 'ERR-4008', 'turn:finish', `Regeneration nach dem Merge fehlgeschlagen; Commit bleibt erhalten, Basis integriert`);
      process.exit(1);
    }
    return;
  }
  const applied = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'integrate.mjs'), '--apply', '--no-fetch'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (applied.status !== 0) {
    fail(1, 'ERR-4008', 'turn:finish', `integrate --apply nicht erfolgreich (Exit ${applied.status}); Commit bleibt erhalten`);
    process.exit(1);
  }
  if (!commitRegeneration()) {
    fail(1, 'ERR-4008', 'turn:finish', 'Regeneration nach dem Rebase fehlgeschlagen; Commit bleibt erhalten');
    process.exit(1);
  }
};

if (rueck > 0) {
  console.log(`turn:finish: origin/${TARGET_BRANCH} ist um ${rueck} Commit(s) voraus; Integration startet (`+
    `${publishedBranch() ? 'Merge' : 'integrate --apply'}).`);
  integrateBeforePush();
  const rest = rueckstand();
  if (rest === null || rest > 0) {
    fail(1, 'ERR-4008', 'turn:finish', `nach der Integration noch ${rest ?? 'unbekannter'} Rueckstand auf origin/${TARGET_BRANCH}; kein Push`);
    process.exit(1);
  }
}
const push = gitRun(['push', '-u', 'origin', 'HEAD']);
if (push.status !== 0) {
  fail(1, 'ERR-4008', 'turn:finish', `Push auf ${currentBranch} fehlgeschlagen; kein Force-Push, der Commit bleibt lokal`);
  process.exit(1);
}
writeAfterTask({
  ...afterTask,
  state: afterTaskState({ gateOk: true, pushed: true }),
  next: [
    `PR wird erzeugt/aktualisiert; CI meldet fuer ${commitSha.slice(0, 7)}`,
    'naechster Schritt: pnpm run agent:pretask --json (Phase, Befunde, naechste Aktion)',
    'pnpm run task:complete --run <id> nach gruenem Lauf',
  ],
});
// Der PR-Kommentar traegt denselben Stand wie der Vertrag; ohne `gh` bleibt er
// aus, die Wahrheit im Branch ist davon unabhaengig.
if (branchClaim && taskContract) {
  try {
    const body = [
      '<!-- rbd:task-contract -->',
      `### Task-Vertrag ${taskContract.taskId}`,
      '',
      `- Phase: \`${taskContract.phase}\``,
      `- Revision: ${taskContract.revision}`,
      `- Offene Befunde: ${(taskContract.findings ?? []).filter((finding) => finding.status === 'open').length}`,
      `- Naechster Schritt: ${taskContract.nextAction}`,
    ].join('\n');
    const dir = resolve(ROOT, git(['rev-parse', '--git-dir']));
    const commentFile = resolve(dir, 'TASK_CONTRACT_COMMENT.md');
    writeFileSync(commentFile, `${body}\n`, 'utf8');
    const view = spawnSync('gh', ['pr', 'view', currentBranch, '--json', 'number'], { cwd: ROOT, encoding: 'utf8' });
    const number = view.status === 0 ? JSON.parse(view.stdout).number : 0;
    if (number) {
      const edited = spawnSync('gh', ['pr', 'comment', String(number), '--edit-last', '--body-file', commentFile], { cwd: ROOT, stdio: 'ignore' });
      if (edited.status !== 0) spawnSync('gh', ['pr', 'comment', String(number), '--body-file', commentFile], { cwd: ROOT, stdio: 'ignore' });
    }
  } catch {
    // Der Kommentar ist Komfort; der Vertrag im Branch bleibt die Wahrheit.
  }
}
console.log(`turn:finish: PASS, ${currentBranch} gepusht. PR wird erzeugt/aktualisiert; CI meldet; naechster Schritt: PRETASK (pnpm run agent:pretask --json).`);
process.exit(0);
