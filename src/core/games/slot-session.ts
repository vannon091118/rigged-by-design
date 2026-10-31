/** Ein Slot-Spin mit Gedächtnis: Drucklader und Entladung werden hier tatsaechlich konsumiert. */
import { mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Furniture } from '../sim/types';
import type { GameResult } from './contracts';
import { playSlot } from './engines/slot';
import { createSlotMemory, prepareSlotSpin, recordSlotSpin } from './slot-transparency';
import type { Prng } from '../rng/prng';

/** Ein echter Gast-Spin; der Testspin bleibt absichtlich ohne Gedaechtnis-Wirkung. */
export function playSlotSession(
  item: Furniture,
  prng: Prng,
  bet: VaCoinMicro,
  bonusBps = 0,
): GameResult {
  if (!item.slotMemory) item.slotMemory = createSlotMemory();
  const memory = item.slotMemory;
  // Nur was die Maschine einbehalten hat, kann sie als Bonus auszahlen.
  const reference = item.baseBet > ZERO_VC ? item.baseBet : bet;
  const bank = memory.bank ?? 0;
  // Ein Bonus kostet rund zwei Einsaetze; erst ab dieser Deckung darf die Maschine ihn geben.
  const plan = prepareSlotSpin(memory, bank >= reference * 3);
  const outcome = playSlot(prng, { forceWin: plan.forceWin });
  const multiplierBps = outcome.multiplierBps > 0 ? Math.max(0, outcome.multiplierBps + bonusBps) : 0;
  // Was die Maschine einbehaelt, deckt spaetere Entladungen; sie zahlt nie mehr, als sie hat.
  const raw = mulVC(bet, multiplierBps);
  const covered = Math.max(0, bank + bet) as VaCoinMicro;
  const payout = plan.forceWin ? (Math.min(raw, covered) as VaCoinMicro) : raw;
  const prefix = plan.forceWin ? 'ENTLADUNG · ' : '';
  recordSlotSpin(memory, outcome.symbols, outcome.multiplierBps, outcome.jackpot);
  memory.bank = (memory.bank ?? 0) + bet - payout;
  return {
    game: 'SLOT',
    stake: bet,
    payout,
    multiplierBps,
    label: `${prefix}${outcome.label}`,
    detail: outcome.detail,
  };
}
