/** Commands, die nicht im Tick passieren: Bewegung, Reinigung, Preise, Mods, fremde Spiele. */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playAction, type GameExtras, type GameResult } from '../games/contracts';
import { playPlinkoTest } from '../games/plinko-sandbox';
import { playSlotTest } from '../games/slot-session';
import { Prng } from '../rng/prng';
import { closeFiat, exchangeFromVc, foreignBet, foreignWin, guestAccount, HAUSKONTO, payOrBorrow, payPending, PORTEMONNAIE, SHOP } from './money';
import { getMod } from './offers';
import { blockedTiles, findPath, nearestWalkable } from './pathfinding';
import type { CarpetId, Furniture, GameId, ModId, Point, WorldState } from './types';
import { furnitureById } from './world';
import { grantXp } from './player-rpg';
import { normalizeSlotProfile, slotChances } from '../games/slot-profile';

const XP_CLEAN_TILE = 10;

/**
 * Vor einem Umbau: erst alle Anspruche buchen, dann die Gaeste entfernen.
 * Scheitert eine Buchung, bleibt die Welt unveraendert und der Fehler steigt auf.
 */
export function settleGuests(world: WorldState, ledger: Ledger): void {
  for (const guest of world.guests) {
    payPending(ledger, guest.id, world.tick);
    const balance = ledger.getBalance(guestAccount(guest.id));
    if (balance > ZERO_VC) exchangeFromVc(ledger, guest.id, balance, world.tick);
    closeFiat(ledger, guest.id, world.tick);
  }
  world.guests = [];
}

export function movePlayer(world: WorldState, target: Point): void {
  const walkable = nearestWalkable(world.size, blockedTiles(world.size, world.furniture), target);
  if (!walkable) return;
  world.player.path = findPath(world.size, blockedTiles(world.size, world.furniture), world.player.position, walkable);
  world.player.pathIndex = 0;
}

export function cleanTile(world: WorldState, ledger: Ledger, tile: number): void {
  if (!world.dirty.has(tile)) return;
  ledger.transfer(HAUSKONTO, SHOP, world.prices.cleaningCost, 'reinigung', world.tick);
  world.dirty.delete(tile);
  grantXp(world.player.rpg, XP_CLEAN_TILE);
}

export function cleanAll(world: WorldState, ledger: Ledger): number {
  const count = world.dirty.size;
  if (count === 0) return 0;
  ledger.transfer(HAUSKONTO, SHOP, (world.prices.cleaningCost * count) as VaCoinMicro, 'grossreinigung', world.tick);
  world.dirty.clear();
  grantXp(world.player.rpg, XP_CLEAN_TILE * count);
  return count;
}

/** Reparatur verbraucht ein Ersatzteil aus dem Lager; ohne Teile scheitert sie. */
export function repair(world: WorldState, ledger: Ledger, itemId: number): void {
  const item = furnitureById(world, itemId);
  if (!item || (item.condition >= 100 && !item.damaged && !item.clogged)) return;
  if (world.parts < 1) throw new Error('Keine Ersatzteile im Lager.');
  payOrBorrow(ledger, SHOP, world.prices.repairCost, 'reparatur', world.tick);
  world.parts -= 1;
  item.condition = 100;
  item.damaged = false;
  item.clogged = false;
  item.clog = 0;
}

export function setPrice(world: WorldState, key: 'drinkPrice' | 'slotMinBet', value: VaCoinMicro): void {
  if (value < 0) return;
  world.prices[key] = value;
}

export function setCarpet(world: WorldState, carpet: CarpetId): void {
  world.carpet = carpet;
}

export function installMod(world: WorldState, ledger: Ledger, itemId: number, modId: ModId): void {
  const item = furnitureById(world, itemId);
  if (!item || !item.gameId) throw new Error('Kein Spielautomat.');
  if (item.mods.includes(modId)) throw new Error('Mod ist schon verbaut.');
  if (item.mods.length >= 3) throw new Error('Maximal drei Mods pro Automat.');
  if (modId === 'EXTRA_REEL' && item.gameId !== 'SLOT') throw new Error('Die vierte Walze passt nur in Slots.');
  const mod = getMod(modId);
  ledger.transfer(HAUSKONTO, SHOP, mod.cost, `mod ${mod.name}`, world.tick);
  item.mods.push(modId);
}

export function upgradeReels(world: WorldState, ledger: Ledger, itemId: number): void {
  const item = furnitureById(world, itemId);
  if (!item || item.gameId !== 'SLOT') throw new Error('Nur Slots haben Walzen.');
  if (item.reels >= 5) throw new Error('Mehr Walzen passen nicht hinein.');
  ledger.transfer(HAUSKONTO, SHOP, fromVC(4 + item.reels * 2), 'walze erweitern', world.tick);
  item.reels += 1;
}

export function setBaseBet(world: WorldState, itemId: number, bet: VaCoinMicro): void {
  const item = furnitureById(world, itemId);
  if (!item || bet < ZERO_VC) return;
  item.baseBet = bet;
}

/**
 * Regel-Editor am Automaten: ab dem naechsten Spin gelten die eingestellten
 * Gewichte, das Auszahlungsprofil und die Regeln – dieselbe Engine liest sie.
 */
export function applySlotOdds(world: WorldState, itemId: number, raw: unknown): string {
  const item = furnitureById(world, itemId);
  if (!item || item.gameId !== 'SLOT') throw new Error('Nur Slots haben Spielregeln.');
  item.slotOdds = normalizeSlotProfile(raw);
  const chances = slotChances(item.reels, item.slotOdds);
  return `Regeln gesetzt: ${(chances.rtpBps / 100).toFixed(2)} % Quote bei ${item.reels} Walzen.`;
}

/**
 * Ein kostenloser Testspin veraendert weder Welt noch Gerätegedächtnis: fuer
 * jede Vorschau faellt ein eigener Seed aus Tick und Geraet an, und Plinko
 * zaehlt dabei weder seine Drops noch die Suchtskala hoch.
 */
export function testSpin(item: Furniture, prng: Prng, world?: WorldState): GameResult {
  if (!world) return playAction({ game: item.gameId ?? 'SLOT', stake: ZERO_VC }, prng);
  const seed = testSeed(world, item);
  if (item.gameId === 'PLINKO') return playPlinkoTest(world, seed);
  if (item.gameId === 'SLOT') return playSlotTest(item, seed);
  // Auch Tische drehen ihr eigenes Los: keine Vorschau zieht am Weltverlauf.
  return playAction({ game: item.gameId ?? 'SLOT', stake: ZERO_VC }, new Prng(seed));
}

/** Eigener Seed aus Tick und Gerät: der Welt-PRNG bleibt für den Testspin unberührt. */
function testSeed(world: WorldState, item: Furniture): number {
  return ((Math.imul(world.tick + 1, 0x9e3779b1) ^ Math.imul(item.id + 1, 0x85ebca6b)) >>> 0) || 1;
}

export function foreignRound(
  ledger: Ledger,
  game: GameId,
  bet: VaCoinMicro,
  prng: Prng,
  tick: number,
  houseEdgeBps = 250,
  options: GameExtras = {},
): GameResult {
  if (ledger.getBalance(PORTEMONNAIE) < bet) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  foreignBet(ledger, bet, tick);
  const result = playAction({ game, stake: bet, houseEdgeBps, ...options }, prng);
  if (result.payout > 0) foreignWin(ledger, result.payout, tick);
  return result;
}
