/**
 * Scheine und Vorkampf: die Sicht auf das Register in `fight-bet-register`.
 *
 * Der Register-Zustand ist die Wahrheit; dieses Modul formt ihn nur fuer
 * Markt, Abrechnung und UI. Es liest keinen Journal-Text mehr, damit eine
 * gekappte Journal-Retention keinen Einsatz verschlucken kann.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import { openSlipsOf } from './fight-bet-register';
import type { FightBetPick } from './fight-bet-register';
import type { WorldState } from './types';

export type { FightBetPick, UndercardResult } from './fight-bet-register';
export { SETTLE_SUBJECT, SLIP_SUBJECT, UNDERCARD_SUBJECT } from './fight-bet-register';

export interface PendingBet {
  readonly slip: number;
  readonly eventId: number;
  readonly pick: FightBetPick;
  readonly stake: VaCoinMicro;
  /** Quote fuer die Anzeige; die Abrechnung rechnet mit `oddsBp`. */
  readonly odds: number;
  readonly oddsBp: number;
}

/** Offene Scheine aus dem Register; die Journal-Retention beruehrt sie nicht. */
export function openSlips(world: WorldState): PendingBet[] {
  return openSlipsOf(world).map((slip) => ({
    slip: slip.id,
    eventId: slip.eventId,
    pick: slip.pick,
    stake: slip.stake,
    odds: slip.oddsBp / 100,
    oddsBp: slip.oddsBp,
  }));
}
