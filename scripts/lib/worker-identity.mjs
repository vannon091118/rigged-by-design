/**
 * Worker-Identitaet: drei Namen, globale Reservierung, sonst nichts.
 *
 * Die Identitaet ist ein Betriebsmittel, kein Rollenname: `LIILITH`, `Shinon`
 * und `Jenova` sind die einzigen gueltigen Worker. Reserviert wird im
 * Identity-Board-Issue mit einem `IDENTITY_CLAIM`-Kommentar; die Reservierung
 * gilt system- und workspaceweit und wird nur durch `IDENTITY_RELEASE`
 * derselben Claim-ID aufgehoben. Ein Claim eines anderen Workspace ist ein
 * Konflikt, keine Uebernahme; Zeitablauf gibt nichts frei.
 *
 * Die Datei ist rein: sie parst Kommentare und entscheidet, sie schreibt nicht
 * nach GitHub. Wer kommentiert, liegt in `worker-init.mjs`.
 */

/** Einzige Worker-Identitaeten. Reihenfolge ist stabil und wird getestet. */
export const WORKER_IDENTITIES = Object.freeze(['LIILITH', 'Shinon', 'Jenova']);

/** Standardrolle jedes Turns; nur ein User-Auftrag hebt sie auf. */
export const WORKER_ROLE = 'AGENT_ARBEITER';
export const MAINTAINER_ROLE = 'MAINTAINER';

/** Legacy-Namen behalten ihre Historie, sind aber keine neuen Identitaeten. */
const LEGACY_IDENTITY = /^(agent-\d+(-(local|cloud))?|buffy|codex|claude|chatgpt|assistant)$/i;

/** Ein Ereignis steht am Zeilenanfang eines Issue-Kommentars. */
const EVENT_LINE = /^(IDENTITY_CLAIM|IDENTITY_RELEASE)\s+(.+)$/i;

/** Pflichtfelder einer Reservierung; ein fehlendes Feld ist kein Claim. */
const CLAIM_FIELDS = Object.freeze(['name', 'system', 'workspace', 'repo', 'session', 'claim_id', 'at']);

const FIELD = /([a-z_]+)=(\S+)/gi;

export function isWorkerIdentity(name) {
  return WORKER_IDENTITIES.includes(String(name ?? ''));
}

export function isLegacyIdentity(name) {
  return LEGACY_IDENTITY.test(String(name ?? '').trim());
}

/** Rollen-Dispatch: Standard ist immer der Worker, nie der Maintainer. */
export function dispatchRole({ userRequestedMaintainer = false } = {}) {
  return userRequestedMaintainer === true ? MAINTAINER_ROLE : WORKER_ROLE;
}

function fieldsOf(text) {
  const fields = {};
  for (const match of String(text ?? '').matchAll(FIELD)) fields[match[1].toLowerCase()] = match[2];
  return fields;
}

/**
 * Liest alle Identitaets-Ereignisse aus Kommentaren, chronologisch nach
 * Kommentar-ID. Eine Zeile ohne alle Pflichtfelder wird als `incomplete`
 * gemeldet und nicht als Claim gewertet.
 */
export function parseIdentityEvents(comments = []) {
  const events = [];
  const invalid = [];
  const ordered = [...comments].sort((left, right) => Number(left.id) - Number(right.id));
  for (const comment of ordered) {
    for (const raw of String(comment?.body ?? '').split(/\r?\n/)) {
      const match = EVENT_LINE.exec(raw.trim());
      if (!match) continue;
      const kind = match[1].toUpperCase();
      const fields = fieldsOf(match[2]);
      if (kind === 'IDENTITY_RELEASE') {
        if (!fields.name || !fields.claim_id) {
          invalid.push({ kind, commentId: String(comment.id), reason: 'incomplete-release' });
          continue;
        }
        events.push({
          kind,
          commentId: String(comment.id),
          name: fields.name,
          system: fields.system,
          workspace: fields.workspace,
          repo: fields.repo,
          session: fields.session,
          claimId: fields.claim_id,
          at: fields.at,
          reason: fields.reason,
        });
        continue;
      }
      const missing = CLAIM_FIELDS.filter((field) => !fields[field]);
      if (missing.length > 0) {
        invalid.push({ kind, commentId: String(comment.id), reason: `missing:${missing.join(',')}` });
        continue;
      }
      events.push({
        kind,
        commentId: String(comment.id),
        name: fields.name,
        system: fields.system,
        workspace: fields.workspace,
        repo: fields.repo,
        session: fields.session,
        claimId: fields.claim_id,
        at: fields.at,
      });
    }
  }
  return { events, invalid };
}

