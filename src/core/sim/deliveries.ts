/** Lieferkette: Käufe kommen als Kiste am Eingang an und werden körperlich verteilt. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import { clamp } from './guest-core';
import { recordJournal } from './journal';
import { HAUSKONTO, SHOP } from './money';
import { getBuildDef, type BuildId } from './offers';
import { assertUnlocked } from './progression';
import type { Crate, CratePayload, Furniture, Guest, WorldState } from './types';
import { canPlace, furnitureById } from './world';

export const barCapacityForLevel = (level: number): number => 6 + 6 * Math.max(1, level);
const barCapacity = (world: WorldState): number => barCapacityForLevel(world.barLevel);

function tileBlocked(world: WorldState, x: number, y: number): boolean {
  return world.furniture.some((item) => x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
}

/** Erste freie Kachel in der Eingangszone, sonst irgendwo auf dem Floor. */
function freeCrateTile(world: WorldState): { x: number; y: number } | null {
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0];
  if (entrance) {
    for (let y = entrance.y; y < entrance.y + entrance.h; y += 1) {
      for (let x = entrance.x; x < entrance.x + entrance.w; x += 1) {
        if (!tileBlocked(world, x, y)) return { x, y };
      }
    }
  }
  for (let y = 1; y < world.size; y += 1) {
    for (let x = 1; x < world.size; x += 1) {
      if (!tileBlocked(world, x, y)) return { x, y };
    }
  }
  return null;
}

function orderCrate(world: WorldState, ledger: Ledger, payload: CratePayload, cost: VaCoinMicro, reason: string): Crate {
  const tile = freeCrateTile(world);
  if (!tile) throw new Error('Kein Platz für Lieferungen am Eingang.');
  ledger.transfer(HAUSKONTO, SHOP, cost, reason, world.tick);
  const crate: Crate = { id: world.nextCrateId++, payload, x: tile.x, y: tile.y, carriedBy: null };
  world.crates.push(crate);
  world.lastEvent = 'Lieferung am Eingang. Abholen und verteilen.';
  recordJournal(world, {
    kind: 'STOCK', subject: payload.kind, cause: `Bestellung (${reason})`, effect: world.lastEvent,
    refs: { crateId: crate.id },
  });
  return crate;
}

/** Ein Möbelkauf landet als Kiste im Eingang statt auf dem Floor. */
export function buyCrate(world: WorldState, ledger: Ledger, buildId: BuildId): Crate {
  assertUnlocked(world, ledger, buildId);
  const def = getBuildDef(buildId);
  return orderCrate(world, ledger, { kind: 'FURNITURE', buildId }, def.cost, `kauf ${def.name}`);
}

export function orderDrinks(world: WorldState, ledger: Ledger, count: number): Crate {
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('1 bis 12 Getränke pro Kiste.');
  return orderCrate(world, ledger, { kind: 'DRINKS', count },
    (world.prices.drinkCrateCost * count) as VaCoinMicro, 'getraenkekiste');
}

export function orderParts(world: WorldState, ledger: Ledger, count: number): Crate {
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('1 bis 12 Ersatzteile pro Kiste.');
  return orderCrate(world, ledger, { kind: 'PARTS', count },
    (world.prices.partCost * count) as VaCoinMicro, 'ersatzteile');
}

/** Aufnehmen markiert die Kiste als getragen; sie liegt nicht mehr herum. */
export function takeCrate(world: WorldState, id: number, by: number | 'player' = 'player'): Crate {
  const crate = world.crates.find((entry) => entry.id === id);
  if (!crate || crate.carriedBy !== null) throw new Error('Die Kiste ist nicht da.');
  crate.carriedBy = by;
  return crate;
}

/** Platzieren ohne erneute Kasse: bezahlt wurde beim Kauf. */
function placeFurniture(world: WorldState, buildId: BuildId, x: number, y: number): Furniture {
  const def = getBuildDef(buildId);
  if (!canPlace(world, x, y, def.w, def.h, def.seats > 0)) throw new Error('Da ist kein Platz.');
  const zone = world.zones.find((entry) =>
    x >= entry.x && y >= entry.y && x < entry.x + entry.w && y < entry.y + entry.h);
  const item: Furniture = {
    id: world.nextFurnitureId++, kind: def.kind, gameId: def.gameId, x, y, w: def.w, h: def.h,
    seats: def.seats, label: def.name, price: def.cost, quality: def.quality, condition: 100, damaged: false,
    dirt: 0, stock: 0, clog: 0, clogged: false, zoneId: zone?.id ?? 'gaming', occupants: [], mods: [],
    reels: def.reels, baseBet: def.baseBet,
  };
  world.furniture.push(item);
  return item;
}

