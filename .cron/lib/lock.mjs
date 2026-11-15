/**
 * Atomarer Maintainer-Lock (#835).
 *
 * Der Lock ist ein Git-Ref, kein Lese-Schreib-Zyklus: `POST /git/refs` legt
 * `refs/heads/rbd-lock/maintainer-cron` genau einmal an. Ein zweiter Lauf
 * erhaelt 422 und verliert — damit gibt es bei einem freien Lock genau einen
 * Gewinner, auch geraeteuebergreifend.
 *
 * Der Ref zeigt auf einen Commit, dessen Nachricht Halter, Claim-ID und
 * Aufnahmezeit traegt. Daraus folgen TTL-Ablauf, Halterpruefung und ein
 * belegbarer Grund fuer eine Uebernahme nach Ablauf.
 */

export const LOCK_REF = 'heads/rbd-lock/maintainer-cron';
export const DEFAULT_TTL_MS = 15 * 60 * 1000;
export const LOCK_AUTHOR = Object.freeze({
  name: 'rbd-maintainer-cron',
  email: 'cron@rigged-by-design.invalid',
});

/** Nachricht des Lock-Commits; der Ref selbst hat keinen Platz fuer Metadaten. */
export function formatLockRecord({ owner, claimId, at }) {
  return JSON.stringify({ owner, claimId, at, lock: 'maintainer-cron' });
}

/** Unbekannte oder fremde Commit-Nachrichten sind kein Lock, sondern Drift. */
export function parseLockRecord(message) {
  try {
    const record = JSON.parse(String(message ?? ''));
    if (record?.lock !== 'maintainer-cron') return null;
    if (!record.owner || !record.claimId || !record.at) return null;
    if (Number.isNaN(Date.parse(record.at))) return null;
    return { owner: String(record.owner), claimId: String(record.claimId), at: String(record.at) };
  } catch {
    return null;
  }
}

/** Alter in Millisekunden; eine unlesbare Zeit gilt als unendlich alt. */
export function lockAgeMs(record, now) {
  const takenAt = Date.parse(String(record?.at ?? ''));
  if (Number.isNaN(takenAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Number(now) - takenAt);
}

export function isLockExpired(record, now, ttlMs = DEFAULT_TTL_MS) {
  return lockAgeMs(record, now) >= ttlMs;
}

/** Aktueller Lock oder `null`; ein Ref ohne lesbaren Lock-Commit zaehlt nicht. */
export async function readLock({ api }) {
  const ref = await api.getRef(LOCK_REF);
  if (!ref?.object?.sha) return null;
  const commit = await api.getCommit(ref.object.sha);
  const record = parseLockRecord(commit?.message);
  return record ? { ref: ref.object.sha, record } : null;
}

/**
 * Reserviert den Lock. Reihenfolge: belegten Lock pruefen, abgelaufenen Lock
 * einmal einsammeln, dann atomar anlegen. Ein verlorener Wettlauf ist `busy`,
 * kein Fehler.
 */
export async function acquireLock({
  api, owner, claimId, now = Date.now(), ttlMs = DEFAULT_TTL_MS,
}) {
  if (!owner) throw new Error('LOCK: owner fehlt');
  if (!claimId) throw new Error('LOCK: claimId fehlt');
  let recoveredStale = false;
  const existing = await readLock({ api });
  if (existing) {
    if (!isLockExpired(existing.record, now, ttlMs)) {
      return { status: 'busy', holder: existing.record, ref: existing.ref };
    }
    // Genau eine Uebernahme: alle Wettlaeufer loeschen denselben abgelaufenen
    // Ref; der anschliessende createRef entscheidet atomar den Gewinner.
    await api.deleteRef(LOCK_REF);
    recoveredStale = true;
  }
  const at = new Date(Number(now)).toISOString();
  const main = await api.getRef('heads/main');
  if (!main?.object?.sha) throw new Error('LOCK: main-Ref nicht lesbar');
  const base = await api.getCommit(main.object.sha);
  if (!base?.tree?.sha) throw new Error('LOCK: main-Commit ohne tree');
  const commit = await api.createCommit({
    message: formatLockRecord({ owner, claimId, at }),
    tree: base.tree.sha,
    parents: [main.object.sha],
    date: at,
    ...LOCK_AUTHOR,
  });
  try {
    await api.createRef(LOCK_REF, commit.sha);
  } catch (error) {
    if (Number(error?.status) === 422) {
      const winner = await readLock({ api });
      return { status: 'busy', holder: winner?.record ?? null, ref: winner?.ref ?? null };
    }
    throw error;
  }
  return {
    status: recoveredStale ? 'acquired-after-stale' : 'acquired',
    record: { owner, claimId, at },
    ref: commit.sha,
  };
}

/** Gibt nur der Halter mit derselben Claim-ID frei; sonst bleibt alles stehen. */
export async function releaseLock({ api, owner, claimId }) {
  if (!owner) throw new Error('LOCK: owner fehlt');
  if (!claimId) throw new Error('LOCK: claimId fehlt');
  const current = await readLock({ api });
  if (!current) return { status: 'not-locked' };
  if (current.record.owner !== owner || current.record.claimId !== claimId) {
    return { status: 'not-holder', holder: current.record };
  }
  await api.deleteRef(LOCK_REF);
  return { status: 'released', record: current.record };
}
