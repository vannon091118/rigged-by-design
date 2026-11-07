/**
 * Betriebs-Messlauf: ein skriptierter Betreiber (bauen, einstellen, reparieren, ausbauen)
 * plus die Kennzahlen aus balance-metrics. Kein Test fuer sich; der Balance-Test startet ihn.
 */
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { repair } from '../actions';
import { buyCrate, depositCrate, deployCrate, orderDrinks, orderParts, takeCrate } from '../deliveries';
import { TICKS_PER_DAY } from '../demand';
import { economyOf, type EconomySummary } from '../economics';
import { HAUSKONTO, openHouse } from '../money';
import { BUILD_DEFS, type BuildId } from '../offers';
import { companyStatus, isUnlocked } from '../progression';
import { remodel, remodelRequirements } from '../remodel';
import { reputation } from '../spawn';
import { hireAgent } from '../staff';
import { hasStaff } from '../staff-queries';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import type { StaffRole, TemplateId, WorldState } from '../types';
import { canPlace } from '../world';
import { emptyAcc, observe, summarize, type DayRow, type Departure, type Track } from './balance-metrics';

export type { DayRow };

/** Wie viele Geraete eine Stufe sinnvoll traegt; mehr Gaeste brauchen mehr Plaetze. */
const GAMES_TARGET: Readonly<Record<string, number>> = { BUDE: 2, KASSE: 6, SAAL: 12, KONZERN: 16 };
const NEXT: Partial<Record<TemplateId, TemplateId>> = { SMALL: 'MEDIUM', MEDIUM: 'LARGE' };
const RANK = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'];

function freeTile(world: WorldState, w: number, h: number): { x: number; y: number } | null {
  for (let y = 1; y < world.size - h; y += 1) {
    for (let x = 1; x < world.size - w; x += 1) {
      if (canPlace(world, x, y, w, h, true)) return { x, y };
    }
  }
  return null;
}

/** Ein Schritt pro Aufruf; was nicht geht (Geld, Platz), wird uebersprungen. */
function operate(world: WorldState, ledger: Ledger, tick: number): WorldState {
  const doIt = (fn: () => void): void => { try { fn(); } catch { /* naechster Schritt */ } };
  const status = companyStatus(world, ledger);
  const rank = RANK.indexOf(status.tier);

  if (tick % 30 === 0) {
    if (world.parts < 2 && !world.crates.some((crate) => crate.payload.kind === 'PARTS')) {
      doIt(() => orderParts(world, ledger, 3));
    }
    for (const item of world.furniture.filter((entry) => entry.gameId && (entry.condition < 40 || entry.damaged))) {
      if (world.parts > 0) doIt(() => repair(world, ledger, item.id));
    }
    for (const crate of world.crates.filter((entry) => entry.carriedBy === null)) {
      doIt(() => takeCrate(world, crate.id));
    }
    for (const crate of world.crates.filter((entry) => entry.carriedBy === 'player')) {
      if (crate.payload.kind === 'FURNITURE') {
        const def = BUILD_DEFS.find((entry) => entry.id === (crate.payload as { buildId: BuildId }).buildId);
        const spot = def ? freeTile(world, def.w, def.h) : null;
        if (spot) doIt(() => deployCrate(world, crate.id, spot.x, spot.y));
      } else if (crate.payload.kind === 'DRINKS') {
        const bar = world.furniture.find((entry) => entry.kind === 'BAR');
        if (bar) doIt(() => depositCrate(world, crate.id, bar.x, bar.y, bar.id));
      } else {
        const storage = world.furniture.find((entry) => entry.kind === 'STORAGE');
        if (storage) doIt(() => depositCrate(world, crate.id, storage.x, storage.y));
      }
    }
    const bar = world.furniture.find((entry) => entry.kind === 'BAR');
    if (bar && bar.stock < 6 && !world.crates.some((crate) => crate.payload.kind === 'DRINKS')) {
      doIt(() => orderDrinks(world, ledger, 8));
    }
    const games = world.furniture.filter((entry) => entry.gameId).length;
    const target = GAMES_TARGET[status.tier] ?? 2;
    if (world.crates.length === 0 && games < target) {
      const capital = ledger.getBalance(HAUSKONTO);
      // Abwechselnd kaufen, damit Persona-Geschmaecker ein Angebot finden.
      const affordable = BUILD_DEFS.filter((def) => def.gameId && isUnlocked(world, ledger, def.id) && capital >= def.cost * 2);
      const next = affordable[games % Math.max(1, affordable.length)];
      if (next) doIt(() => buyCrate(world, ledger, next.id));
    }
  }

  if (tick % TICKS_PER_DAY === 0 && world.day >= 2) {
    const roles: StaffRole[] = ['cashier', 'cleaner', 'bartender', 'guard', 'porter'];
    const needed = (role: StaffRole): boolean => {
      if (role === 'cashier') return true;
      if (role === 'cleaner') return world.dirty.size > 2 || world.day >= 4;
      if (role === 'bartender') return world.furniture.some((entry) => entry.kind === 'BAR');
      if (role === 'guard') return rank >= 2;
      return rank >= 2;
    };
    for (const role of roles) {
      if (needed(role) && !hasStaff(world, role)) doIt(() => hireAgent(world, ledger, role));
    }
    const next = NEXT[world.template];
    const need = next ? remodelRequirements(next) : null;
    if (next && need && world.day >= need.day && reputation(world) >= need.reputation
      && world.guestsServed >= need.served) {
      doIt(() => { world = remodel(world, ledger, next, tick); });
    }
  }
  return world;
}

interface RunResult {
  readonly rows: readonly DayRow[];
  readonly world: WorldState;
  readonly ledger: Ledger;
  /** Alle Abgaenge mit letzter Absicht: zeigt, warum Gaeste ohne Spiel gehen. */
  readonly departures: readonly Departure[];
}

export function runBalance(days: number, seed: number): RunResult {
  let world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  openHouse(ledger, 0);
  const prng = new Prng(seed);
  const seen = new Map<number, Track>();
  const rows: DayRow[] = [];
  const departures: Departure[] = [];
  let acc = emptyAcc();
  let previous = economyOf(ledger);

  for (let tick = 1; tick <= days * TICKS_PER_DAY; tick += 1) {
    world = operate(world, ledger, world.tick);
    tickWorld(world, ledger, prng);
    observe(world, acc, seen);
    if (world.tick % TICKS_PER_DAY !== 0) continue;
    const eco = economyOf(ledger);
    const delta = (key: keyof EconomySummary): number => Number(eco[key]) - Number(previous[key]);
    const day: EconomySummary = {
      ...eco,
      stakeVolume: delta('stakeVolume'),
      gamePayouts: delta('gamePayouts'),
      unpaidPayouts: delta('unpaidPayouts'),
      retainedGamingWin: delta('retainedGamingWin'),
      serviceRevenue: delta('serviceRevenue'),
      wages: delta('wages'),
      rent: delta('rent'),
      operatingRepairs: delta('operatingRepairs'),
      goods: delta('goods'),
      losses: delta('losses'),
      investment: delta('investment'),
      operatingProfit: delta('operatingProfit'),
    };
    rows.push(summarize(world, acc, ledger, day));
    departures.push(...acc.departures);
    previous = eco;
    acc = emptyAcc();
  }
  return { rows, world, ledger, departures };
}
