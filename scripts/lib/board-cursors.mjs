/**
 * Kommentar-Cursor fuer den Maintainer-State (#671).
 *
 * Der Board-Zustand ist nur ein Lesefortschritt: GitHub bleibt die Wahrheit.
 * Diese Datei enthaelt ausschliesslich reine Funktionen — kein Netz, keine
 * Datei, keine Uhr — damit Cursor-Regeln testbar sind und nie Issue-State,
 * Claim, Prioritaet oder Review-Verdikt ueberschreiben koennen.
 *
 * Vertrag:
 * - Ein Kommentar erscheint genau einmal als Eingang, auch ueber mehrere
 *   Laeufe und Geraete hinweg (`triaged` ist die Belegliste der ausgegebenen
 *   Eingaenge, unabhaengig vom Cursor und je Art/Nummer geschluesselt).
 * - Der Cursor rueckt nur vor, wenn die Kommentar-Seite vollstaendig gelesen
 *   ist. Unvollstaendige Pagination oder ein API-Ausfall ergibt `UNKNOWN`
 *   und laesst den Cursor stehen — nie "keine neuen Kommentare".
 * - Issues und PR-Konversationen haben getrennte Cursor, auch bei gleicher
 *   Nummer.
 */

export const BOARD_CURSOR_VERSION = 2;

export const CURSOR_STATUS = Object.freeze({
  OK: 'OK',
  FIRST_SCAN: 'FIRST_SCAN',
  UNKNOWN: 'UNKNOWN',
});

const KINDS = Object.freeze(['issues', 'pullRequests']);

function kindBucket(state, kind) {
  if (!KINDS.includes(kind)) throw new Error(`unbekannte Cursor-Art: ${String(kind)}`);
  return state[kind] ?? {};
}

function emptyState({ head = null, generatedAt = null } = {}) {
  return {
    version: BOARD_CURSOR_VERSION,
    head,
    generatedAt,
    issues: {},
    pullRequests: {},
    triaged: [],
    warnings: [],
  };
}

/** Frischer State; fehlende Datei ist ein Vollscan, kein Fehler. */
export function emptyCursorState(options = {}) {
  return emptyState(options);
}

/** Liest einen beliebigen Vorgaenger-State und ergaenzt fehlende Felder. */
export function normalizeCursorState(raw, fallback = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState(fallback);
  return {
    ...raw,
    version: BOARD_CURSOR_VERSION,
    head: typeof raw.head === 'string' && raw.head ? raw.head : (fallback.head ?? null),
    issues: typeof raw.issues === 'object' && raw.issues ? raw.issues : {},
    pullRequests: typeof raw.pullRequests === 'object' && raw.pullRequests ? raw.pullRequests : {},
    triaged: Array.isArray(raw.triaged) ? raw.triaged : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

/**
 * Verarbeitet eine gelesene Kommentar-Seite eines Issues oder PRs.
 *
 * @param {object} input
 * @param {object} input.state  aktueller State (wird nicht veraendert)
 * @param {'issues'|'pullRequests'} input.kind
 * @param {number} input.number Issue- oder PR-Nummer
 * @param {Array<{id:number|string, author?:string, createdAt?:string}>} input.comments
 * @param {boolean} input.complete  true nur bei vollstaendig gelesener Seite
 * @param {string|null} input.scannedAt
 * @returns {{state: object, entries: object[], status: string}}
 */
export function ingestComments({ state, kind, number, comments = [], complete = true, scannedAt = null }) {
  const next = {
    ...state,
    [kind]: { ...kindBucket(state, kind) },
    triaged: [...(state.triaged ?? [])],
    warnings: [...(state.warnings ?? [])],
  };
  const key = String(number);
  const previous = kindBucket(state, kind)[key] ?? null;
  const triaged = new Set(next.triaged);
  const triageKey = (id) => `${kind}:${key}:${id}`;

  if (!complete) {
    next.warnings.push(`${kind}#${key}: Seite unvollstaendig oder API-Ausfall — Cursor bleibt stehen (UNKNOWN)`);
    return { state: next, entries: [], status: CURSOR_STATUS.UNKNOWN };
  }

  const ordered = [...comments]
    .map((comment) => ({ ...comment, id: Number(comment.id) }))
    .filter((comment) => Number.isFinite(comment.id))
    .sort((a, b) => a.id - b.id);

  const lastSeen = previous?.lastCommentId ?? null;
  const entries = ordered
    .filter((comment) => (lastSeen === null ? true : comment.id > lastSeen))
    .filter((comment) => !triaged.has(triageKey(comment.id)))
    .map((comment) => ({
      kind,
      number: Number(number),
      commentId: comment.id,
      author: comment.author ?? null,
      createdAt: comment.createdAt ?? null,
    }));

  for (const entry of entries) {
    const marker = triageKey(entry.commentId);
    triaged.add(marker);
    next.triaged.push(marker);
  }

  const newest = ordered.at(-1) ?? null;
  const lastCommentId = newest ? Math.max(newest.id, lastSeen ?? 0) : lastSeen;
  next[kind][key] = {
    ...(previous ?? {}),
    kind,
    number: Number(number),
    lastCommentId,
    lastCommentAt: newest?.createdAt ?? previous?.lastCommentAt ?? null,
    lastScanAt: scannedAt ?? previous?.lastScanAt ?? null,
    status: CURSOR_STATUS.OK,
  };

  return {
    state: next,
    entries,
    status: previous === null ? CURSOR_STATUS.FIRST_SCAN : CURSOR_STATUS.OK,
  };
}

/**
 * Uebernimmt die belegten Kopfdaten des Laufs. Skalare Felder und die
 * Cursor-Buckets getrennt, damit ein Snapshot nie stillschweigend einen
 * Cursor zuruecksetzt.
 */
export function applySnapshot(state, { head = null, openPullRequests = null, reviewWaitingPrs = null, generatedAt = null } = {}) {
  return {
    ...state,
    head: head ?? state.head ?? null,
    generatedAt: generatedAt ?? state.generatedAt ?? null,
    openPullRequests: openPullRequests ?? state.openPullRequests ?? null,
    reviewWaitingPrs: reviewWaitingPrs ?? state.reviewWaitingPrs ?? null,
    issues: state.issues ?? {},
    pullRequests: state.pullRequests ?? {},
    triaged: state.triaged ?? [],
    warnings: state.warnings ?? [],
  };
}

/** Eingaenge eines Laufs als stabile, sortierte P0-Liste. */
export function pendingEntries(entries) {
  return [...entries].sort((a, b) => (a.commentId - b.commentId)).map((entry) => ({
    ...entry,
    label: `P0 ${entry.kind === 'pullRequests' ? 'PR' : 'Issue'} #${entry.number} (Kommentar ${entry.commentId})`,
  }));
}
