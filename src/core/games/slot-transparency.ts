/** Ehrliches Slot-Gedächtnis und der Drucklader; reine, serialisierbare Zustandslogik. */
import { SLOT_JACKPOT_INTERVAL, SLOT_SYMBOLS } from './engines/slot';

const RECENT_LIMIT = 100;

export interface SlotMemory {
  spinsToday: number;
  spinsSinceLastJackpot: number;
  averageJackpotInterval: number;
  currentDrift: number;
  recentSymbolHistogram: Record<string, number>;
  recentSpins: string[][];
  pressureLevel: number;
  freeSpins: number;
  freeOffset: number;
  chargeReady: boolean;
}

interface SpinPlan {
  readonly free: boolean;
  readonly offset: number;
  readonly forceWin: boolean;
}

export function createSlotMemory(): SlotMemory {
  return {
    spinsToday: 0,
    spinsSinceLastJackpot: 0,
    averageJackpotInterval: SLOT_JACKPOT_INTERVAL,
    currentDrift: -SLOT_JACKPOT_INTERVAL,
    recentSymbolHistogram: Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])),
    recentSpins: [],
    pressureLevel: 0,
    freeSpins: 0,
    freeOffset: 0,
    chargeReady: false,
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

function resetPressure(memory: SlotMemory): void {
  memory.pressureLevel = 0;
  memory.freeSpins = 0;
  memory.chargeReady = false;
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
    resetPressure(memory);
    return;
  }
  memory.pressureLevel += 1;
  if (memory.pressureLevel === 5) {
    memory.freeSpins = 1;
    memory.freeOffset = (memory.spinsToday % 3) + 1;
  }
  if (memory.pressureLevel >= 7) {
    memory.pressureLevel = 7;
    memory.freeSpins = 1;
    memory.chargeReady = true;
    memory.freeOffset = (memory.spinsToday % 2) + 1;
  }
}

/** Verbraucht einen vorbereiteten Gratis-Spin bzw. die Entladung. */
export function prepareSlotSpin(memory: SlotMemory): SpinPlan {
  const free = memory.freeSpins > 0;
  const offset = free ? memory.freeOffset : 0;
  const forceWin = memory.chargeReady;
  if (free) memory.freeSpins -= 1;
  if (forceWin) {
    memory.chargeReady = false;
    memory.pressureLevel = 0;
  }
  return { free, offset, forceWin };
}
