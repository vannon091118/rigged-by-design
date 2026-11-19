/**
 * Claim-Lifecycle: Retention und Post-Merge-Closeout.
 *
 * Zwei getrennte Entscheidungen, beide rein und ohne Dateisystem:
 *
 * - `planRetention` haelt alle aktiven Tasks und die neuesten `keep`
 *   abgeschlossenen Tasks als Nachweis. Aktive Lanes zaehlen nicht gegen das
 *   Budget: eine volle Warteschlange verdraengt keinen Merge-Beleg mehr.
 *   Zugehoerige Claim-Dateien gehen mit, offene oder geparkte Claims bleiben.
 *   Das Legacy-Register `claims.json` wird nie beschnitten.
 * - `planTaskCloseout` zieht einen Task nach belegtem Merge von
 *   `CI_PENDING`, `MERGE_PENDING` oder `AFTERCARE` auf `DONE`; ein veraltetes
 *   `READY`/`IMPLEMENTING` wird nur bei nachweislich entferntem Branch
 *   geschlossen. Der Beleg ist der bereits auf `merged` gesetzte Claim; ein
 *   offener Blocker haelt den Task offen.
 *
 * Die Dateisystem-Schicht liegt in `reconcile-claims.mjs`,
 * `claim-register.mjs` und `post-merge-closeout.mjs`.
 */
import { validateTaskContract } from './task-contract.mjs';

// Budget fuer abgeschlossene Nachweise (Task + Claim-Datei). Aktive Lanes
// laufen getrennt und werden nie geloescht; sie zaehlen hier nicht mit.
export const CLOSED_TASK_RETENTION_LIMIT = 10;
export const CLOSEABLE_PHASES = Object.freeze(['CI_PENDING', 'MERGE_PENDING', 'AFTERCARE']);
export const ACTIVE_CLAIM_STATUSES = Object.freeze(['open', 'parked']);

const newestFirst = (left, right) =>
  (Number(right.committedAt) || 0) - (Number(left.committedAt) || 0) || left.file.localeCompare(right.file);

