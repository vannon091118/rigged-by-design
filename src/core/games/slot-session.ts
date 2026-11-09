/** Ein Slot-Spin mit Gedächtnis: Drucklader und Entladung werden hier tatsaechlich konsumiert. */
import { mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Furniture } from '../sim/types';
import type { GameResult } from './contracts';
import { playSlot } from './engines/slot';
import { slotConfigOf } from './slot-config';
import { createSlotMemory, prepareSlotSpin, recordSlotSpin, settleSlotSpin, type SlotMemory } from './slot-transparency';
import type { Prng } from '../rng/prng';
import { emit } from '../sim/events';

/** Ein echter Gast-Spin; der Testspin bleibt absichtlich ohne Gedaechtnis-Wirkung. */
export function playSlotSession(
  item: Furniture,
  prng: Prng,
  bet: VaCoinMicro,
  bonusBps = 0,
): GameResult {
  if (!item.slotMemory) item.slotMemory = createSlotMemory(item.reels);
  const memory = item.slotMemory;
  const bank = (memory.bank ?? 0) as VaCoinMicro;
  // Die Entladung ist erst frei, wenn der einbehaltene Bankstand die
  // tatsaechliche Auszahlung dieses Einsatzes deckt. baseBet ist dafuer
  // irrelevant; der Bonus skaliert mit dem echten Einsatz.
  const forcedPayout = mulVC(bet, Math.max(0, 10_000 + bonusBps)) as VaCoinMicro;
  const plan = prepareSlotSpin(memory, bank >= forcedPayout);
  const outcome = playSlot(prng, { forceWin: plan.forceWin, config: slotConfigOf(item) });
  const multiplierBps = outcome.multiplierBps > 0 ? Math.max(0, outcome.multiplierBps + bonusBps) : 0;
  const raw = mulVC(bet, multiplierBps) as VaCoinMicro;
  // Entladung und normale Gewinne teilen sich denselben Topf: ein Vorschuss wird zurueckgeholt.
  const settlement = settleSlotSpin(bank, bet, raw, plan.forceWin);
  const payout = settlement.payout;
  const prefix = plan.forceWin ? 'ENTLADUNG · ' : '';
  recordSlotSpin(memory, outcome.symbols, outcome.multiplierBps, outcome.jackpot);
  memory.bank = settlement.withheld;
  // Visuelle Ereignisse fuer die Render-Schicht (Partikel, Sound, Flash).
  if (outcome.jackpot) {
    emit('slot:jackpot', { itemId: item.id, stake: bet, payout, multiplierBps: outcome.multiplierBps });
  }
  if (plan.forceWin) {
    emit('slot:chargeDischarge', { itemId: item.id, stake: bet, payout });
  } else if (memory.chargeReady) {
    emit('slot:chargeReady', { itemId: item.id });
  } else {
    emit('slot:spin', { itemId: item.id, stake: bet, multiplierBps: outcome.multiplierBps });
  }
  return {
    game: 'SLOT',
    stake: bet,
    payout,
    multiplierBps,
    discharged: plan.forceWin,
    label: `${prefix}${outcome.label}`,
    detail: outcome.detail,
  };
}

/** Kopie inklusive Histogramm und Verlauf; das echte Geraet bleibt unangetastet. */
function cloneSlotMemory(memory: SlotMemory | undefined): SlotMemory {
  const base = memory ?? createSlotMemory();
  return {
    ...base,
    recentSymbolHistogram: { ...base.recentSymbolHistogram },
    recentSpins: base.recentSpins.map((spin) => [...spin]),
  };
}

/**
 * Testspin: rechnet auf einer Kopie des Gedaechtnisses und mit eigenem Zufall.
 * Damit veraendert eine kostenlose Vorschau weder Maschine noch Weltverlauf.
 */
export function playSlotTest(item: Furniture, prng: Prng): GameResult {
  return playSlotSession({ ...item, slotMemory: cloneSlotMemory(item.slotMemory) }, prng, ZERO_VC);
}
