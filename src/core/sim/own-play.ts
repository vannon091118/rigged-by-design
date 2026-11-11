/**
 * Eigene Spielrunde: Der Betreiber sitzt als Gast an seinem Geraet.
 *
 * Einsatz und Auszahlung laufen ausschliesslich ueber die beiden getrennten
 * Ledger-Konten PORTEMONNAIE und HAUSKONTO. Ein nicht gedeckter Gewinn wird
 * als Verbindlichkeit auf HAUS_SCHULDEN gebucht, nie gekappt. Die Engine-
 * Auswahl bleibt dieselbe wie bei fremden Tischen; nur der Geldweg ist ein
 * anderer.
 */
import type { Ledger } from '../economy/ledger';
import { addVC, fromVC, mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playAction, type GameExtras, type GameResult } from '../games/contracts';
import { drawRiskCard, type RiskColor, type RiskOutcome } from '../games/risk-card';
import { playSlotSession } from '../games/slot-session';
import { slotConfigOf } from '../games/slot-config';
import { assertFairOwnSlotProfile } from '../games/slot-profile';
import type { Prng } from '../rng/prng';
import { assertGameplayRng } from '../rng/streams';
import { DEBT_ACCOUNT, HAUSKONTO, PORTEMONNAIE } from './money';
import { resolveModEffects } from './offers';
import { TX_REASON } from './tx-reasons';
import { emitSlotDischarge } from './narrative/facts';
import type { Furniture, GameId, WorldState } from './types';
import { furnitureById } from './world';

const CARD_GAMES: ReadonlySet<string> = new Set(['BLACKJACK', 'POKER', 'VIDEO_POKER']);

export const isOwnCardGame = (game: string | undefined): boolean => game !== undefined && CARD_GAMES.has(game);

/** Der effektive Mindesteinsatz: Gerät und globaler Boden, nie der kleinere Wert. */
export function ownMinBet(world: Pick<WorldState, 'prices'>, item: Furniture): VaCoinMicro {
  return (item.baseBet > world.prices.slotMinBet ? item.baseBet : world.prices.slotMinBet) as VaCoinMicro;
}

/** Ein eigener Einsatz darf hoechstens das Zehnfache des effektiven Mindesteinsatzes sein. */
export const MAX_OWN_BET_MULTIPLE = 10;

/**
 * Obergrenze in Micro-VC, auf ganze Cent aufgerundet. Die UI rechnet ihre
 * Bet-Stufen ebenfalls in Cent; so scheitert die hoechste Stufe nicht an
 * einer Rundungsdifferenz.
 */
export function ownMaxBet(world: Pick<WorldState, 'prices'>, item: Furniture): VaCoinMicro {
  const maxMicro = ownMinBet(world, item) * MAX_OWN_BET_MULTIPLE;
  return (Math.ceil(maxMicro / 100) * 100) as VaCoinMicro;
}

function assertOwnBetLimit(world: Pick<WorldState, 'prices'>, item: Furniture, stake: VaCoinMicro): void {
  const max = ownMaxBet(world, item);
  if (stake > max) throw new Error(`Einsatz über der Obergrenze an ${item.label}: maximal ${(max / 10_000).toFixed(2)} VC.`);
}

export function ownBet(ledger: Ledger, amount: VaCoinMicro, tick: number, reason: string = TX_REASON.OWN_STAKE, game: string | null = null): void {
  if (!Number.isSafeInteger(amount) || amount <= ZERO_VC) throw new Error('Kein gültiger Einsatz.');
  ledger.transfer(PORTEMONNAIE, HAUSKONTO, amount, reason, tick, game);
}

/** Volle Auszahlung: erst das Hauskonto, der Rest als gebuchte Verbindlichkeit. */
export function ownWin(ledger: Ledger, amount: VaCoinMicro, tick: number, game: string | null = null): void {
  if (!Number.isSafeInteger(amount) || amount < ZERO_VC) throw new Error('Kein gültiger Gewinn.');
  if (amount === ZERO_VC) return;
  const house = ledger.getBalance(HAUSKONTO);
  const covered = Math.min(amount, Math.max(0, house)) as VaCoinMicro;
  if (covered > ZERO_VC) ledger.transfer(HAUSKONTO, PORTEMONNAIE, covered, TX_REASON.OWN_WIN, tick, game);
  const debt = (amount - covered) as VaCoinMicro;
  if (debt <= ZERO_VC) return;
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, PORTEMONNAIE, debt, `${TX_REASON.OWN_WIN} auf kredit`, tick, game);
}

type GameFurniture = Furniture & { readonly gameId: GameId };

function itemForGame(world: WorldState, itemId: number): GameFurniture {
  const item = furnitureById(world, itemId);
  if (!item?.gameId) throw new Error('Dieses Gerät hat kein Spiel.');
  if (item.damaged) throw new Error('Das Gerät ist defekt. Erst reparieren.');
  return item as GameFurniture;
}

function stakeFor(world: WorldState, ledger: Ledger, item: Furniture, betVC: number): VaCoinMicro {
  const stake = fromVC(betVC);
  if (!Number.isSafeInteger(stake) || stake <= ZERO_VC) throw new Error('Kein gültiger Einsatz.');
  const min = ownMinBet(world, item);
  if (stake < min) throw new Error(`Mindesteinsatz an ${item.label}: ${min / 10_000} VC.`);
  assertOwnBetLimit(world, item, stake);
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  return stake;
}

