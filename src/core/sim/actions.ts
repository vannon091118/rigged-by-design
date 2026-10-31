/** Commands, die nicht im Tick passieren: Bewegung, Reinigung, Preise, Mods, fremde Spiele. */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playAction, type GameExtras, type GameResult } from '../games/contracts';
import { playSandboxGame, sandboxSeed, testSandbox } from '../games/sandbox';
import { isValidReels, MAX_REELS, slotConfig } from '../games/slot-config';
import type { Prng } from '../rng/prng';
import { closeFiat, exchangeFromVc, foreignBet, foreignWin, guestAccount, HAUSKONTO, payOrBorrow, payPending, PORTEMONNAIE, SHOP } from './money';
import { getMod } from './offers';
import type { CarpetId, Furniture, GameId, ModId, WorldState } from './types';
import { furnitureById } from './world';
import { grantXp } from './player-rpg';
import { slotChances } from '../games/slot-profile';

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
  if (!isValidReels(item.reels)) throw new Error('Die Walzenzahl dieser Maschine ist ungueltig.');
  if (item.reels >= MAX_REELS) throw new Error('Mehr Walzen passen nicht hinein.');
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
  // Dieselbe Konfiguration, die die Engine dreht, traegt auch die Quote.
  const config = slotConfig({ reels: item.reels, profile: raw });
  item.slotOdds = config.profile;
  const chances = slotChances(config.reels, config.profile);
  return `Regeln gesetzt: ${(chances.rtpBps / 100).toFixed(2)} % Quote bei ${config.reels} Walzen.`;
}

/**
 * Ein kostenloser Testspin laeuft in der Sandbox: eigener Seed, nur lesende
 * Welt, kein Ledger, kein Fortschritt, kein Welt-PRNG. Der Seed ist optional,
 * damit derselbe Sandbox-Seed dasselbe Ergebnis liefert.
 */
export function testSpin(
  item: Furniture,
  world: WorldState,
  seed: number = sandboxSeed(world, item),
): GameResult {
  return playSandboxGame(testSandbox(world, seed), item);
}

/**
 * Fremde Runde: erst vollstaendig pruefen und rechnen, dann buchen.
 *
 * Der Einsatz wird nicht mehr vor der Validierung abgebucht. Der PRNG laeuft
 * auf einem Schnappschuss; erst wenn die Runde steht, wird der Zustand
 * uebernommen und Einsatz plus Auszahlung werden gebucht. Ein Fehler in
 * Pruefung, Option oder Rechnung hinterlaesst weder Geld noch Zufall.
 */
export function foreignRound(
  ledger: Ledger,
  game: GameId,
  bet: VaCoinMicro,
  prng: Prng,
  tick: number,
  houseEdgeBps = 250,
  options: GameExtras = {},
): GameResult {
  if (!Number.isSafeInteger(bet) || bet < ZERO_VC) {
    throw new Error(`Einsatz ${String(bet)} ist keine gueltige Mikro-Summe`);
  }
  if (ledger.getBalance(PORTEMONNAIE) < bet) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  if (!Number.isSafeInteger(tick) || tick < 0) throw new Error(`Tick ${String(tick)} ist ungueltig`);
  const snapshot = prng.getState();
  let result: GameResult;
  try {
    result = playAction({ game, stake: bet, houseEdgeBps, ...options }, prng);
  } catch (error) {
    prng.setState(snapshot);
    throw error;
  }
  // Die Auszahlung kommt vom Haus-Konto und kann nicht an Deckung scheitern;
  // Betrag und Tick sind oben geprueft. Ein Fehler hier rollt den Zufall zurueck.
  try {
    foreignBet(ledger, bet, tick);
    if (result.payout > 0) foreignWin(ledger, result.payout, tick);
  } catch (error) {
    prng.setState(snapshot);
    throw error;
  }
  return result;
}
