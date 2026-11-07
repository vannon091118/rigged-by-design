/**
 * Ein Regelsatz, zwei Ausfuehrungsmodi.
 *
 * Der Sandbox-Vertrag macht das Testspiel von Anfang an unfaehig, Welt, Ledger
 * oder Welt-PRNG zu veraendern: `TEST` bekommt eigenen, deterministischen Zufall
 * und nur eine lesende Sicht. Ein Zuruecksetzen nach dem Test waere der
 * Rueckwaertsgang mit Anhaenger; hier ist die verbotene Aenderung im Typ und im
 * Pfad ausgeschlossen.
 */
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import type { Furniture, WorldState } from '../sim/types';
import { playAction, type GameExtras, type GameResult } from './contracts';
import { playPlinkoTest } from './plinko-sandbox';
import { playSlotTest } from './slot-session';

export interface GameSandbox {
  readonly mode: 'TEST' | 'LIVE';
  /** Im Testmodus eigener Zufall, im Live-Modus der Welt-PRNG. */
  readonly prng: Prng;
  /** Nur lesende Sicht: der Sandbox fehlt jeder Schreibpfad in die Welt. */
  readonly world: Readonly<WorldState>;
}

/** Eigener Seed je Vorschau; ohne ihn ist ein Testlauf nicht reproduzierbar. */
export function testSandbox(world: WorldState, seed: number): GameSandbox {
  if (!Number.isSafeInteger(seed) || seed <= 0) {
    throw new Error(`Sandbox-Seed ${String(seed)} ist ungueltig`);
  }
  return { mode: 'TEST', prng: new Prng(seed), world };
}

/** Der Live-Modus teilt den Welt-PRNG; gebucht wird ausschliesslich im Store. */
export function liveSandbox(world: WorldState, prng: Prng): GameSandbox {
  return { mode: 'LIVE', prng, world };
}

/** Tick und Geraet ergeben einen reproduzierbaren Seed, ohne Weltzufall zu ziehen. */
export function sandboxSeed(world: WorldState, item: Furniture): number {
  return ((Math.imul(world.tick + 1, 0x9e3779b1) ^ Math.imul(item.id + 1, 0x85ebca6b)) >>> 0) || 1;
}

/**
 * Dieselbe Regelbasis in beiden Modi. `TEST` zahlt nie aus und liest die Welt
 * nur; `LIVE` bekommt den echten Einsatz, bucht aber ebenfalls nicht selbst --
 * Geld bleibt Sache des Stores.
 */
export function playSandboxGame(
  sandbox: GameSandbox,
  item: Furniture,
  extras: GameExtras = {},
  stake: VaCoinMicro = ZERO_VC,
): GameResult {
  const game = item.gameId ?? 'SLOT';
  if (sandbox.mode === 'TEST') {
    if (stake !== ZERO_VC) throw new Error('Ein Testspin hat keinen Einsatz.');
    if (game === 'SLOT') return playSlotTest(item, sandbox.prng);
    if (game === 'PLINKO') return playPlinkoTest(sandbox.world, sandbox.prng);
  }
  return playAction({ game, stake, ...extras }, sandbox.prng);
}
