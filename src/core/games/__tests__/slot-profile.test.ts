/**
 * @test-target: src/core/games/slot-profile.ts
 * @error-code: ERR-1003
 *
 * Der Betreiber stellt Streifen, Gewichte, Bewertungsmodell, Volatilität und
 * Bonus-Paytable ein. Die Zahlen, die er dabei sieht, muessen aus derselben
 * Engine kommen, die den Spin auswertet.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { playSlot } from '../engines/slot';
import { evaluateCluster, evaluateLines, evaluateWays, payBps } from '../engines/slot-models';
import { slotPaylines, WEIGHTS, type SlotSymbol } from '../engines/slot-paytable';
import {
  DEFAULT_SLOT_PROFILE, normalizeSlotProfile, sameSlotProfile, slotChances,
} from '../slot-profile';
import { stripsFromWeights } from '../engines/slot-strips';

const noBonus = { scatter: false, freeSpins: 0 };

describe('Regel-Editor des Automaten', () => {
  it('weist fuer das Standardprofil eine plausible Quote und Bonus-Ferne aus', () => {
    const chances = slotChances(5, DEFAULT_SLOT_PROFILE);
    expect(chances.rtpBps).toBeGreaterThan(8_400);
    expect(chances.rtpBps).toBeLessThan(10_200);
    expect(chances.lineHitBps).toBeGreaterThan(0);
    expect(chances.bonusEvery).toBeGreaterThan(20);
    expect(chances.freeRounds).toBeGreaterThan(0);
    expect(chances.freeRounds).toBeLessThan(0.1);
    expect(chances.perSymbolBps.BOOK).toBeLessThan(chances.perSymbolBps.J);
  });

  it('macht mehr Buecher zu haeufigeren Bonusrunden und hoeherer Quote', () => {
    const base = slotChances(5, DEFAULT_SLOT_PROFILE);
    const richer = slotChances(5, { ...DEFAULT_SLOT_PROFILE, weights: { ...DEFAULT_SLOT_PROFILE.weights, BOOK: 6 } });
    expect(richer.bonusEvery).toBeLessThan(base.bonusEvery);
    expect(richer.rtpBps).toBeGreaterThan(base.rtpBps);
  });

  it('senkt die Quote, wenn Bonus und Wild abgeschaltet werden', () => {
    const base = slotChances(5, DEFAULT_SLOT_PROFILE);
    const plain = slotChances(5, { ...DEFAULT_SLOT_PROFILE, ...noBonus });
    const strict = slotChances(5, { ...DEFAULT_SLOT_PROFILE, ...noBonus, wildMode: 'NONE' });
    expect(plain.bonusEvery).toBe(0);
    expect(plain.freeRounds).toBe(0);
    expect(plain.rtpBps).toBeLessThan(base.rtpBps);
    expect(strict.rtpBps).toBeLessThanOrEqual(plain.rtpBps);
  });

  it('normalisiert fremde und alte Werte statt NaN zu tragen', () => {
    const broken = normalizeSlotProfile({ weights: { BOOK: -5, J: 900, SCARAB: 'x' }, payScaleBps: 99_999, rules: { freeSpins: false } });
    expect(broken.weights.BOOK).toBe(0);
    expect(broken.weights.J).toBe(99);
    expect(broken.weights.SCARAB).toBe(DEFAULT_SLOT_PROFILE.weights.SCARAB);
    expect(broken.payScaleBps).toBe(12_000);
    expect(broken.scatter).toBe(false);
    expect(normalizeSlotProfile(undefined)).toEqual(DEFAULT_SLOT_PROFILE);
    expect(normalizeSlotProfile({ rules: { wildBooks: false } }).wildMode).toBe('NONE');
    expect(sameSlotProfile(DEFAULT_SLOT_PROFILE, normalizeSlotProfile(DEFAULT_SLOT_PROFILE))).toBe(true);
    expect(sameSlotProfile(DEFAULT_SLOT_PROFILE, broken)).toBe(false);
  });

  it('bewertet dasselbe Gitter in jedem Modell anders', () => {
    const full: SlotSymbol[][] = [['J', 'J', 'J'], ['J', 'J', 'J'], ['J', 'J', 'J']];
    const ctx = { reels: 3, rows: 3, weights: WEIGHTS, wild: true, scale: 1, volatility: 'MID' as const };
    const lines = evaluateLines(full, slotPaylines(3), ctx).total;
    const ways = evaluateWays(full, ctx).total;
    const cluster = evaluateCluster(full, ctx).total;
    expect(lines).toBe(payBps('J', 3, 1, 'MID') * 3);
    expect(ways).toBe(payBps('J', 3, 1, 'MID') * 27);
    expect(cluster).toBe(100_000);
    expect(new Set([lines, ways, cluster]).size).toBe(3);
  });

  it('zieht aus den Streifen, wenn welche gesetzt sind', () => {
    const strips = stripsFromWeights({ ...WEIGHTS, J: 99, BOOK: 1 }, 3);
    expect(strips).toHaveLength(3);
    expect(strips[0]!.length).toBeGreaterThan(30);
    const profile = normalizeSlotProfile({ ...DEFAULT_SLOT_PROFILE, reelStrips: [['J'], ['J'], ['J']] });
    const prng = new Prng(randomSeed());
    for (let spin = 0; spin < 50; spin += 1) {
      expect(playSlot(prng, { reels: 3, profile }).grid.flat().every((symbol) => symbol === 'J')).toBe(true);
    }
  });

  it('zieht genau nach den eingestellten Gewichten', () => {
    const profile = normalizeSlotProfile({
      weights: { BOOK: 0, SCARAB: 0, ANKH: 0, EYE: 0, URN: 0, A: 0, K: 1, Q: 1, J: 0 },
      ...noBonus, wildMode: 'NONE',
    });
    const prng = new Prng(randomSeed());
    for (let spin = 0; spin < 200; spin += 1) {
      const outcome = playSlot(prng, { reels: 3, profile });
      expect(outcome.grid.flat().every((symbol) => symbol === 'K' || symbol === 'Q')).toBe(true);
      expect(outcome.jackpot).toBe(false);
    }
  });

  it('weist genau die Quote aus, die die Engine bei diesem Profil zahlt', () => {
    // Kalibrier-Sonde: nur ein Symbol, damit der Spin deterministisch ist. Was die
    // Engine dann zahlt, muss exakt die Zahl sein, die der Editor anzeigt.
    const profile = normalizeSlotProfile({
      weights: { BOOK: 0, SCARAB: 0, ANKH: 0, EYE: 0, URN: 0, A: 0, K: 0, Q: 0, J: 1 },
      ...noBonus,
    });
    const predicted = slotChances(3, profile).rtpBps;
    const prng = new Prng(randomSeed());
    for (let spin = 0; spin < 50; spin += 1) {
      expect(playSlot(prng, { reels: 3, profile }).multiplierBps).toBe(predicted);
    }
  });

  it('laesst Volatilitaet und Bonus-Paytable wirken', () => {
    const flat = slotChances(5, { ...DEFAULT_SLOT_PROFILE, volatility: 'LOW' });
    const steep = slotChances(5, { ...DEFAULT_SLOT_PROFILE, volatility: 'HIGH' });
    expect(payBps('BOOK', 5, 1, 'HIGH')).toBeGreaterThan(payBps('BOOK', 5, 1, 'LOW'));
    expect(payBps('J', 3, 1, 'LOW')).toBeGreaterThan(payBps('J', 3, 1, 'HIGH'));
    // Volatilitaet formt die Streuung, nicht die Quote: die Normalisierung haelt sie stabil.
    expect(Math.abs(flat.rtpBps - steep.rtpBps)).toBeLessThan(200);
    const richer = slotChances(5, { ...DEFAULT_SLOT_PROFILE, bonusPayScaleBps: 18_000, multiplier: 3 });
    expect(richer.rtpBps).toBeGreaterThan(slotChances(5, DEFAULT_SLOT_PROFILE).rtpBps);
  });
});
