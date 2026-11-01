/** Rival Play Commands: Karten- und Risikospiele in fremden Casinos. */

import type { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import type { Prng } from '../core/rng/prng';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import { createShellRound } from '../core/games/shell-round';
import { additionalBet, dealCardOutcome, riskRivalWin, settleCardOutcome, visitRivalWithJournal, type CardDeal } from './foreign-play';
import type { WorldState } from '../core/sim/types';
import { takeHomeToWallet } from './player-tools';

export function riskCardCmd(
  world: WorldState,
  ledger: Ledger,
  rivalId: import('../core/sim/types').RivalId,
  color: RiskColor,
  stakeVC: number,
  prng: Prng,
): RiskOutcome | null {
  return riskRivalWin(world, ledger, rivalId, fromVC(stakeVC), color, prng).outcome;
}

export function dealCardCmd(
  world: WorldState,
  ledger: Ledger,
  prng: Prng,
  rivalId: import('../core/sim/types').RivalId,
  machineIndex: number,
  stakeVC: number,
): CardDeal | null {
  try {
    return dealCardOutcome(world, ledger, prng, rivalId, machineIndex, stakeVC).result;
  } catch {
    return null;
  }
}

export function settleCardCmd(
  world: WorldState,
  ledger: Ledger,
  rivalId: import('../core/sim/types').RivalId,
  machineIndex: number,
  stakeVC: number,
  netBps: number,
  label: string,
): GameResult | null {
  try {
    return settleCardOutcome(world, ledger, rivalId, machineIndex, stakeVC, netBps, label).result;
  } catch {
    return null;
  }
}

export function additionalBetCmd(
  world: WorldState,
  ledger: Ledger,
  amountVC: number,
): void {
  additionalBet(world, ledger, fromVC(amountVC), world.tick);
}

export function playRivalCmd(
  world: WorldState,
  ledger: Ledger,
  rivalId: import('../core/sim/types').RivalId,
  machineIndex: number,
  betVC: number,
  prng: Prng,
  options: GameExtras = {},
): GameResult | null {
  const result = visitRivalWithJournal(world, ledger, rivalId, machineIndex, betVC, prng, options);
  return result?.result ?? null;
}

export function shellRoundCmd(
  prng: Prng,
  cups = 3,
): ReturnType<typeof createShellRound> {
  return createShellRound(prng, cups);
}

export function takeHomeCmd(
  world: WorldState,
  ledger: Ledger,
  amountVC: number,
): string {
  return takeHomeToWallet(world, ledger, amountVC);
}
