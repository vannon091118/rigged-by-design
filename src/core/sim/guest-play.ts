/** Spielen, Trinken, Klo: jeder Aufruf endet in einer konkreten Aktion, nicht in Zahlenrauschen. */
import type { Ledger } from '../economy/ledger';
import { canAfford, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playAction } from '../games/contracts';
import { playPlinkoRound } from '../games/plinko-sandbox';
import type { Prng } from '../rng/prng';
import { clamp, releaseAndChoose } from './guest-core';
import { chooseActivity } from './guest-choice';
import { deliverDrink, useToilet } from './deliveries';
import { refreshNeeds } from './needs';
import { guestAccount, HAUSKONTO, payOut, placeBet, SHOP } from './money';
import { modEffects } from './offers';
import { getPersona } from './personas';
import type { Furniture, Guest, WorldState } from './types';

function playSpin(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  if (item.damaged) { releaseAndChoose(world, guest); return; }
  const wallet = ledger.getBalance(guestAccount(guest.id));
  const bet = Math.min(wallet, Math.max(world.prices.slotMinBet, item.baseBet)) as VaCoinMicro;
  if (!canAfford(wallet, bet)) {
    releaseAndChoose(world, guest);
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    return;
  }
  const effects = modEffects(item);
  const result = item.gameId === 'PLINKO'
    ? playPlinkoRound(world, prng, bet, effects.bonusBps)
    : playAction({ game: item.gameId ?? 'SLOT', stake: bet, bonusBps: effects.bonusBps }, prng);
  try {
    placeBet(ledger, guest.id, bet, world.tick);
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
    try { ledger.transfer(HAUSKONTO, SHOP, effects.operating, 'mod betrieb', world.tick); } catch { /* Konto reicht nicht */ }
  }
  const netWin = payout > bet;
  const push = payout === bet;
  const jackpot = payout > ZERO_VC && result.multiplierBps >= 10_000;
  guest.lastResult = jackpot ? 'JACKPOT!' : payout > ZERO_VC || !item.mods.includes('NEAR_MISS') ? result.label : 'FAST!';
  guest.mood = clamp(guest.mood + (netWin ? 8 : push ? 0 : -2) + (effects.patience > 0 ? 1 : 0));
  guest.patience = clamp(guest.patience - 1 + effects.patience);
  // Sucht entsteht nur am Spiel. Wer nie spielen kann, bleibt bei seinen Startpunkten stehen.
  const persona = getPersona(guest.persona);
  const flow = guest.mood >= 65 && guest.patience >= 50 ? 1.5 : 1;
  guest.addiction = clamp(guest.addiction + (netWin ? 4 : 1) * persona.addictionRate * flow + effects.addiction * 0.5);
  guest.spins += 1;
  guest.stateTicks += 1;
  item.condition = Math.max(0, item.condition - 0.18);
  if (prng.nextFloat() < 0.07) world.dirty.add((guest.position.y * world.size + guest.position.x) | 0);
  if (guest.stateTicks >= 6 || guest.patience <= 0) {
    releaseAndChoose(world, guest);
    refreshNeeds(guest);
    if (guest.need === 'play' && guest.mood < 50) guest.need = 'drink';
  }
}

export function actAtTarget(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  if (guest.state === 'PLAY') { playSpin(world, ledger, prng, guest, item); return; }
  if (guest.state === 'DRINK') {
    if (guest.stateTicks === 0) {
      if (deliverDrink(world, ledger, guest, item)) {
        if (guest.spins > 0) guest.addiction = clamp(guest.addiction + 1.2 * getPersona(guest.persona).addictionRate);
        guest.dirtTimer += 1;
        if (guest.dirtTimer > 4) { world.dirty.add((guest.position.y * world.size + guest.position.x) | 0); guest.dirtTimer = 0; }
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
