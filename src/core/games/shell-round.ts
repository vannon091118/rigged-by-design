/**
 * Huetchenspiel als interaktive Runde: erst mischen (Kern), dann waehlt der Spieler.
 * Die Kugel steht vor der Wahl fest, sonst waere die Wahl des Spielers wertlos.
 */
import type { Prng } from '../rng/prng';

export interface ShellMove {
  readonly left: number;
  readonly right: number;
}

export interface ShellRound {
  readonly cups: number;
  readonly ballCup: number;
  readonly moves: readonly ShellMove[];
}

/** 95 % Auszahlung: die Quote waechst mit der Zahl der Becher. */
export function shellPayoutBps(cups: number): number {
  return Math.round(9_500 * Math.max(3, Math.min(5, cups)));
}

/** Mischfolge als echte Permutation: getauscht werden immer zwei verschiedene Becher. */
export function createShellRound(prng: Prng, cups = 3): ShellRound {
  const count = Math.max(3, Math.min(5, Math.trunc(cups)));
  const ballCup = prng.nextInt(0, count - 1);
  const moves: ShellMove[] = [];
  const total = count + 4;
  for (let step = 0; step < total; step += 1) {
    const left = prng.nextInt(0, count - 1);
    let right = prng.nextInt(0, count - 2);
    if (right >= left) right += 1;
    moves.push({ left, right });
  }
  return { cups: count, ballCup, moves };
}

/** Wo steht die Kugel nach der Mischfolge? Reine Rechnung, damit der Kern die Wahrheit haelt. */
export function ballAfterMoves(round: ShellRound): number {
  let position = round.ballCup;
  for (const move of round.moves) {
    if (position === move.left) position = move.right;
    else if (position === move.right) position = move.left;
  }
  return position;
}

interface ShellPick {
  readonly won: boolean;
  readonly multiplierBps: number;
  readonly label: string;
  readonly cups: number;
}

/** Die Wahl des Spielers gegen die feste Kugel. */
export function resolveShellPick(round: ShellRound, pick: number): ShellPick {
  if (!Number.isInteger(pick) || pick < 0 || pick >= round.cups) {
    throw new Error(`Huetchen: Becher ${String(pick)} gibt es nicht.`);
  }
  const ballCup = ballAfterMoves(round);
  const won = pick === ballCup;
  return {
    won,
    multiplierBps: won ? shellPayoutBps(round.cups) : 0,
    label: won ? `Becher ${pick + 1} - Perle gefunden` : `Becher ${pick + 1} - leer, Perle lag unter ${ballCup + 1}`,
    cups: round.cups,
  };
}
