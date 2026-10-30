/** Die fuenf Wettfelder am Wuerfeltisch: Trefferregel, Auszahlung und ein einzelner Wurf. */
import type { Prng } from '../rng/prng';

export type DiceBetKind = 'UNDER' | 'SEVEN' | 'OVER' | 'DOUBLES' | 'HIGH';

interface DiceBetDef {
  readonly id: DiceBetKind;
  readonly label: string;
  readonly payoutBps: number;
  readonly hint: string;
}

/**
 * Zwei faire Wuerfel haben 36 Kombinationen. Jede Quote liegt so, dass der
 * Erwartungswert des Hauses bei 93 bis 94 Prozent bleibt.
 */
export const DICE_PAYOUTS: Readonly<Record<DiceBetKind, number>> = {
  UNDER: 22_500,
  OVER: 22_500,
  SEVEN: 56_000,
  DOUBLES: 56_000,
  HIGH: 56_000,
};

export const DICE_BETS: readonly DiceBetDef[] = [
  { id: 'UNDER', label: 'Unter 7', payoutBps: DICE_PAYOUTS.UNDER, hint: 'Summe 2 bis 6. Trifft in 15 von 36 Faellen.' },
  { id: 'SEVEN', label: 'Lucky 7', payoutBps: DICE_PAYOUTS.SEVEN, hint: 'Genau die Summe 7. Trifft in 6 von 36 Faellen.' },
  { id: 'OVER', label: 'Ueber 7', payoutBps: DICE_PAYOUTS.OVER, hint: 'Summe 8 bis 12. Trifft in 15 von 36 Faellen.' },
  { id: 'DOUBLES', label: 'Pasch', payoutBps: DICE_PAYOUTS.DOUBLES, hint: 'Beide Wuerfel gleich. Trifft in 6 von 36 Faellen.' },
  { id: 'HIGH', label: 'Hohe Summe', payoutBps: DICE_PAYOUTS.HIGH, hint: 'Summe 10 bis 12. Trifft in 6 von 36 Faellen.' },
];

export function diceBetWins(kind: DiceBetKind, a: number, b: number): boolean {
  const sum = a + b;
  if (kind === 'UNDER') return sum < 7;
  if (kind === 'SEVEN') return sum === 7;
  if (kind === 'OVER') return sum > 7;
  if (kind === 'DOUBLES') return a === b;
  return sum >= 10;
}

interface DiceBetOutcome {
  readonly dice: readonly [number, number];
  readonly sum: number;
  readonly won: boolean;
  readonly multiplierBps: number;
}

/** Ein Wurf, eine Wette: die Augenzahlen entscheiden, nichts wird nachtraeglich gedreht. */
export function rollDiceBet(kind: DiceBetKind, prng: Prng): DiceBetOutcome {
  const a = prng.nextInt(1, 6);
  const b = prng.nextInt(1, 6);
  const won = diceBetWins(kind, a, b);
  return { dice: [a, b], sum: a + b, won, multiplierBps: won ? DICE_PAYOUTS[kind] : 0 };
}
