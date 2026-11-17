/**
 * Begrenzte Transaktion fuer einen Store-Command: sichert Welt, Ledger und PRNG
 * vor der Aktion und nimmt eine begonnene Teilmutation bei einem Fehler zurueck.
 * Es entsteht kein zweiter Zustandsspeicher - der Snapshot lebt nur fuer die Dauer
 * eines Commands. Der Ledger wird ueber seine oeffentliche API neu aufgebaut;
 * die Buchungslogik selbst bleibt unveraendert.
 */
import { Ledger } from '../core/economy/ledger';
import type { AccountId, LedgerEntry } from '../core/economy/ledger-integrity';
import type { Prng } from '../core/rng/prng';
import type { WorldState } from '../core/sim/types';

interface CommandSnapshot {
  /** Nimmt Welt und PRNG zurueck und liefert den Ledger-Stand von vor der Aktion. */
  restore(): Ledger;
}

/** Ersetzt den Inhalt, ohne die Identitaet des Welt-Objekts zu wechseln (Leser halten keine Kopie). */
function replaceWorldContents(target: WorldState, source: WorldState): void {
  const targetRecord = target as unknown as Record<string, unknown>;
  const sourceRecord = source as unknown as Record<string, unknown>;
  for (const key of Object.keys(targetRecord)) {
    if (!(key in sourceRecord)) delete targetRecord[key];
  }
  Object.assign(targetRecord, sourceRecord);
}

/** Baut den Vorzustand aus den gesicherten Zeilen nach: gleiche Zeilen, gleiche Salden, gleiche Sequenz. */
function rebuildLedger(entries: readonly LedgerEntry[], liabilities: readonly AccountId[]): Ledger {
  const copy = new Ledger();
  for (const account of liabilities) copy.openLiability(account);
  for (const entry of entries) copy.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick, entry.game);
  return copy;
}

/** Sichert den Vorzustand eines Commands; `restore()` ist mehrfach aufrufbar. */
export function captureCommandState(world: WorldState, ledger: Ledger, prng: Prng): CommandSnapshot {
  const worldSnapshot = structuredClone(world);
  const entries = [...ledger.entries];
  const liabilities = [...ledger.liabilityAccounts];
  const prngState = prng.getState();
  return {
    restore(): Ledger {
      replaceWorldContents(world, worldSnapshot);
      prng.setState(prngState);
      return rebuildLedger(entries, liabilities);
    },
  };
}
