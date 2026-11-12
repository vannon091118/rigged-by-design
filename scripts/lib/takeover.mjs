/**
 * WIP-Takeover: "fremdes WIP" existiert nicht.
 *
 * Jede unfertige Aenderung ist entweder kompatibel (im eigenen Claim oder im
 * Scope einer offenen Lane), unvollstaendig (ausserhalb des Claims, aber
 * uebernehmbar) oder korrupt (ein Zustandspfad aus Ledger/Save/RNG/Boot). Alle drei werden als eigene Arbeit
 * angenommen; nur `corrupted` haelt den Start an. Die Klassifikation ist eine
 * reine Funktion, damit `pretask`, Staging-Scope und Tests dieselbe Auslegung
 * benutzen.
 */
import { allowsPath, isClaimTooling } from './lane-claims.mjs';

export const WIP_KINDS = Object.freeze(['compatible', 'incomplete', 'corrupted']);

/** Korruption durch ungeclaimte Zustandspfade. */
export const TAKEOVER_CODE = 'ERR-4030';

const normalize = (raw) => String(raw ?? '').replaceAll('\\', '/').trim();

/**
 * Kritische Zustandspfade: Ledger, Save, RNG/PRNG/Entropy, Boot und der
 * World-Store. Nur unter `src/core/`; ein UI-Screen mit "Save" im Namen ist
 * kein Spielzustand. Ein ungeclaimter Diff dort ist Korruptionsverdacht.
 */
const CRITICAL = /(^|[-_.])(ledger|save|rng|prng|entropy|boot|world-store)([-_.]|$)/i;
const CRITICAL_DIRS = Object.freeze(['ledger', 'save', 'rng', 'prng', 'entropy', 'boot']);

export function isCriticalPath(file) {
  const path = normalize(file);
  if (!path.startsWith('src/core/')) return false;
  const parts = path.split('/');
  const name = parts.pop() ?? '';
  if (CRITICAL_DIRS.includes(name)) return true;
  if (CRITICAL.test(name)) return true;
  return parts.some((part) => CRITICAL_DIRS.includes(part));
}

const entry = (path, kind, reason, source = null) => ({ path, kind, adopt: true, reason, source });

/**
 * Klassifiziert einen Dirty-Pfad. Reihenfolge: Lane-Werkzeug und eigener Claim
 * gewinnen (das ist per Definition eigene Arbeit), dann kritischer Zustand,
 * dann eine fremde offene Lane, sonst unvollstaendig.
 */
export function classifyWip({
  path,
  claims = [],
  branch = '',
  allowlist = [],
} = {}) {
  const file = normalize(path);
  if (!file) return null;
  if (isClaimTooling(file)) return entry(file, 'compatible', 'Lane-Werkzeug (Claim, Vertrag, Freigabe)');
  if (allowsPath(allowlist, file)) return entry(file, 'compatible', 'im eigenen Claim-Scope');
  if (isCriticalPath(file)) return entry(file, 'corrupted', 'kritischer Zustandspfad (Ledger/Save/RNG/Boot)');
  const foreign = claims.find(
    (claim) => claim?.status === 'open' && claim.branch !== branch && allowsPath(claim.pathAllowlist ?? [], file),
  );
  if (foreign) return entry(file, 'compatible', `im Scope der offenen Lane ${foreign.id}`, foreign.id);
  return entry(file, 'incomplete', 'ausserhalb des Claims; als eigene Arbeit fertigbauen');
}

/** Kompakte Zusammenfassung fuer pretask, Staging und Tests. */
export function summarizeTakeover(entries = []) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const counts = { compatible: 0, incomplete: 0, corrupted: 0 };
  const corrupted = [];
  for (const item of list) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    if (item.kind === 'corrupted') corrupted.push({ path: item.path, reason: item.reason });
  }
  return { total: list.length, adopted: list.length, blocked: corrupted.length, counts, corrupted };
}