/**
 * Loest Reservierungen auf. Erster gueltiger Claim gewinnt; ein zweiter Claim
 * derselben Identitaet aus einem anderen Workspace ist ein Konflikt. Ein
 * Release wirkt nur mit passender Claim-ID.
 */
export function resolveReservations(comments = []) {
  const { events, invalid } = parseIdentityEvents(comments);
  const held = new Map();
  const conflicts = [];
  for (const event of events) {
    if (!isWorkerIdentity(event.name)) {
      conflicts.push({
        name: event.name,
        commentId: event.commentId,
        reason: isLegacyIdentity(event.name) ? 'legacy-identity' : 'unknown-identity',
      });
      continue;
    }
    const current = held.get(event.name);
    if (event.kind === 'IDENTITY_CLAIM') {
      if (current && current.claimId === event.claimId) continue;
      if (current && (current.workspace !== event.workspace || current.system !== event.system)) {
        conflicts.push({
          name: event.name,
          commentId: event.commentId,
          reason: 'exclusive-claim',
          heldBy: current,
        });
        continue;
      }
      held.set(event.name, { ...event });
      continue;
    }
    if (!current) {
      conflicts.push({ name: event.name, commentId: event.commentId, reason: 'release-without-claim' });
      continue;
    }
    if (current.claimId !== event.claimId) {
      conflicts.push({ name: event.name, commentId: event.commentId, reason: 'release-claim-mismatch' });
      continue;
    }
    held.delete(event.name);
  }
  const reserved = [...held.values()].map((event) => Object.freeze({
    name: event.name,
    system: event.system,
    workspace: event.workspace,
    repo: event.repo,
    session: event.session,
    claimId: event.claimId,
    at: event.at,
    commentId: event.commentId,
  }));
  return {
    reserved,
    free: WORKER_IDENTITIES.filter((name) => !held.has(name)),
    conflicts,
    invalid,
  };
}

/** Die Identitaet, die diesen Workspace haelt; `null` heisst: keine. */
export function identityForWorkspace(comments, { system, workspace } = {}) {
  const { reserved } = resolveReservations(comments);
  return reserved.find((entry) => entry.system === system && entry.workspace === workspace) ?? null;
}

/** Erste freie Identitaet oder `null`; es wird keine vierte erfunden. */
export function nextFreeIdentity(comments) {
  return resolveReservations(comments).free[0] ?? null;
}

function requireFields(fields, names) {
  const missing = names.filter((name) => !fields[name]);
  if (missing.length > 0) throw new Error(`IDENTITY: Pflichtfeld fehlt: ${missing.join(', ')}`);
}

/** Kanonische Claim-Zeile; identisch fuer Kommentar und lokale Datei. */
export function formatIdentityClaim(fields = {}) {
  requireFields(fields, ['name', 'system', 'workspace', 'repo', 'session', 'claimId', 'at']);
  if (!isWorkerIdentity(fields.name)) throw new Error(`IDENTITY: unbekannte Identitaet: ${fields.name}`);
  return [
    `IDENTITY_CLAIM name=${fields.name}`,
    `system=${fields.system}`,
    `workspace=${fields.workspace}`,
    `repo=${fields.repo}`,
    `session=${fields.session}`,
    `claim_id=${fields.claimId}`,
    `at=${fields.at}`,
  ].join(' ');
}

/** Kanonische Release-Zeile; nur mit derselben Claim-ID wirksam. */
export function formatIdentityRelease(fields = {}) {
  requireFields(fields, ['name', 'system', 'workspace', 'session', 'claimId', 'reason']);
  return [
    `IDENTITY_RELEASE name=${fields.name}`,
    `system=${fields.system}`,
    `workspace=${fields.workspace}`,
    `session=${fields.session}`,
    `claim_id=${fields.claimId}`,
    `reason=${fields.reason}`,
  ].join(' ');
}