export function playOwnRound(
  world: WorldState,
  ledger: Ledger,
  itemId: number,
  betVC: number,
  prng: Prng,
  options: GameExtras = {},
): GameResult {
  assertGameplayRng(prng);
  const item = itemForGame(world, itemId);
  if (item.gameId === 'SLOT') assertFairOwnSlotProfile(slotConfigOf(item).profile);
  const stake = stakeFor(world, ledger, item, betVC);
  const bonusBps = resolveModEffects(item.gameId, item.mods).bonusBps;
  const snapshot = prng.getState();
  let result: GameResult;
  try {
    result = item.gameId === 'SLOT'
      ? playSlotSession(item, prng, stake, bonusBps)
      : playAction({ game: item.gameId, stake, bonusBps, ...options }, prng);
  } catch (error) {
    prng.setState(snapshot);
    throw error;
  }
  if (!Number.isSafeInteger(result.payout) || result.payout < ZERO_VC) {
    prng.setState(snapshot);
    throw new Error('Die Engine lieferte keinen gültigen Gewinn.');
  }
  try {
    ownBet(ledger, stake, world.tick, TX_REASON.OWN_STAKE, item.gameId);
    if (result.payout > ZERO_VC) ownWin(ledger, result.payout, world.tick, item.gameId);
    if (result.discharged) emitSlotDischarge(world, 'player', item.id, stake, result.payout);
  } catch (error) {
    prng.setState(snapshot);
    throw error;
  }
  return result;
}

/** Kartenstart: Einsatz buchen, Seed liefern; die Auszahlung folgt am Rundenende. */
export function ownCardDeal(
  world: WorldState, ledger: Ledger, itemId: number, betVC: number, prng: Prng,
): { readonly seed: number; readonly label: string } {
  const item = itemForGame(world, itemId);
  if (!isOwnCardGame(item.gameId)) throw new Error('An diesem Gerät gibt es keine Kartenrunde.');
  const stake = stakeFor(world, ledger, item, betVC);
  const seed = prng.nextInt(1, 2_147_483_646);
  ownBet(ledger, stake, world.tick, TX_REASON.OWN_STAKE, item.gameId);
  return { seed, label: item.label };
}

/** Kartenende: Auszahlung genau einmal; die Runde wird vom Store verwaltet. */
export function ownCardSettle(
  world: WorldState, ledger: Ledger, itemId: number, stakeVC: number, engineBps: number, label: string,
): GameResult {
  const item = itemForGame(world, itemId);
  if (!isOwnCardGame(item.gameId)) throw new Error('An diesem Gerät gibt es keine Kartenrunde.');
  if (!Number.isSafeInteger(engineBps) || engineBps < 0) throw new Error(`Ungültige Quote ${String(engineBps)}.`);
  const stake = fromVC(stakeVC);
  if (!Number.isSafeInteger(stake) || stake <= ZERO_VC) throw new Error('Kein gültiger Einsatz.');
  const payout = mulVC(stake, engineBps);
  if (!Number.isSafeInteger(payout) || payout < ZERO_VC) throw new Error('Ungültige Karten-Auszahlung.');
  if (payout > ZERO_VC) ownWin(ledger, payout, world.tick, item.gameId);
  return { game: item.gameId, stake, payout, multiplierBps: engineBps, label, detail: [label] };
}

/** Double, Split, Versicherung: derselbe getrennte Geldweg, kein zweiter Einsatz. */
export function ownAdditionalBet(world: WorldState, ledger: Ledger, itemId: number, betVC: number): void {
  const item = itemForGame(world, itemId);
  if (!isOwnCardGame(item.gameId)) throw new Error('Nur Kartenrunden kennen einen Zusatz-Einsatz.');
  const stake = fromVC(betVC);
  if (!Number.isSafeInteger(stake) || stake <= ZERO_VC) throw new Error('Kein gültiger Zusatz-Einsatz.');
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld für den Zusatz-Einsatz.');
  ownBet(ledger, stake, world.tick, TX_REASON.OWN_STAKE, item.gameId);
}

/** Risiko-Karte nach einem Slot-Gewinn: gewinnt aus dem Haus, verliert in das Haus. */
export function ownRisk(
  world: WorldState, ledger: Ledger, itemId: number, stakeVC: number, choice: RiskColor, prng: Prng,
): RiskOutcome {
  assertGameplayRng(prng);
  const item = itemForGame(world, itemId);
  if (item.gameId !== 'SLOT') throw new Error('Die Risiko-Karte gibt es nur am Slot.');
  const stake = fromVC(stakeVC);
  if (!Number.isSafeInteger(stake) || stake <= ZERO_VC) throw new Error('Kein Gewinn zum Riskieren.');
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Der Gewinn liegt nicht mehr im Portemonnaie.');
  const snapshot = prng.getState();
  const card = drawRiskCard(prng);
  const won = card === choice;
  try {
    if (won) ownWin(ledger, stake, world.tick, 'SLOT');
    else ownBet(ledger, stake, world.tick, TX_REASON.OWN_RISK_LOST, 'SLOT');
  } catch (error) {
    prng.setState(snapshot);
    throw error;
  }
  return { card, choice, won, stake, payout: won ? addVC(stake, stake) : ZERO_VC };
}
