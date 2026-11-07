/** Reine Plinko-Konfiguration: Peg-Profile, Taschenbreiten und Reihen-Leiter. */
import type { Vec2 } from '../physics/body';

export type PegKind = 'NORMAL_PEG' | 'BOUNCY_PEG' | 'STICKY_PEG' | 'MAGNET_PEG' | 'SPLIT_PEG';
export type PlinkoMode = 'SINGLE' | 'TWIN' | 'TRIPLE';

export interface PlinkoPeg { readonly row: number; readonly column: number; readonly kind: PegKind; }
export interface PlinkoConfig {
  readonly pocketCount: number;
  readonly pocketWidths: readonly number[];
  readonly pegs: readonly PlinkoPeg[];
}
export interface PlinkoDrop {
  readonly pockets: readonly number[];
  readonly tracks: readonly (readonly Vec2[])[];
  readonly steps: number;
}
interface PegPhysics {
  readonly restitution: number;
  readonly friction: number;
  readonly magnetRadius: number;
  readonly magnetStrength: number;
  readonly split: boolean;
}
interface PlinkoProgress { readonly rows: number; readonly specials: number; }

export const PLINKO_BASE_ROWS = 8;
export const PLINKO_MAX_ROWS = 12;
const PEG_COLUMNS = 8;

export const PEG_PHYSICS: Readonly<Record<PegKind, PegPhysics>> = {
  NORMAL_PEG: { restitution: 0.55, friction: 0.15, magnetRadius: 0, magnetStrength: 0, split: false },
  BOUNCY_PEG: { restitution: 0.85, friction: 0.15, magnetRadius: 0, magnetStrength: 0, split: false },
  STICKY_PEG: { restitution: 0.2, friction: 0.8, magnetRadius: 0, magnetStrength: 0, split: false },
  MAGNET_PEG: { restitution: 0.55, friction: 0.15, magnetRadius: 6, magnetStrength: 180, split: false },
  SPLIT_PEG: { restitution: 0.55, friction: 0.15, magnetRadius: 0, magnetStrength: 0, split: true },
};

export function defaultPlinkoConfig(): PlinkoConfig {
  return { pocketCount: 9, pocketWidths: Array.from({ length: 9 }, () => 100 / 9), pegs: [] };
}

export function normalizePlinkoConfig(input: Partial<PlinkoConfig> = {}): PlinkoConfig {
  const pocketCount = input.pocketCount ?? 9;
  if (!Number.isInteger(pocketCount) || pocketCount < 5 || pocketCount > 13) {
    throw new Error('Plinko: 5 bis 13 Taschen erlaubt.');
  }
  const raw = input.pocketWidths ?? Array.from({ length: pocketCount }, () => 100 / pocketCount);
  if (raw.length !== pocketCount || raw.some((width) => !Number.isFinite(width) || width <= 0)) {
    throw new Error('Plinko: Jede Tasche braucht eine positive Breite.');
  }
  const total = raw.reduce((sum, width) => sum + width, 0);
  if (Math.abs(total - 100) > 1e-6) throw new Error('Plinko: Taschenbreiten muessen zusammen 100 ergeben.');
  const pegs = input.pegs ?? [];
  const seen = new Set<string>();
  for (const peg of pegs) {
    if (!Number.isInteger(peg.row) || peg.row < 0 || peg.row >= PLINKO_MAX_ROWS) {
      throw new Error(`Plinko: Peg-Reihe ${peg.row} liegt ausserhalb 0..11.`);
    }
    if (!Number.isInteger(peg.column) || peg.column < 0 || peg.column >= PEG_COLUMNS) {
      throw new Error(`Plinko: Peg-Spalte ${peg.column} liegt ausserhalb 0..7.`);
    }
    const key = `${peg.row}:${peg.column}`;
    if (seen.has(key)) throw new Error(`Plinko: Peg ${key} ist doppelt.`);
    seen.add(key);
    if (!(peg.kind in PEG_PHYSICS)) throw new Error(`Plinko: Unbekannter Peg-Typ ${String(peg.kind)}.`);
  }
  return { pocketCount, pocketWidths: raw.map((width) => width), pegs: pegs.map((peg) => ({ ...peg })) };
}

function specialPegCount(config: PlinkoConfig): number {
  return config.pegs.filter((peg) => peg.kind !== 'NORMAL_PEG').length;
}

/** Reihen 8, 9, 10, 11 werden nacheinander anhand der echten Spielhistorie freigeschaltet. */
export function plinkoProgress(totalDrops: number, addictionScore: number, config: PlinkoConfig): PlinkoProgress {
  const specials = specialPegCount(config);
  let rows = PLINKO_BASE_ROWS;
  if (totalDrops >= 25) rows = 9;
  if (totalDrops >= 75) rows = 10;
  if (totalDrops >= 200 && specials >= 3) rows = 11;
  if (addictionScore > 40 && rows >= 11) rows = 12;
  return { rows, specials };
}

/** Standard-Paytable bleibt fuer 9 Taschen exakt die kalibrierte Tabelle. */
export function plinkoPaytable(pocketCount: number): readonly number[] {
  if (pocketCount === 9) {
    return [17_100, 15_800, 13_800, 0, 0, 12_000, 13_800, 15_800, 18_700];
  }
  const middle = (pocketCount - 1) / 2;
  return Array.from({ length: pocketCount }, (_, index) => {
    const distance = Math.abs(index - middle);
    return distance < 1 ? 0 : Math.round(10_000 + distance * 2_000);
  });
}

export function pocketPayout(config: PlinkoConfig, pocket: number): number {
  return plinkoPaytable(config.pocketCount)[pocket] ?? 0;
}
