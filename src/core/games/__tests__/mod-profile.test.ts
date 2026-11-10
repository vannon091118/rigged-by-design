/** @test-target: src/core/games/mod-profile.ts | @error-code: ERR-1003 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { playSlot } from '../engines/slot';
import { WEIGHTS } from '../engines/slot-paytable';
import {
  MOD_ENGINE_BIAS, MOD_ENGINE_NOTE, modEngineBias, withModProfile, type ModEngineBias,
} from '../mod-profile';
import { slotConfigOf } from '../slot-config';
import { DEFAULT_SLOT_PROFILE, MAX_PAY_SCALE_BPS, MIN_PAY_SCALE_BPS, normalizeSlotProfile } from '../slot-profile';
import type { ModId } from '../../sim/types';
import { randomSeed } from '../../../test/random-seed';

describe('Mods auf der echten Engine', () => {
  it('laesst das Profil ohne Mod unveraendert', () => {
    const base = normalizeSlotProfile(DEFAULT_SLOT_PROFILE);
    expect(withModProfile(base, [])).toEqual(base);
    expect(modEngineBias([])).toEqual({ weights: {}, payScaleBps: 0, freeSpins: 0 });
  });

  it('verschiebt Gewichte und Auszahlungsprofil je Mod', () => {
    const base = normalizeSlotProfile(DEFAULT_SLOT_PROFILE);
    const cherry = withModProfile(base, ['CHERRY']);
    expect(cherry.weights.J).toBe(WEIGHTS.J + 3);
    expect(cherry.weights.Q).toBe(WEIGHTS.Q + 2);
    expect(cherry.payScaleBps).toBe(base.payScaleBps + 200);

    const nearMiss = withModProfile(base, ['NEAR_MISS']);
    expect(nearMiss.weights.SCARAB).toBe(WEIGHTS.SCARAB + 2);
    expect(nearMiss.payScaleBps).toBe(base.payScaleBps - 300);

    const velvet = withModProfile(base, ['VELVET']);
    expect(velvet.weights.BOOK).toBe(WEIGHTS.BOOK + 1);
    expect(velvet.freeSpins).toBe(base.freeSpins + 2);
  });

  it('erfindet fuer Mods ohne Engine-Wirkung keinen zweiten Effekt', () => {
    const base = normalizeSlotProfile(DEFAULT_SLOT_PROFILE);
    expect(MOD_ENGINE_BIAS.NEON).toBeUndefined();
    expect(MOD_ENGINE_BIAS.EXTRA_REEL).toBeUndefined();
    expect(withModProfile(base, ['NEON', 'FREE_DRINK', 'EXTRA_REEL'])).toEqual(base);
    expect(modEngineBias(['NEON', 'FREE_DRINK'])).toEqual({ weights: {}, payScaleBps: 0, freeSpins: 0 });
  });

  it('zaehlt dieselbe Mod-Id nur einmal und summiert verschiedene Mods', () => {
    const single = withModProfile(normalizeSlotProfile(DEFAULT_SLOT_PROFILE), ['CHERRY']);
    const doubled = withModProfile(normalizeSlotProfile(DEFAULT_SLOT_PROFILE), ['CHERRY', 'CHERRY']);
    expect(doubled).toEqual(single);
    const both = withModProfile(normalizeSlotProfile(DEFAULT_SLOT_PROFILE), ['CHERRY', 'NEAR_MISS']);
    expect(both.weights.J).toBe(WEIGHTS.J + 3);
    expect(both.weights.SCARAB).toBe(WEIGHTS.SCARAB + 2);
    expect(both.payScaleBps).toBe(normalizeSlotProfile(DEFAULT_SLOT_PROFILE).payScaleBps - 100);
  });

  it('bleibt in den spielbaren Grenzen, auch mit extremen Profilen', () => {
    const bias: ModEngineBias = modEngineBias(['CHERRY']);
    expect(bias.payScaleBps).toBe(200);
    const hard = withModProfile({ ...normalizeSlotProfile(DEFAULT_SLOT_PROFILE), weights: { ...WEIGHTS, J: 99 } }, ['CHERRY']);
    expect(hard.weights.J).toBeLessThanOrEqual(99);
    const low = withModProfile({ ...normalizeSlotProfile(DEFAULT_SLOT_PROFILE), payScaleBps: MIN_PAY_SCALE_BPS }, ['NEAR_MISS']);
    expect(low.payScaleBps).toBe(MIN_PAY_SCALE_BPS);
    const high = withModProfile({ ...normalizeSlotProfile(DEFAULT_SLOT_PROFILE), payScaleBps: MAX_PAY_SCALE_BPS }, ['CHERRY']);
    expect(high.payScaleBps).toBe(MAX_PAY_SCALE_BPS);
  });

  it('gibt einer Maschine mit Mods eine andere Konfiguration als ohne', () => {
    const plain = slotConfigOf({ reels: 5, slotOdds: DEFAULT_SLOT_PROFILE });
    const modded = slotConfigOf({ reels: 5, slotOdds: DEFAULT_SLOT_PROFILE, mods: ['CHERRY'] });
    expect(plain.weights.J).toBe(WEIGHTS.J);
    expect(modded.weights.J).toBe(WEIGHTS.J + 3);
    expect(modded.profile.payScaleBps).toBeGreaterThan(plain.profile.payScaleBps);
  });

  it('dreht die echte Engine mit dem veraenderten Profil', () => {
    const config = slotConfigOf({ reels: 5, slotOdds: DEFAULT_SLOT_PROFILE, mods: ['VELVET'] });
    const seed = randomSeed();
    const outcome = playSlot(new Prng(seed), { config });
    expect(outcome.symbols.length).toBeGreaterThan(0);
    expect(config.profile.freeSpins).toBe(DEFAULT_SLOT_PROFILE.freeSpins + 2);
    // Dieselbe Engine, dieselbe Konfiguration: der Spin bleibt reproduzierbar.
    const again = playSlot(new Prng(seed), { config });
    expect(again.symbols).toEqual(outcome.symbols);
  });

  it('nennt fuer jeden Engine-Mod einen Klartext', () => {
    const ids = Object.keys(MOD_ENGINE_BIAS) as ModId[];
    expect(Object.keys(MOD_ENGINE_NOTE).length).toBe(ids.length);
    for (const id of ids) {
      const note = MOD_ENGINE_NOTE[id] ?? '';
      expect(note.length).toBeGreaterThan(4);
      expect(note).toContain('·');
    }
  });
});
