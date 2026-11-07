/**
 * VaCoin (VC) - Geld als ganzzahlige Mikro-Einheiten.
 * 1.0000 VC = 10_000 Mikro-Einheiten. Gespeichert wird niemals ein Float.
 */
declare const vaCoinBrand: unique symbol;

/** Branded Integer-Typ: Mikro-Units, 1 VC = 10_000. */
export type VaCoinMicro = number & { readonly [vaCoinBrand]: true };

/** Mikro-Einheiten pro 1 VC (4 Nachkommastellen). */
const MICRO_PER_VC = 10_000;
/** Basispunkte: 10_000 bps = 100 %. */
const BPS_DENOMINATOR = 10_000;
export const ZERO_VC = 0 as VaCoinMicro;

class VaCoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaCoinError';
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new VaCoinError(`${label}: sichere Ganzzahl erwartet, erhalten ${String(value)}`);
  }
}

/** VC -> Mikro. Rundet kaufmaennisch (halbe Einheiten weg von 0) und deterministisch. */
export function fromVC(vc: number): VaCoinMicro {
  if (typeof vc !== 'number' || !Number.isFinite(vc)) {
    throw new VaCoinError(`fromVC: endliche Zahl erwartet, erhalten ${String(vc)}`);
  }
  const scaled = vc * MICRO_PER_VC;
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
    throw new VaCoinError(`fromVC: ${vc} liegt ausserhalb des sicheren Bereichs`);
  }
  return Math.round(scaled) as VaCoinMicro;
}

/** Mikro -> Anzeige, immer exakt 4 Nachkommastellen, z. B. "12.3400 VC". */
export function toVCString(micro: VaCoinMicro): string {
  assertSafeInteger(micro, 'toVCString');
  const negative = micro < 0;
  const abs = Math.abs(micro);
  const whole = Math.floor(abs / MICRO_PER_VC);
  const frac = abs - whole * MICRO_PER_VC;
  return `${negative ? '-' : ''}${whole}.${String(frac).padStart(4, '0')} VC`;
}

export function addVC(a: VaCoinMicro, b: VaCoinMicro): VaCoinMicro {
  assertSafeInteger(a, 'addVC(a)');
  assertSafeInteger(b, 'addVC(b)');
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new VaCoinError('addVC: Ueberlauf');
  return sum as VaCoinMicro;
}

export function subVC(a: VaCoinMicro, b: VaCoinMicro): VaCoinMicro {
  assertSafeInteger(a, 'subVC(a)');
  assertSafeInteger(b, 'subVC(b)');
  const diff = a - b;
  if (!Number.isSafeInteger(diff)) throw new VaCoinError('subVC: Ueberlauf');
  return diff as VaCoinMicro;
}

/**
 * Multiplikation mit einem Basispunkt-Faktor (10_000 bps = 100 %).
 * Exakt per BigInt, danach Floor-Rounding zugunsten der Bank.
 */
export function mulVC(micro: VaCoinMicro, factorBps: number): VaCoinMicro {
  assertSafeInteger(micro, 'mulVC(micro)');
  assertSafeInteger(factorBps, 'mulVC(factorBps)');
  if (factorBps < 0) throw new VaCoinError('mulVC: factorBps darf nicht negativ sein');

  const product = BigInt(micro) * BigInt(factorBps);
  const divisor = BigInt(BPS_DENOMINATOR);
  let quotient = product / divisor;
  // BigInt-Division trunkiert gegen 0 - fuer negative Betraege echtes Floor.
  if (product % divisor !== 0n && product < 0n) quotient -= 1n;

  const result = Number(quotient);
  if (!Number.isSafeInteger(result)) throw new VaCoinError('mulVC: Ueberlauf');
  return result as VaCoinMicro;
}

/** true, wenn die Deckung reicht. Negative Betraege sind nie bezahlbar. */
export function canAfford(balance: VaCoinMicro, cost: VaCoinMicro): boolean {
  assertSafeInteger(balance, 'canAfford(balance)');
  assertSafeInteger(cost, 'canAfford(cost)');
  return cost >= 0 && balance >= cost;
}
