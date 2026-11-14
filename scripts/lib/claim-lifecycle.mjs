/**
 * Claim-Lifecycle: Retention und Post-Merge-Closeout.
 *
 * Zwei getrennte Entscheidungen, beide rein und ohne Dateisystem:
 *
 * - `planRetention` haelt hoechstens `keep` Tasks. Aktive Tasks bleiben immer,
 *   abgeschlossene Tasks werden nach ihrem letzten Commit sortiert; nur die
 *   neuesten fuellen die freien Plaetze. Zugehoerige Claim-Dateien gehen mit,
 *   offene oder geparkte Claims bleiben. Das Legacy-Register `claims.json`
 *   wird nie beschnitten.
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

export const TASK_RETENTION_LIMIT = 10;
export const CLOSEABLE_PHASES = Object.freeze(['CI_PENDING', 'MERGE_PENDING', 'AFTERCARE']);
export const ACTIVE_CLAIM_STATUSES = Object.freeze(['open', 'parked']);

const newestFirst = (left, right) =>
  (Number(right.committedAt) || 0) - (Number(left.committedAt) || 0) || left.file.localeCompare(right.file);

/** Dateiname eines Lane-Claims; dieselbe Regel wie `claim:register`. */
export function claimEntryPath(id) {
  const slug = String(id ?? '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug ? `.lane-claims/claims/${slug}.json` : '';
}

/** Alle aktiven Tasks und die neuesten abgeschlossenen Tasks bis zum Limit. */
export function planRetention({
  tasks = [],
  claims = [],
  keep = TASK_RETENTION_LIMIT,
  protectedTaskFiles = [],
  protectedClaimIds = [],
} = {}) {
  const limit = Number.isInteger(Number(keep)) && Number(keep) >= 0 ? Number(keep) : TASK_RETENTION_LIMIT;
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
  // Aktive Tasks sind nicht loeschbar; sie belegen ihre Plaetze zuerst. Bei
  // mehr als `limit` aktiven Tasks bleibt die Liste bewusst ueber dem Limit.
  const closedSlots = Math.max(0, limit - active.length);
  const retainedTasks = [...active, ...closed.slice(0, closedSlots)];
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
