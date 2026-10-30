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
  const plan = prepareSlotSpin(memory);
  const outcome = playSlot(prng, {
    offset: plan.offset,
    forceWin: plan.forceWin,
    lowWinBias: memory.pressureLevel >= 3,
  });
  const multiplierBps = outcome.multiplierBps > 0 ? Math.max(0, outcome.multiplierBps + bonusBps) : 0;
  const reference = plan.free && item.baseBet > ZERO_VC ? item.baseBet : bet;
  const payout = mulVC(reference, multiplierBps);
  const prefix = plan.forceWin ? 'ENTLADUNG · ' : plan.free ? 'GRATIS-SPIN · ' : '';
  recordSlotSpin(memory, outcome.symbols, outcome.multiplierBps, outcome.jackpot);
  return {
    game: 'SLOT',
    stake: plan.free ? ZERO_VC : bet,
    payout,
    multiplierBps,
    label: `${prefix}${outcome.label}`,
    detail: outcome.detail,
  };
}
