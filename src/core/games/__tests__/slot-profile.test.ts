/**
 * @test-target: src/core/games/slot-profile.ts
 * @error-code: ERR-1003
 *
 * Der Betreiber stellt Gewichte, Auszahlungsprofil und Regeln ein. Die Zahlen,
 * die er dabei sieht, muessen aus derselben Engine kommen, die den Spin auswertet.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { playSlot } from '../engines/slot';
import {
  DEFAULT_SLOT_PROFILE, normalizeSlotProfile, sameSlotProfile, slotChances,
} from '../slot-profile';

const noFree = { freeSpins: false, wildBooks: true };

describe('Regel-Editor des Automaten', () => {
  it('weist fuer das Standardprofil eine plausible Quote und Jackpot-Ferne aus', () => {
    const chances = slotChances(5, DEFAULT_SLOT_PROFILE);
    expect(chances.rtpBps).toBeGreaterThan(8_800);
    expect(chances.rtpBps).toBeLessThan(9_600);
    expect(chances.lineHitBps).toBeGreaterThan(0);
    expect(chances.jackpotSpins).toBeGreaterThan(200);
    // Freizuege je Spin, nicht je Ausloesung: sonst zaehlt die Quote sie zehnmal.
    expect(chances.freeRounds).toBeGreaterThan(0);
    expect(chances.freeRounds).toBeLessThan(0.1);
    expect(chances.perSymbolBps.BOOK).toBeLessThan(chances.perSymbolBps.J);
  });

  it('macht mehr Buecher zu haeufigeren Jackpots und hoeherer Quote', () => {
    const base = slotChances(5, DEFAULT_SLOT_PROFILE);
    const richer = slotChances(5, { ...DEFAULT_SLOT_PROFILE, weights: { ...DEFAULT_SLOT_PROFILE.weights, BOOK: 6 } });
    expect(richer.jackpotSpins).toBeLessThan(base.jackpotSpins);
    expect(richer.rtpBps).toBeGreaterThan(base.rtpBps);
    expect(richer.perSymbolBps.BOOK).toBeGreaterThan(base.perSymbolBps.BOOK);
  });

  it('senkt die Quote, wenn Freispiele und Wild abgeschaltet werden', () => {
    const base = slotChances(5, DEFAULT_SLOT_PROFILE);
    const plain = slotChances(5, { ...DEFAULT_SLOT_PROFILE, rules: noFree });
    const strict = slotChances(5, { ...DEFAULT_SLOT_PROFILE, rules: { freeSpins: false, wildBooks: false } });
    expect(plain.freeRounds).toBe(0);
    expect(plain.jackpotSpins).toBe(0);
    expect(plain.rtpBps).toBeLessThan(base.rtpBps);
    expect(strict.rtpBps).toBeLessThanOrEqual(plain.rtpBps);
  });

  it('normalisiert fremde und alte Werte statt NaN zu tragen', () => {
    const broken = normalizeSlotProfile({ weights: { BOOK: -5, J: 900, SCARAB: 'x' }, payScaleBps: 99_999, rules: { freeSpins: 0 } });
    expect(broken.weights.BOOK).toBe(0);
    expect(broken.weights.J).toBe(99);
    expect(broken.weights.SCARAB).toBe(DEFAULT_SLOT_PROFILE.weights.SCARAB);
    expect(broken.payScaleBps).toBe(12_000);
    expect(broken.rules.freeSpins).toBe(true);
    expect(normalizeSlotProfile(undefined)).toEqual(DEFAULT_SLOT_PROFILE);
    expect(sameSlotProfile(DEFAULT_SLOT_PROFILE, normalizeSlotProfile(DEFAULT_SLOT_PROFILE))).toBe(true);
    expect(sameSlotProfile(DEFAULT_SLOT_PROFILE, broken)).toBe(false);
  });

  it('zieht genau nach den eingestellten Gewichten', () => {
    const profile = normalizeSlotProfile({
      weights: { BOOK: 0, SCARAB: 0, ANKH: 0, EYE: 0, URN: 0, A: 0, K: 1, Q: 1, J: 0 },
      payScaleBps: 10_000, rules: noFree,
    });
    const prng = new Prng(randomSeed());
    for (let spin = 0; spin < 200; spin += 1) {
      const outcome = playSlot(prng, { reels: 3, profile });
      expect(outcome.grid.flat().every((symbol) => symbol === 'K' || symbol === 'Q')).toBe(true);
      expect(outcome.jackpot).toBe(false);
      expect(outcome.detail.length).toBe(1);
    }
  });

  it('weist genau die Quote aus, die die Engine bei diesem Profil zahlt', () => {
    // Kalibrier-Sonde: nur ein Symbol, damit der Spin deterministisch ist. Was die
    // Engine dann zahlt, muss exakt die Zahl sein, die der Editor anzeigt.
    const profile = normalizeSlotProfile({
      weights: { BOOK: 0, SCARAB: 0, ANKH: 0, EYE: 0, URN: 0, A: 0, K: 0, Q: 0, J: 1 },
      payScaleBps: 10_000, rules: noFree,
    });
    const predicted = slotChances(3, profile).rtpBps;
    const prng = new Prng(randomSeed());
    for (let spin = 0; spin < 50; spin += 1) {
      expect(playSlot(prng, { reels: 3, profile }).multiplierBps).toBe(predicted);
    }
  });
});
