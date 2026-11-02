/** Spielen, Trinken, Klo: jeder Aufruf endet in einer konkreten Aktion, nicht in Zahlenrauschen. */
import type { Ledger } from '../economy/ledger';
import { canAfford, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playAction } from '../games/contracts';
import { playPlinkoRound } from '../games/plinko-sandbox';
import { playSlotSession } from '../games/slot-session';
import type { Prng } from '../rng/prng';
import { clamp, releaseAndChoose } from './guest-core';
import { chooseActivity } from './guest-choice';
import { deliverDrink, useToilet } from './deliveries';
import { refreshNeeds } from './needs';
import { guestAccount, HAUSKONTO, payOut, placeBet, SHOP } from './money';
import { resolveModEffects } from './offers';
import { TX_REASON } from './tx-reasons';
import { getPersona } from './personas';
import type { Furniture, Guest, WorldState } from './types';
import { dirtyTileIndex } from './emotion';

/** Sucht erhoeht den Einsatz um bis zu 50 % und verlaengert die Sitzung; beides bleibt bezahlbar. */
export function addictedStake(world: WorldState, item: Furniture, guest: Guest): VaCoinMicro {
  const base = Math.max(world.prices.slotMinBet, item.baseBet);
  return Math.round(base * (1 + guest.addiction / 200)) as VaCoinMicro;
}

/** Vier Spins ohne Sucht, bis zu neun mit voller Sucht. */
export const sessionSpins = (addiction: number): number => 4 + Math.floor(addiction / 20);

function playSpin(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  if (item.damaged) { releaseAndChoose(world, guest); return; }
  const wallet = ledger.getBalance(guestAccount(guest.id));
  const bet = Math.min(wallet, addictedStake(world, item, guest)) as VaCoinMicro;
  if (!canAfford(wallet, bet)) {
    releaseAndChoose(world, guest);
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    return;
  }
  const effects = resolveModEffects(item.gameId, item.mods);
  const result = item.gameId === 'PLINKO'
    ? playPlinkoRound(world, prng, bet, effects.bonusBps)
    : item.gameId === 'SLOT'
      ? playSlotSession(item, prng, bet, effects.bonusBps)
      : playAction({ game: item.gameId ?? 'SLOT', stake: bet, bonusBps: effects.bonusBps }, prng);
  try {
    if (result.stake > ZERO_VC) placeBet(ledger, guest.id, result.stake, world.tick);
  } catch {
    releaseAndChoose(world, guest);
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    return;
  }
  const payout = result.payout;
  // Volle Auszahlung: fehlende Deckung wird als Schuld gebucht, nie still gekappt.
  if (payout > ZERO_VC) payOut(ledger, guest.id, payout, world.tick);
  if (effects.operating > ZERO_VC) {
    try { ledger.transfer(HAUSKONTO, SHOP, effects.operating, TX_REASON.MOD_OPERATING, world.tick); } catch { /* Konto reicht nicht */ }
  }
  const netWin = payout > bet;
  const push = payout === bet;
  const jackpot = payout > ZERO_VC && isJackpotLabel(result.multiplierBps);
  guest.lastResult = jackpot ? 'JACKPOT!' : payout > ZERO_VC || !item.mods.includes('NEAR_MISS') ? result.label : 'FAST!';
  // Ein Verlust aergert, aber er darf keinen Gast in dreissig Runden zum Raubtier machen.
  guest.mood = clamp(guest.mood + (netWin ? 8 : push ? 0 : -0.5) + (effects.patience > 0 ? 1 : 0));
  guest.patience = clamp(guest.patience - 0.35 + effects.patience);
  // Sucht entsteht nur am Spiel. Wer nie spielen kann, bleibt bei seinen Startpunkten stehen.
  const persona = getPersona(guest.persona);
  const flow = guest.mood >= 65 && guest.patience >= 50 ? 1.5 : 1;
  guest.addiction = clamp(guest.addiction + (netWin ? 4 : 1) * persona.addictionRate * flow + effects.addiction * 0.5);
  guest.spins += 1;
  guest.stateTicks += 1;
  item.condition = Math.max(0, item.condition - 0.08);
  if (prng.nextFloat() < 0.012) world.dirty.add(dirtyTileIndex(world.size, guest.position.x, guest.position.y));
  if (guest.stateTicks >= sessionSpins(guest.addiction) || guest.patience <= 0) {
    releaseAndChoose(world, guest);
    refreshNeeds(guest);
    if (guest.need === 'play' && guest.mood < 50) guest.need = 'drink';
  }
}

/** Erst ab 2,5x heisst es Jackpot; 1,0x ist ein Push und kein Rausch. */
export const isJackpotLabel = (multiplierBps: number): boolean => multiplierBps >= 25_000;

export function actAtTarget(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  if (guest.state === 'PLAY') { playSpin(world, ledger, prng, guest, item); return; }
  if (guest.state === 'DRINK') {
    if (guest.stateTicks === 0) {
      if (deliverDrink(world, ledger, guest, item)) {
        if (guest.spins > 0) guest.addiction = clamp(guest.addiction + 1.2 * getPersona(guest.persona).addictionRate);
        guest.dirtTimer += 1;
        if (guest.dirtTimer > 8) { world.dirty.add(dirtyTileIndex(world.size, guest.position.x, guest.position.y)); guest.dirtTimer = 0; }
        const served = world.agents.some((agent) => agent.role === 'bartender'
          && Math.abs(agent.x - item.x) + Math.abs(agent.y - item.y) <= 4);
        if (served) guest.stateTicks += 2;
      }
    }
    guest.stateTicks += 1;
    if (guest.stateTicks > 3) releaseAndChoose(world, guest);
    return;
  }
  if (guest.state === 'TOILET') {
    if (guest.stateTicks === 0) useToilet(world, guest, item);
    guest.stateTicks += 1;
    if (guest.stateTicks > 2) releaseAndChoose(world, guest);
    return;
  }
  if (guest.state === 'WAIT') {
    guest.stateTicks += 1;
    if (guest.stateTicks > 3) {
      releaseAndChoose(world, guest);
      chooseActivity(world, guest, ledger, prng);
    }
    return;
  }
  releaseAndChoose(world, guest);
}
