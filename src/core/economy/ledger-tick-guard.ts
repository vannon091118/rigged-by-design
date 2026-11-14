/**
 * @module ledger-tick-guard — Bilanzgrenze nach dem vollstaendigen Welt-Takt
 *
 * `verifyIncremental()` ist der guenstige Tickpfad. Er läuft nach `tickWorld`
 * und `tickActionQueue`, damit auch Queue-Buchungen erfasst sind. Bei einem
 * Bruch wird die teure Diagnose nur einmal aufgerufen und in den Fehler
 * geschrieben; der Tick selbst bleibt unveraendert.
 */
import type { Ledger } from './ledger';
import type { LedgerEntry } from './ledger-integrity';

export class LedgerBalanceError extends Error {
  constructor(
    readonly tick: number,
    readonly phase: string,
    readonly seq: number,
    readonly entries: number,
    readonly lastEntry: LedgerEntry | null,
    readonly accounts: readonly string[],
    readonly detail: string,
  ) {
    const last = lastEntry
      ? `#${lastEntry.seq} ${lastEntry.from}->${lastEntry.to} ${lastEntry.amount} (${lastEntry.reason})`
      : 'keine';
    super(
      `Ledger-Bilanz gebrochen nach ${phase} (Tick ${tick}): ${detail}; ` +
        `seq ${seq}/${entries} Buchungen; letzte Buchung ${last}; ` +
        `Konten ${accounts.length > 0 ? accounts.join(', ') : 'keine'}`,
    );
    this.name = 'LedgerBalanceError';
  }
}

/**
 * Prueft die Bilanz nach einem abgeschlossenen Takt. Ein Bruch wirft, statt
 * den naechsten Tick auf einem inkonsistenten Ledger weiterlaufen zu lassen.
 */
export function assertLedgerBalanced(ledger: Ledger, tick: number, phase: string): void {
  if (ledger.verifyIncremental()) return;
  const diagnosis = ledger.diagnose();
  const lastEntry = ledger.entries[ledger.entries.length - 1] ?? null;
  const accounts = [...new Set([
    ...(lastEntry ? [lastEntry.from, lastEntry.to] : []),
    ...ledger.accounts
      .filter((account) => ledger.getBalance(account) !== 0)
      .slice(0, 8),
  ])];
  throw new LedgerBalanceError(
    tick,
    phase,
    diagnosis.lastSeq,
    diagnosis.entries,
    lastEntry,
    accounts,
    diagnosis.failure?.reason ?? 'verifyIncremental meldet false',
  );
}
