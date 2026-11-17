#!/usr/bin/env node
/**
 * Promote: manueller Status-/Notausgang. Der PR-Check ist optional; der Merge
 * nach main erfolgt durch Mensch oder Agent. Rot wird ein Issue, kein Dump auf
 * `integration`; Timeout und Abbruch sind REMOTE_CI und kein roter Stand.
 *
 * Ein Lauf pro CI-Ergebnis. Die Wahrheit liegt im Branch und in Labels, nie in
 * der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden
 * Lauf, ein einzelner Lauf arbeitet deshalb den ganzen Rueckstand ab.
 *
 * `integration` ist der letzte Notausgang: sie laeuft nur, wenn ein Mensch sie
 * ueber `workflow_dispatch` mit `integrate=true` anfordert.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDENTITY } from './lib/identity.mjs';
import { manualDispatchAction } from './lib/promote-guard.mjs';
import { blockerFindings, readTaskContractAtRef, validateTaskContract } from './lib/task-contract.mjs';
import { isSupersededRun } from './lib/ci-state.mjs';
import { blockedIssuesFrom } from './lib/issue-scope.mjs';
import { contractHoldReason, staleBase, validatePlanArtifact } from './lib/promotion-state.mjs';
import { captureConsole } from './lib/compact.mjs';
import { createIntegration } from './lib/promote-integrate.mjs';
import { createMergeGreen } from './lib/promote-merge.mjs';
import { createPromoteCi } from './lib/promote-ci.mjs';
import { createPromotePr } from './lib/promote-pr.mjs';
import { createPromotionHead } from './lib/promote-head.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'promote' });

const MAIN = 'main';
const INTEGRATION = 'integration';
const RED_LABEL = 'integration/rot';
const CONFLICT_LABEL = 'integration/konflikt';
const branch = process.env.HEAD_BRANCH ?? '';
const conclusion = process.env.CONCLUSION ?? '';
const hasToken = Boolean(process.env.GH_TOKEN);
const event = process.env.EVENT ?? '';
const headSha = process.env.HEAD_SHA ?? '';
const mode = process.env.MODE ?? '';
// Der PR-Check ist optional; Lauf-ID und Basis bleiben nur als Kontext fuer
// die Statusanzeige erhalten und sind keine Merge-Bedingung.
const ciRunId = process.env.CI_RUN_ID ?? '';
const baseSha = process.env.BASE_SHA ?? '';
const runAttempt = Number(process.env.RUN_ATTEMPT ?? 1) || 1;
const planDir = process.env.CI_PLAN_DIR ?? '.ci-plan';
const repo = process.env.GITHUB_REPOSITORY ?? '';
const owner = repo.split('/')[0] ?? '';
// Nur ein voller SHA ist die Identitaet, die die CI geprueft hat. Ein fehlender
// oder kurzer Wert wird nie als "passt schon" behandelt.
const FULL_SHA = /^[0-9a-f]{40}$/;
// Ein Merge mit dem Workflow-Token startet keinen Workflow; das eigene Token
// ist die Stufe, die CI, Tag und APK wieder in Gang setzt.
const elevated = Boolean(process.env.PROMOTE_TOKEN);
// Notausgang nur auf Anforderung, nie automatisch bei jedem roten Lauf.
const integrateRequested = ['1', 'true'].includes(String(process.env.INTEGRATE ?? '').toLowerCase());
// Timeout, Abbruch und Startfehler sind REMOTE_CI: CI erneut starten, nicht integrieren.
const REMOTE_CONCLUSIONS = new Set(['timed_out', 'cancelled', 'startup_failure']);

const run = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};
const git = (args) => run('git', args);
const gh = (args) => (hasToken ? run('gh', args) : null);
const log = (message) => console.log(`promote: ${message}`);
const warn = (message) => console.log(`::warning::promote: ${message}`);
const RUN_ID = /^\d+$/;

/** Eine paginierte GitHub-Liste; `null` heisst nicht lesbar. */
/** BLOCKED-Issues, die nach der gemeinsamen Scope-Regel diese Lane treffen.
 * Rueckgabe `null` heisst: Liste nicht lesbar, Blockerlage unbekannt. */
