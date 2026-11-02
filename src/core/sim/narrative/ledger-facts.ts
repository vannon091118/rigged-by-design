/** Leitet aus Ledger-Buchungen nur Schwellenuebergaenge ab, nicht jede Buchung. */
import type { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import type { WorldState } from '../types';
import { emitFact } from './facts';
import type { HouseBand } from './types';

/** Unter diesem Hauskonto-Stand gilt das Haus als knapp. */
const HOUSE_LOW_THRESHOLD = fromVC(50);

function bandOf(balance: number): HouseBand {
  return balance <= HOUSE_LOW_THRESHOLD ? 'LOW' : 'OK';
}

/**
 * Verarbeitet nur Buchungen seit dem gespeicherten `seq`. Der erste Lauf setzt den
 * Cursor ohne historische Facts, damit ein alter Save nicht rueckwirkend Schwellen meldet.
 */
export function processLedgerFacts(world: WorldState, ledger: Ledger): number {
  const state = world.narrative;
  const entries = ledger.entriesAfterSeq(state.ledgerSeq ?? -1);
  if (state.ledgerSeq === null) {
    state.ledgerSeq = entries[entries.length - 1]?.seq ?? -1;
    state.houseBand = bandOf(ledger.getBalance(HAUSKONTO));
    return 0;
  }
  if (entries.length === 0) return 0;
  const delta = entries.reduce((sum, entry) =>
    sum + (entry.to === HAUSKONTO ? entry.amount : 0) - (entry.from === HAUSKONTO ? entry.amount : 0), 0);
  let balance = ledger.getBalance(HAUSKONTO) - delta;
  let band = bandOf(balance);
  let emitted = 0;
  for (const entry of entries) {
    if (entry.to === HAUSKONTO) balance += entry.amount;
    if (entry.from === HAUSKONTO) balance -= entry.amount;
    const next = bandOf(balance);
    if (next === band) continue;
    emitFact(world, { kind: 'HOUSE_BALANCE', balance: balance as VaCoinMicro, band: next });
    band = next;
    emitted += 1;
  }
  state.ledgerSeq = entries[entries.length - 1]!.seq;
  state.houseBand = band;
  return emitted;
}