/** Eine getragene Möbelkiste wird am gewählten Feld aufgestellt. */
export function deployCrate(world: WorldState, id: number, x: number, y: number, by: number | 'player' = 'player'): Furniture {
  const crate = world.crates.find((entry) => entry.id === id);
  if (!crate || crate.carriedBy !== by) throw new Error('Die Kiste wird nicht getragen.');
  if (crate.payload.kind !== 'FURNITURE') throw new Error('Das gehört nicht auf den Floor.');
  const item = placeFurniture(world, crate.payload.buildId, x, y);
  world.crates = world.crates.filter((entry) => entry.id !== id);
  world.lastEvent = `${item.label} aufgestellt.`;
  recordJournal(world, {
    kind: 'STOCK', subject: item.label, cause: 'Möbelkiste aufgestellt', effect: world.lastEvent,
    refs: { furnitureId: item.id },
  });
  return item;
}

function near(ax: number, ay: number, bx: number, by: number, range: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) <= range;
}

function inZone(world: WorldState, zoneId: string, x: number, y: number): boolean {
  const zone = world.zones.find((entry) => entry.id === zoneId);
  return zone !== undefined && x >= zone.x && y >= zone.y && x < zone.x + zone.w && y < zone.y + zone.h;
}

/**
 * Getränke füllen die Bar, Ersatzteile das Lager. Überlauf bleibt in der Kiste.
 * Gibt zurück, was eingelagert wurde, und ob die Kiste leer ist.
 */
export function depositCrate(world: WorldState, id: number, x: number, y: number, barId?: number): { stored: number; emptied: boolean } {
  const crate = world.crates.find((entry) => entry.id === id);
  if (!crate || crate.carriedBy === null) throw new Error('Die Kiste wird nicht getragen.');
  if (crate.payload.kind === 'FURNITURE') throw new Error('Möbel werden aufgestellt, nicht eingelagert.');
  if (crate.payload.kind === 'DRINKS') {
    const bar = barId !== undefined ? furnitureById(world, barId) : null;
    if (!bar || bar.kind !== 'BAR' || !near(x, y, bar.x, bar.y, 3)) {
      throw new Error('Getränke gehören an die Bar.');
    }
    const free = Math.max(0, barCapacity(world) - bar.stock);
    const stored = Math.min(free, crate.payload.count);
    if (stored === 0) throw new Error('Die Bar ist voll.');
    bar.stock += stored;
    crate.payload = { kind: 'DRINKS', count: crate.payload.count - stored };
    world.lastEvent = `Bar aufgefüllt (${bar.stock} Getränke).`;
    recordJournal(world, {
      kind: 'STOCK', subject: 'Getränke', cause: 'Kiste an der Bar abgeladen', effect: world.lastEvent,
      refs: { furnitureId: bar.id, crateId: id },
    });
    if (crate.payload.count <= 0) world.crates = world.crates.filter((entry) => entry.id !== id);
    return { stored, emptied: crate.payload.count <= 0 };
  }
  if (!inZone(world, 'storage', x, y)) throw new Error('Ersatzteile gehören ins Lager.');
  world.parts += crate.payload.count;
  world.crates = world.crates.filter((entry) => entry.id !== id);
  world.lastEvent = `Ersatzteile eingelagert (${world.parts}).`;
  recordJournal(world, {
    kind: 'STOCK', subject: 'Ersatzteile', cause: 'Kiste im Lager abgeladen', effect: world.lastEvent,
    refs: { crateId: id },
  });
  return { stored: crate.payload.count, emptied: true };
}

/** Ein Drink an der Bar: Bestand runter, Durst weg, Laune rauf. Leerlauf verdirbt die Laune. */
export function deliverDrink(world: WorldState, ledger: Ledger, guest: Guest, bar: Furniture): boolean {
  if (bar.stock <= 0) {
    guest.mood = Math.max(0, guest.mood - 6);
    guest.need = 'drink';
    world.lastEvent = 'Die Bar ist leer.';
    return false;
  }
  try {
    ledger.transfer(`VISITOR_${guest.id}`, HAUSKONTO, world.prices.drinkPrice, 'getraenk', world.tick);
  } catch { return false; }
  bar.stock -= 1;
  guest.thirst = 0;
  guest.mood = clamp(guest.mood + 10 + 2 * (world.barLevel - 1));
  guest.patience = clamp(guest.patience + 9);
  const barkeeper = world.agents.some((agent) =>
    agent.role === 'bartender' && near(agent.x, agent.y, bar.x, bar.y, 4));
  if (barkeeper) guest.patience = clamp(guest.patience + 4);
  return true;
}

/** Ein Toilettengang: Blase leer, Laune rauf, Abfluss voller. Volle Kabinen verstopfen. */
export function useToilet(world: WorldState, guest: Guest, wc: Furniture): boolean {
  if (wc.clogged) {
    guest.mood = Math.max(0, guest.mood - 6);
    guest.need = 'toilet';
    world.lastEvent = 'Das WC ist verstopft.';
    return false;
  }
  guest.bladder = 0;
  guest.mood = clamp(guest.mood + 7);
  guest.patience = clamp(guest.patience + 14);
  wc.clog += 1;
  if (wc.clog >= 3 + 2 * world.wcLevel) {
    wc.clogged = true;
    world.lastEvent = 'Ein WC ist verstopft.';
  }
  return true;
}
