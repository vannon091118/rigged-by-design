/** Save v11: Welt + Layout + Ledger-Log + Journal + PRNG + Narrative-Domaene + Rivalen-Zustand. */
import { Ledger } from '../core/economy/ledger';
import { ZERO_VC } from '../core/economy/vacoin';
import { admitFiat, BUILDER_ESCROW, DEBT_ACCOUNT, EXTERNAL_WORK } from '../core/sim/money';
import { companyTier } from '../core/sim/progression';
import { ensureCityLife, ensureCityPopulationForScene } from '../core/sim/city-life-state';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { WorldState } from '../core/sim/types';
import { hydrateWorld, type SavedGame } from './migrate';
import { toSavedGame } from './save-format';
import { SAVE_VERSIONS } from '../core/io/repair';
import { getRawSave as getRawSaveFromRecovery, quarantineSave as quarantineSaveFromRecovery, hasQuarantinedSave as hasQuarantinedSaveFromRecovery } from './save-recovery';

export { SAVE_VERSION, toSavedGame } from './save-format';
const KEY = 'vcoin.casino.v11';
const LEGACY_KEYS = ['vcoin.casino.v10', 'vcoin.casino.v9', 'vcoin.casino.v8', 'vcoin.casino.v7', 'vcoin.casino.v6', 'vcoin.casino.v5'] as const;
const OLD_KEYS = ['vcoin.casino.v3', 'vcoin.casino.v4']; // v3/v4 werden verworfen

interface LoadedSave {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prngState: number;
}

/** Fehlerarten beim Laden eines Spielstands. */
export type LoadError =
  | { type: 'parse'; message: string; cause?: unknown }
  | { type: 'version'; message: string; version: unknown }
  | { type: 'missing-fields'; message: string; missing: string[] }
  | { type: 'ledger-integrity'; message: string }
  | { type: 'unknown'; message: string; cause?: unknown };

/** Letzter Ladefehler (immutable für UI-Dialoge). */
let savedLoadError: LoadError | null = null;
export function getLastLoadError(): LoadError | null {
  return savedLoadError;
}

/** Entfernt alle Legacy-Save-Dateien (v3/v4). */
export function clearOldSave(): boolean {
  try {
    let had = false;
    for (const key of OLD_KEYS) {
      had = had || localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
    }
    return had;
  } catch { return false; }
}

/** Liefert den rohen Primär-Save als String (für Export bei Wiederherstellung). */
export function getRawSave(): string | null {
  return getRawSaveFromRecovery();
}

/** Verschiebt den primären Save in einen Quarantäne-Schlüssel und legt ihn dort unverändert ab.
 * Gibt den geretteten Inhalt zurück oder null, wenn nichts zu retten war. */
export function quarantineSave(suffix = 'recovery'): string | null {
  return quarantineSaveFromRecovery(suffix);
}

/** Prüft, ob ein quarantänerter Save unter dem gegebenen Suffix existiert. */
export function hasQuarantinedSave(suffix = 'recovery'): boolean {
  return hasQuarantinedSaveFromRecovery(suffix);
}

/** Lädt einen gespeicherten Stand; kehrt null, wenn kein Speicher oder Fehler. */
export function loadWorld(): LoadedSave | null {
  let raw: string | null;
  try {
    // Headless- und SSR-Laeufe haben keinen Storage; das ist kein Ladefehler.
    if (typeof localStorage === 'undefined') return null;
    raw = localStorage.getItem(KEY);
    for (const key of LEGACY_KEYS) raw = raw ?? localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    savedLoadError = { type: 'parse', message: 'Speicherdaten sind kein gültiges JSON.', cause };
    return null;
  }
  const loaded = replaySave(parsed);
  // Auch ausserhalb der Stadt bekommen alte Saves ihre Bewohnerprofile; die
  // Stadtszene selbst ist bereits in `replaySave` auf Mindestbesetzung.
  if (loaded) ensureCityLife(loaded.world);
  return loaded;
}