/** Dateiname eines Lane-Claims; dieselbe Regel wie `claim:register`. */
export function claimEntryPath(id) {
  const slug = String(id ?? '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug ? `.lane-claims/claims/${slug}.json` : '';
}

/** Alle aktiven Tasks und die neuesten `keep` abgeschlossenen Nachweise. */
export function planRetention({
  tasks = [],
  claims = [],
  keep = CLOSED_TASK_RETENTION_LIMIT,
  protectedTaskFiles = [],
  protectedClaimIds = [],
} = {}) {
  const limit = Number.isInteger(Number(keep)) && Number(keep) >= 0 ? Number(keep) : CLOSED_TASK_RETENTION_LIMIT;
  // `claims` sind Register-Eintraege mit Datei und Claim; die aktive Lane
  // haengt am Claim selbst, nicht am Dateinamen.
  const claimById = new Map(claims.map((entry) => [entry?.claim?.id, entry?.claim]));
  const hasActiveClaim = (task) => ACTIVE_CLAIM_STATUSES.includes(claimById.get(task?.contract?.claimId)?.status);
  // Ein DONE-Task mit offenem Claim ist ein Parity-Befund, kein Retentions-
  // Kandidat: erst den Claim schliessen, dann darf der Task altern.
  const active = tasks.filter((task) => task?.contract?.phase !== 'DONE' || hasActiveClaim(task));
  const closed = tasks
    .filter((task) => task?.contract?.phase === 'DONE' && !hasActiveClaim(task))
    .sort(newestFirst);
  // Aktive Tasks sind nicht loeschbar und verbrauchen das Nachweis-Budget
  // nicht. Sonst entfernt eine volle Warteschlange jeden Merge-Beleg sofort
  // und die Lane ist nach ihrem Merge nicht mehr nachvollziehbar.
  const retainedTasks = [...active, ...closed.slice(0, limit)];
  const retainedFiles = new Set(retainedTasks.map((task) => task.file));
  for (const file of protectedTaskFiles) retainedFiles.add(file);
  // Ein geschuetzter Task zaehlt fuer seine Claim-Datei, auch wenn er nicht in
  // der Auswahl liegt (z.B. die gerade bearbeitete Closeout-Lane).
  for (const task of tasks) if (protectedTaskFiles.includes(task.file)) retainedFiles.add(task.file);

  const removeTasks = tasks
    .filter((task) => !retainedFiles.has(task.file))
    .map((task) => task.file)
    .sort();
  const retainedClaims = new Set(
    tasks
      .filter((task) => retainedFiles.has(task.file))
      .map((task) => task?.contract?.claimId)
      .filter(Boolean),
  );
  for (const id of protectedClaimIds) retainedClaims.add(id);

  const removeClaims = [];
  const keptClaims = [];
  for (const entry of claims) {
    // Legacy-Claims haben keine eigene Datei und werden nie beschnitten.
    if (!entry?.file) continue;
    const activeClaim = ACTIVE_CLAIM_STATUSES.includes(entry.claim?.status);
    const keepClaim = activeClaim || retainedClaims.has(entry.claim?.id) || protectedClaimIds.includes(entry.claim?.id);
    if (keepClaim) keptClaims.push(entry.file);
    else removeClaims.push(entry.file);
  }

  return {
    keep: limit,
    activeTasks: active.length,
    closedTasks: closed.length,
    retainedTasks: [...retainedFiles].sort(),
    retainedClaims: keptClaims.sort(),
    removeTasks,
    removeClaims: removeClaims.sort(),
  };
}

/**
 * Branch-Status fuer bereits gemergte Claims.
 *
 * `planReconcile` liefert Evidenz nur fuer Claims, die es gerade umstellt. Ein
 * Claim, der schon `merged` ist, dessen Task aber noch in READY/IMPLEMENTING
 * steht, braucht denselben Beleg - sonst bleibt der Parity-Befund des doctor
 * dauerhaft stehen. `heads === null` heisst unerreichbar und bleibt `unknown`;
 * ein noch vorhandener Branch bleibt `pending`.
 */
export function mergedClaimEvidence({ claims = [], heads = null } = {}) {
  const evidence = new Map();
  for (const claim of claims) {
    if (claim?.status !== 'merged' || !claim.id) continue;
    const branchCleanup =
      heads === null
        ? { state: 'unknown', evidence: 'remote-heads-unreadable' }
        : heads.has(claim.branch)
          ? { state: 'pending', evidence: 'remote-branch-present' }
          : { state: 'done', evidence: 'remote-branch-absent' };
    evidence.set(claim.id, { branchCleanup });
  }
  return evidence;
}

/** Ein Task schliesst nur mit belastbarem Merge-Beleg und ohne offenen Blocker. */
export function planTaskCloseout({ tasks = [], claims = [], evidenceByClaim = new Map() } = {}) {
  const claimById = new Map(claims.map((claim) => [claim?.id, claim]));
  const changes = [];
  for (const task of tasks) {
    const contract = task?.contract;
    const claim = claimById.get(contract?.claimId);
    if (!contract || !claim || claim.status !== 'merged') continue;
    const evidenceEntry = evidenceByClaim.get(claim.id) ?? evidenceByClaim.get(contract.claimId) ?? null;
    // Ein veralteter READY/IMPLEMENTING-Task eines belegten Merges wird nur
    // geschlossen, wenn der Branch nachweislich weg ist. Ein neuer Task auf
    // demselben Branch hat noch einen Remote-Kopf und bleibt aktiv.
    const staleMergedTask =
      ['READY', 'IMPLEMENTING'].includes(contract.phase) &&
      evidenceEntry?.branchCleanup?.state === 'done';
    if (!CLOSEABLE_PHASES.includes(contract.phase) && !staleMergedTask) continue;
    if ((contract.findings ?? []).some((finding) => finding.status === 'open' && finding.severity === 'blocker')) continue;
    const sha = String(claim.mergedSha ?? '').slice(0, 7);
    const evidence = claim.mergedEvidence ? `${claim.mergedEvidence}${sha ? ` ${sha}` : ''}` : 'Merge-Beleg';
    // Nur ein PR-Beleg kennt Nummer, Kopf und Merge-Commit. Branch- oder
    // Baum-Belege bleiben ehrlich ohne PR-Objekt; sie erfinden keine Nummer.
    const pr = evidenceEntry?.pr
      ? {
          ...evidenceEntry.pr,
          state: 'merged',
          ...(claim.mergedSha ? { mergedSha: claim.mergedSha } : {}),
        }
      : contract.pr
        ? {
            ...contract.pr,
            state: 'merged',
            ...(claim.mergedSha ? { mergedSha: claim.mergedSha } : {}),
          }
        : null;
    const aftercare = {
      claim: { status: 'merged', evidence: claim.mergedEvidence ?? 'merge-evidence', sha: claim.mergedSha ?? null },
      task: { phase: 'DONE' },
      branch: evidenceEntry?.branchCleanup ?? { state: 'unknown', evidence: 'no-branch-evidence' },
    };
    const next = {
      ...contract,
      phase: 'DONE',
      pr,
      aftercare,
      nextAction: `Automatisch nach Merge geschlossen (${evidence}).`,
      revision: (Number.isInteger(contract.revision) ? contract.revision : 0) + 1,
    };
    const validation = validateTaskContract(next, {
      claim,
      previous: contract,
      enforceTransition: false,
    });
    if (!validation.ok) continue;
    changes.push({ file: task.file, previous: contract, contract: next, claimId: contract.claimId });
  }
  return changes;
}
