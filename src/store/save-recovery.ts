/** Save-Recovery (Issue #976): Roh-Save-Export und Quarantäne-Funktionen.
 * Leben hier, damit `src/store/save.ts` unter seinem LOC-Budget bleibt.
 */
const KEY = 'vcoin.casino.v11';
const LEGACY_KEYS = ['vcoin.casino.v10', 'vcoin.casino.v9', 'vcoin.casino.v8', 'vcoin.casino.v7', 'vcoin.casino.v6', 'vcoin.casino.v5'] as const;

/** Liefert den rohen Primär-Save als String (für Export bei Wiederherstellung). */
export function getRawSave(): string | null {
  let raw = localStorage.getItem(KEY);
  for (const key of LEGACY_KEYS) raw = raw ?? localStorage.getItem(key);
  return raw;
}

/** Verschiebt den primären Save in einen Quarantäne-Schlüssel und legt ihn dort unverändert ab.
 * Gibt den geretteten Inhalt zurück oder null, wenn nichts zu retten war. */
export function quarantineSave(suffix = 'recovery'): string | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    localStorage.setItem(`${KEY}.${suffix}`, raw);
    localStorage.removeItem(KEY);
    return raw;
  } catch {
    return null;
  }
}

/** Prüft, ob ein quarantänerter Save unter dem gegebenen Suffix existiert. */
export function hasQuarantinedSave(suffix = 'recovery'): boolean {
  try {
    return localStorage.getItem(`${KEY}.${suffix}`) !== null;
  } catch {
    return false;
  }
}