function blockedIssues() {
  return blockedIssuesFrom(
    ci.listAll(`repos/${repo}/issues?state=open&per_page=100`),
    { branch },
  );
}

/** Ein Plan-Artefakt aus dem CI-Lauf; fehlt es, wird nicht gemergt. */
function readPlanArtifact() {
  const file = join(planDir, 'ci-plan.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Genau ein CI-State-Kommentar: den neuesten marker-tragenden Kommentar
 * aktualisieren, aeltere marker-tragende entfernen. Fremde Kommentare bleiben.
 */
/** Labels spiegeln den Vertrag; ein Hold entfernt `task:ready`. */
function newerRuns() {
  if (!RUN_ID.test(String(ciRunId)) || !FULL_SHA.test(headSha)) return [];
  const raw = gh([
    'api',
    `repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&head_sha=${headSha}&per_page=20`,
  ]);
  if (!raw) return [];
  try {
    return (JSON.parse(raw)?.workflow_runs ?? []).filter((entry) => entry.name === 'CI Verify');
  } catch {
    return [];
  }
}

/** Hold: Kommentar und Labels, kein Merge. */
const head = createPromotionHead({ git, branch, MAIN, headSha, warn });

const pr = createPromotePr({
  gh, git, warn, log, headRef: head.headRef, exactHead: head.exactHead, branch, MAIN, owner,
  headSha, baseSha, ciRunId, event, repo, headRepo: process.env.HEAD_REPO ?? '',
});

const ci = createPromoteCi({
  gh, hasToken, ciRunId, headSha, baseSha, runAttempt, repo, prInfo: pr.prInfo, warn,
});

/** Der Vertrag am geprueften Kopf; dieselbe Quelle wie der Merge. */
function contractAtHead() {
  return readTaskContractAtRef(head.headRef(), { branch })?.contract ?? null;
}

function label(number, name, note) {
  if (!number) return;
  gh(['label', 'create', name, '--color', 'd93f0b', '--description', note]);
  gh(['pr', 'edit', number, '--add-label', name]);
}


/** Gruener Merge: siehe `promote-merge.mjs`. */
const mergeGreen = createMergeGreen({
  gh, git, headRef: head.headRef, verifiedPr: pr.verifiedPr, holdPromotion: ci.holdPromotion, readPlanArtifact, validatePlanArtifact,
  blockedIssues, contractHoldReason, mergeText: pr.mergeText, writeBodyFile: pr.writeBodyFile, writeCiState: ci.writeCiState, syncTaskLabels: ci.syncTaskLabels,
  readTaskContractAtRef, validateTaskContract, blockerFindings, subject: pr.subject,
  elevated, headSha, baseSha, MAIN, branch, staleBase, warn, log,
});

const integration = createIntegration({
  git, gh, label, log, warn, subject: pr.subject, openPr: pr.openPr,
  MAIN, INTEGRATION, RED_LABEL, CONFLICT_LABEL, branch, identity: IDENTITY,
});


head.fetchHead();
log(`Lauf aus vertrauenswuerdigem ${MAIN}${headSha ? `; Kopf ${headSha}` : ''}${branch ? ` (${branch})` : ''}`);

if (!event) {
  // Ein manueller Dispatch bringt keinen CI-Nachweis mit. Er zeigt nur an
  // oder oeffnet den ausdruecklichen Notausgang; `success` wird nie gesetzt.
  const action = manualDispatchAction(mode);
  if (action === 'integrate') {
    log('manuell: Notausgang integration angefordert');
    integration.promoteRed();
  } else {
    const number = process.env.PR_NUMBER ?? pr.openPr();
    const info = number ? pr.prInfo(number) : null;
    log(
      info
        ? `manuell: PR #${number} ${info.state}, Kopf ${String(info.headRefOid ?? '').slice(0, 7)}, Basis ${info.baseRefName}; kein Merge ohne gruenen PR-Lauf`
        : 'manuell: keine Aktion (inspect); Merge nur aus einem gruenen PR-Lauf',
    );
  }
} else if (event === 'push' && branch && branch !== MAIN) {
  // Jeder Feature-Push oeffnet oder aktualisiert den PR. Frueher endete der Lauf
  // hier nach einer Logzeile; der PR entstand erst spaeter, und ohne PR lief das
  // leichte Gate statt der vollen PR-Pruefung.
  const number = pr.ensurePr();
  if (number) {
    pr.syncPrBody(number);
    log(`Feature-Push ${branch}: PR #${number} bereit; die vollen Gates laufen im PR-Lauf`);
  } else {
    warn(`Feature-Push ${branch}: kein PR angelegt; der naechste Lauf prueft erneut`);
  }
} else if (!branch || branch === MAIN) {
  log('main wird nicht promotet');
} else if (conclusion === 'success') {
  if (event === 'push' && branch !== MAIN) {
    // Gruener Feature-Push: PR anlegen, nicht mergen. Der PR-Lauf ist das volle
    // Gate; erst danach entscheidet der naechste Promote-Lauf ueber den Merge.
    const number = pr.ensurePr();
    if (number) log(`PR #${number} fuer ${branch} angelegt; das volle Gate laeuft im PR`);
    else warn(`kein PR fuer ${branch}; Promote im PR-Lauf pruefen`);
  } else {
    const number = pr.ensurePr();
    if (!number) warn(`kein PR fuer ${branch}; Merge uebersprungen`);
    else if (!mergeGreen(number)) warn(`PR #${number} nicht gemergt (PR-Status nicht verifiziert)`);
  }
} else if (REMOTE_CONCLUSIONS.has(conclusion)) {
  const number = pr.openPr();
  if (number) {
    const contract = contractAtHead();
    const superseded = conclusion === 'cancelled'
      && isSupersededRun({ id: ciRunId, head_sha: headSha }, newerRuns());
    const state = superseded ? 'SUPERSEDED' : 'REMOTE_CI';
    ci.writeCiState({
      number,
      state,
      conclusion,
      contract,
      nextAction: superseded
        ? 'Ein neuerer CI-Lauf ist die Autoritaet; diesen Zustand nicht als Merge-Beleg verwenden.'
        : 'REMOTE_CI: CI erneut starten; kein BLOCKED, kein Dump auf integration.',
    });
    ci.syncTaskLabels(number, contract, true);
    if (!superseded) {
      label(number, 'ci/remote', 'Timeout oder Abbruch: CI erneut starten (REMOTE_CI)');
      gh(['pr', 'comment', number, '--body', `Der Lauf endete mit \`${conclusion}\`. Das ist REMOTE_CI (ERR-4014/ERR-4016): CI erneut starten. Kein \`BLOCKED\`, kein Dump auf \`${INTEGRATION}\`.`]);
    }
    log(superseded ? 'SUPERSEDED: neuerer Lauf ist die Autoritaet.' : `REMOTE_CI: ${conclusion} - kein roter Stand, kein Integrations-Dump`);
  } else {
    log(`REMOTE_CI: ${conclusion} - kein PR, kein Integrations-Dump`);
  }
} else if (conclusion === 'failure') {
  const number = pr.openPr();
  if (number) {
    const contract = contractAtHead();
    ci.writeCiState({
      number,
      state: 'FAILURE',
      conclusion,
      contract,
      nextAction: 'Befund beheben, turn:finish erneut ausfuehren; der naechste PR-Lauf entscheidet.',
    });
    ci.syncTaskLabels(number, contract, true);
    label(number, RED_LABEL, 'Roter Stand: Issue und Label, Integration nur auf Anforderung');
  }
  if (integrateRequested) {
    integration.promoteRed();
  } else {
    log('rot: Issue und Label gesetzt; `integration` nur auf Anforderung (Dispatch mit integrate=true)');
  }
} else {
  log(`Ergebnis ${conclusion || 'unbekannt'}: nichts zu tun`);
}
