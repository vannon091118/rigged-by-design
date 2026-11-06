/** Ehrliches Slot-Gedächtnis und der Drucklader; reine, serialisierbare Zustandslogik. */
import { SLOT_SYMBOLS, slotJackpotInterval } from './engines/slot';
import type { VaCoinMicro } from '../economy/vacoin';

const RECENT_LIMIT = 100;
/** Ab dieser Ladung ist der naechste bezahlte Spin ein garantierter Treffer. */
const CHARGE_LEVEL = 7;

export interface SlotMemory {
  spinsToday: number;
  spinsSinceLastJackpot: number;
  averageJackpotInterval: number;
  currentDrift: number;
  recentSymbolHistogram: Record<string, number>;
  recentSpins: string[][];
  pressureLevel: number;
  /** Volle Ladung: der naechste bezahlte Spin gleicht den Einsatz aus. */
  chargeReady: boolean;
  /** Einbehaltener Vorsprung der Maschine, aus dem die Entladung bezahlt wird. */
  bank?: number;
}

interface SpinPlan {
  readonly forceWin: boolean;
}

export function createSlotMemory(reels = 5): SlotMemory {
  const interval = slotJackpotInterval(reels);
  return {
    spinsToday: 0,
    spinsSinceLastJackpot: 0,
    averageJackpotInterval: interval,
    currentDrift: -interval,
    recentSymbolHistogram: Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])),
    recentSpins: [],
    pressureLevel: 0,
    chargeReady: false,
    bank: 0,
  };
}

export function slotDrift(memory: SlotMemory): number {
  return memory.spinsSinceLastJackpot - memory.averageJackpotInterval;
}

function addHistogram(memory: SlotMemory, symbols: readonly string[], delta: number): void {
  for (const symbol of symbols) {
    memory.recentSymbolHistogram[symbol] = Math.max(0, (memory.recentSymbolHistogram[symbol] ?? 0) + delta);
  }
}

/**
 * Die Entladung addiert keinen zweiten Gewinn: sie zahlt aus dem Polster und
 * darf es ueberziehen. Der Vorschuss wird von spaeteren Gewinnen abgezogen,
 * damit die Maschine langfristig nicht mehr ausschuetet als sie einbehaelt.
 */
export function settleSlotSpin(
  withheld: VaCoinMicro,
  bet: VaCoinMicro,
  raw: VaCoinMicro,
  discharged: boolean,
): { payout: VaCoinMicro; withheld: VaCoinMicro } {
  const carried = (withheld + bet) as VaCoinMicro;
  // Ein negativer Stand ist ein Vorschuss: er wird erst zurueckgeholt, bevor wieder voll gezahlt wird.
  const payout = (discharged ? raw : Math.max(0, raw + Math.min(0, carried))) as VaCoinMicro;
  return { payout, withheld: (carried - payout) as VaCoinMicro };
}

/** Ein Spin wird immer zuerst ehrlich verbucht, erst danach greift die naechste Stufe. */
export function recordSlotSpin(
  memory: SlotMemory,
  symbols: readonly string[],
  multiplierBps: number,
  jackpot = false,
): void {
  memory.spinsToday += 1;
  memory.spinsSinceLastJackpot = jackpot ? 0 : memory.spinsSinceLastJackpot + 1;
  memory.currentDrift = slotDrift(memory);
  const old = memory.recentSpins.length >= RECENT_LIMIT ? memory.recentSpins.shift() : undefined;
  if (old) addHistogram(memory, old, -1);
  memory.recentSpins.push([...symbols]);
  addHistogram(memory, symbols, 1);

  if (jackpot || multiplierBps > 10_000) {
    memory.pressureLevel = 0;
    memory.chargeReady = false;
    return;
  }
  memory.pressureLevel = Math.min(CHARGE_LEVEL, memory.pressureLevel + 1);
  // Volle Ladung heisst: der naechste bezahlte Spin gleicht den Einsatz aus. Der Spin
  // selbst bleibt bezahlt, damit die Entladung den Hausvorteil nicht aufzehrt.
  if (memory.pressureLevel >= CHARGE_LEVEL) memory.chargeReady = true;
}

/**
 * Gibt die Entladung frei. Eine Maschine zahlt nur aus, was sie einbehalten hat:
 * ohne Deckung im eigenen Polster bleibt der Lader geladen.
 */
export function prepareSlotSpin(memory: SlotMemory, fundable = true): SpinPlan {
  const forceWin = memory.chargeReady && fundable;
  if (forceWin) {
    memory.chargeReady = false;
    memory.pressureLevel = 0;
  }
  return { forceWin };
}
