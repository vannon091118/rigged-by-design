/** Spieler-Commands: Laufen, Tragen, Zapfen, Kasse, Deko, Ausbau. Mit Weg und Reichweite. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { deployCrate, depositCrate, takeCrate } from './deliveries';
import { chooseActivity } from './guest-choice';
import { exchangeFiat, guestAccount, HAUSKONTO, SHOP } from './money';
import { blockedTiles, findPath, nearestWalkable } from './pathfinding';
import type { Furniture, Point, WorldState } from './types';
import { exchangePoint, guestById, interactionPoint } from './world';
import { grantGlobalXp } from './player-rpg';

const XP_SERVE_GUEST = 8;
const XP_OPEN_CRATE = 15;

export function movePlayer(world: WorldState, target: Point): void {
  const walkable = nearestWalkable(world.size, blockedTiles(world.size, world.furniture), target);
  if (!walkable) return;
  world.player.path = findPath(world.size, blockedTiles(world.size, world.furniture), world.player.position, walkable);
  world.player.pathIndex = 0;
}

const near = (a: Point, b: Point, distance = 2): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= distance;

export function takeDrink(world: WorldState): void {
  if (world.player.carrying !== '') throw new Error('Deine Hände sind voll.');
  const bar = world.furniture.find((item) => item.kind === 'BAR' && item.stock > 0);
  const spot = bar ? interactionPoint(world, bar) : null;
  if (!spot || !near(world.player.position, spot)) throw new Error('Geh erst zu einer bestückten Bar.');
  bar!.stock -= 1;
  world.player.carrying = 'DRINK';
  world.lastEvent = 'Drink gezapft. Jetzt zum Gast bringen.';
}

export function serveDrink(world: WorldState, ledger: Ledger, guestId: number): void {
  if (world.player.carrying !== 'DRINK') throw new Error('Du hast keinen Drink dabei.');
  const guest = guestById(world, guestId);
  if (!guest) throw new Error('Gast nicht gefunden.');
  if (!near(world.player.position, guest.position, 3)) throw new Error('Geh erst zum Gast.');
  const price = world.prices.drinkPrice;
  if (ledger.getBalance(guestAccount(guest.id)) >= price) {
    ledger.transfer(guestAccount(guest.id), HAUSKONTO, price, `gast ${guest.id} drink`, world.tick);
  }
  guest.mood = Math.min(100, guest.mood + 13);
  guest.patience = Math.min(100, guest.patience + 12);
  guest.thirst = 0;
  // Nur wer schon gespielt hat, koppelt den Drink an den Kick; sonst wird niemand vom Zuschauen süchtig.
  if (guest.spins > 0) guest.addiction = Math.min(100, guest.addiction + 2);
  world.player.carrying = '';
  grantGlobalXp(world.player.rpg, 'SERVE_DRINK', XP_SERVE_GUEST);
  world.lastEvent = `${guest.name} hat einen Drink bekommen.`;
}

/** Kiste aufheben: nur mit leeren Händen und direkt daneben. */
export function pickupCrate(world: WorldState, crateId: number): void {
  if (world.player.carrying !== '') throw new Error('Deine Hände sind voll.');
  const crate = world.crates.find((entry) => entry.id === crateId);
  if (!crate) throw new Error('Die Kiste ist nicht da.');
  if (Math.abs(world.player.position.x - crate.x) + Math.abs(world.player.position.y - crate.y) > 2) {
    throw new Error('Geh erst zur Kiste.');
  }
  takeCrate(world, crateId, 'player');
  world.player.carrying = `KRATE:${crateId}`;
  grantGlobalXp(world.player.rpg, 'CLEAN_FLOOR', XP_OPEN_CRATE);
}

function heldCrateId(world: WorldState): number {
  const match = /^KRATE:(\d+)$/.exec(world.player.carrying);
  if (!match) throw new Error('Du trägst keine Kiste.');
  return Number(match[1]);
}

/** Getragene Möbelkiste am gewählten Feld aufstellen. */
export function deployHeldCrate(world: WorldState, x: number, y: number): Furniture {
  const id = heldCrateId(world);
  const item = deployCrate(world, id, x, y, 'player');
  world.player.carrying = '';
  return item;
}

/** Getragene Getränke- oder Ersatzteilkiste am Ziel einlagern. */
export function storeHeldCrate(world: WorldState, x: number, y: number, barId?: number): void {
  const id = heldCrateId(world);
  const done = depositCrate(world, id, x, y, barId);
  if (done.emptied) world.player.carrying = '';
}

export function setWallColor(world: WorldState, color: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Keine gültige Farbe.');
  world.wallColor = color;
}

export function setNeonColor(world: WorldState, color: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Keine gültige Farbe.');
  world.neonColor = color;
}

export function upgradeBar(world: WorldState, ledger: Ledger): void {
  if (world.barLevel >= 3) throw new Error('Die Bar ist ausgebaut.');
  ledger.transfer(HAUSKONTO, SHOP, world.prices.barUpgrade, 'bar ausbauen', world.tick);
  world.barLevel += 1;
  grantGlobalXp(world.player.rpg, 'REPAIR_MACHINE', 10);
  world.lastEvent = `Bar ausgebaut (Stufe ${world.barLevel}).`;
}

export function upgradeWc(world: WorldState, ledger: Ledger): void {
  if (world.wcLevel >= 3) throw new Error('Das WC ist ausgebaut.');
  ledger.transfer(HAUSKONTO, SHOP, world.prices.wcUpgrade, 'wc ausbauen', world.tick);
  world.wcLevel += 1;
  grantGlobalXp(world.player.rpg, 'REPAIR_MACHINE', 10);
  world.lastEvent = `WC ausgebaut (Stufe ${world.wcLevel}).`;
}

/** Der Spieler bedient die Kasse: ein Gast wird sofort gewechselt. */
export function serveDesk(world: WorldState, ledger: Ledger, prng: Prng): boolean {
  const point = exchangePoint(world);
  if (!point || !near(world.player.position, point, 4)) throw new Error('Geh erst zur Wechselkasse.');
  const guest = world.guests
    .filter((entry) => entry.state === 'EXCHANGE')
    .sort((a, b) => a.id - b.id)[0];
  if (!guest) return false;
  try {
    exchangeFiat(ledger, guest.id, world.tick);
  } catch {
    guest.patience = Math.max(0, guest.patience - 2);
    return false;
  }
  chooseActivity(world, guest, ledger, prng);
  grantGlobalXp(world.player.rpg, 'SERVE_DRINK', 5);
  return true;
}
