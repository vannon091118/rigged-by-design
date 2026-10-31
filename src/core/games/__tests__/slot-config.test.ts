/**
 * @test-target: src/core/games/slot-config.ts
 * @error-code: ERR-1003
 *
 * Die Maschinenkonfiguration ist die eine Quelle der Spielparameter: die
 * Engine dreht genau das, was darin steht, ungueltige Konfigurationen werden
 * abgelehnt und die Quote liest dieselbe Konfiguration wie die Engine.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { upgradeReels } from '../../sim/actions';
import { HAUSKONTO } from '../../sim/money';
import { createWorld } from '../../sim/templates';
import type { Furniture } from '../../sim/types';
import { playSlot } from '../engines/slot';
import { slotPaylines, SLOT_SYMBOLS } from '../engines/slot-paytable';
import { slotChances } from '../slot-profile';
import { assertSlotConfig, MAX_REELS, migrateReels, MIN_REELS, ROWS, slotConfig, slotConfigOf, type SlotConfig } from '../slot-config';
import { randomSeed } from '../../../test/random-seed';

const prng = (): Prng => new Prng(randomSeed() || 1);
const fresh = (): Furniture => {
  const world = createWorld('SMALL');
  return { ...world.furniture.find((item) => item.gameId === 'SLOT')!, slotOdds: undefined };
};
const machine = (reels: number): Furniture => ({ ...fresh(), reels });
const noSymbols = Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0]));

describe('Maschinenkonfiguration', () => {
  it('dreht einer Drei-Walzen-Maschine genau drei Walzen', () => {
    const config = slotConfigOf(machine(MIN_REELS));
    const outcome = playSlot(prng(), { config });

    expect(config.reels).toBe(MIN_REELS);
    expect(config.rows).toBe(ROWS);
    expect(config.paylines).toEqual(slotPaylines(MIN_REELS));
    expect(outcome.grid.length).toBe(MIN_REELS);
    for (const line of config.paylines) expect(line.length).toBe(MIN_REELS);
  });

  it('veraendert ein Upgrade auf fuenf die tatsaechliche Engine', () => {
    const world = createWorld('SMALL');
    const item = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    item.reels = MIN_REELS;
    const before = playSlot(prng(), { config: slotConfigOf(item) });

    upgradeReels(world, ledger, item.id);
    upgradeReels(world, ledger, item.id);
    const config = slotConfigOf(item);
    const after = playSlot(prng(), { config });

    expect(item.reels).toBe(MAX_REELS);
    expect(before.grid.length).toBe(MIN_REELS);
    expect(after.grid.length).toBe(MAX_REELS);
    expect(config.paylines.length).toBe(slotPaylines(MAX_REELS).length);
    expect(config.paylines.length).toBeGreaterThan(before.grid.length);
    expect(() => upgradeReels(world, ledger, item.id)).toThrow(/Mehr Walzen/);
  });

  it('lehnt ungueltige Konfigurationen ab', () => {
    expect(() => slotConfig({ reels: MIN_REELS - 1 })).toThrow(/Walzenzahl/);
    expect(() => slotConfig({ reels: MAX_REELS + 1 })).toThrow(/Walzenzahl/);
    expect(() => slotConfig({ reels: 4.5 })).toThrow(/Walzenzahl/);
    expect(() => slotConfig({ rows: 4 })).toThrow(/Reihen/);
    expect(() => slotConfig({ reels: 3, paylines: [] })).toThrow(/Gewinnlinien/);
    expect(() => slotConfig({ reels: 3, paylines: [[1, 1, 1, 1]] })).toThrow(/passt nicht/);
    expect(() => slotConfig({ reels: 3, paylines: [[3, 1, 1]] })).toThrow(/Gitter/);
    expect(() => slotConfigOf(machine(MAX_REELS + 4))).toThrow(/Walzenzahl/);

    const broken: SlotConfig = {
      reels: 3, rows: ROWS, paylines: [[1, 1, 1]], symbols: [],
      weights: noSymbols as SlotConfig['weights'], profile: slotConfig().profile,
    };
    expect(() => assertSlotConfig(broken)).toThrow(/Symbole/);
  });

  it('rechnet die Quote aus derselben Konfiguration, die die Engine dreht', () => {
    const item = machine(4);
    const config = slotConfigOf(item);
    const chances = slotChances(config.reels, config.profile);

    expect(chances.rtpBps).toBe(slotChances(item.reels, item.slotOdds).rtpBps);
    expect(chances.linesPerSpin).toBe(slotChances(config.reels, item.slotOdds).linesPerSpin);
    expect(playSlot(prng(), { config }).grid.length).toBe(config.reels);
    expect(slotConfig().reels).toBe(MAX_REELS);
  });

  it('begrenzt alte Walzenzahlen beim Lesen statt sie verwerfen zu lassen', () => {
    expect(migrateReels(MAX_REELS + 4)).toBe(MAX_REELS);
    expect(migrateReels(0)).toBe(MIN_REELS);
    expect(migrateReels(4.6)).toBe(MAX_REELS);
    expect(migrateReels('x')).toBe(MIN_REELS);
    expect(migrateReels(undefined)).toBe(MIN_REELS);
  });
});