/** Gibt false zurück, wenn der Browser den Stand nicht speichern konnte (z. B. Speicher voll). */
export function saveWorld(world: WorldState, ledger: Ledger, prngState: number): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(toSavedGame(world, ledger, prngState)));
    return true;
  } catch {
    return false;
  }
}

/** Bau Welt und Ledger aus einem gespeicherten Stand; v5/v6 werden dabei gehoben. */
export function replaySave(raw: unknown): LoadedSave | null {
  try {
    // Der Export ist auch als roher JSON-String nutzbar; ein kaputter String
    // ist ein Parse-Fehler, kein fehlendes Pflichtfeld.
    let source = raw;
    if (typeof raw === 'string') {
      try {
        source = JSON.parse(raw);
      } catch (cause) {
        savedLoadError = { type: 'parse', message: 'Speicherdaten sind kein gültiges JSON.', cause };
        return null;
      }
    }
    const saved = source as Partial<SavedGame> | null;
    if (!saved || !SAVE_VERSIONS.has(saved.version ?? 0)) {
      const missing: string[] = [];
      if (saved?.version === undefined) missing.push('version');
      if (saved?.template === undefined) missing.push('template');
      if (!Array.isArray(saved?.guests)) missing.push('guests');
      if (!Array.isArray(saved?.furniture)) missing.push('furniture');
      savedLoadError = { type: 'missing-fields', message: 'Speicherdaten unvollständig.', missing };
      return null;
    }
    if (!saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) {
      savedLoadError = { type: 'missing-fields', message: 'Gaeste oder Moebel fehlen.', missing: ['guests', 'furniture'] };
      return null;
    }
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    const legacyFiat = hydrateWorld(world, saved as SavedGame);
    // Die Szene steht nach der Hydration fest: Ein alter CITY-Save wird auf
    // die Strassenbesetzung gehoben, bevor Sicht oder Begegnung ihn lesen.
    ensureCityPopulationForScene(world);
    ensureStarter(world);
    const ledger = new Ledger();
    // Schuldbuchungen dürfen beim Replay nicht als Unterdeckung gelten.
    ledger.openLiability(DEBT_ACCOUNT);
    for (const entry of saved.entries ?? []) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick, entry.game ?? null);
    }
    for (const claim of legacyFiat) admitFiat(ledger, claim.id, claim.amount, world.tick);
    // v11 legte Bauträger-Zahlungen und Pakt-Reserve auf ein Konto. Der alte
    // Saldo wandert als eigene Zeile in den Bauträger-Escrow; die Pakt-Reserve
    // deckt sich beim nächsten Paktstart selbst (#532).
    if (ledger.hasAccount(EXTERNAL_WORK)) {
      const legacyWork = ledger.getBalance(EXTERNAL_WORK);
      if (legacyWork > ZERO_VC) {
        ledger.transfer(EXTERNAL_WORK, BUILDER_ESCROW, legacyWork, 'Migration: Bauträger-Escrow (v11)', 0);
      }
    }
    // Alte v8-Stände kennen die Nachfragestufe noch nicht: einmal aus dem Ledger nachziehen.
    if (!saved.demandTier) world.demandTier = companyTier(world, ledger);
    if (!ledger.verifyLedgerIntegrity()) {
      savedLoadError = { type: 'ledger-integrity', message: 'Ledger-Integrität nicht wiederherstellbar.' };
      return null;
    }
    savedLoadError = null;
    return { world, ledger, prngState: saved.prngState ?? 1 };
  } catch (cause) {
    savedLoadError = { type: 'parse', message: 'Konnte Speicherdaten nicht parsen.', cause };
    return null;
  }
}

export const SAVE_FAILED_NOTICE = 'Speichern fehlgeschlagen: Browser-Speicher voll oder gesperrt. Fortschritt geht beim Neuladen verloren.';