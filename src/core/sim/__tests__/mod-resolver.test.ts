/**
 * @test-target: src/core/sim/offers.ts
 * @error-code: ERR-2001
 *
 * Mod-Wirkungen entstehen an genau einer Stelle: der gemeinsame Resolver
 * für eigenes Haus und fremde Häuser, mit Spieltyp in der Frage.
 */
import { describe, expect, it } from 'vitest';
import { getMod, modAppliesTo, resolveModEffects } from '../offers';
import { getRival } from '../rivals';

describe('Gemeinsamer Resolver für Mod-Wirkungen', () => {
  it('zählt die vierte Walze nur auf Spieltyp SLOT', () => {
    expect(resolveModEffects('SLOT', ['EXTRA_REEL']).attraction).toBe(getMod('EXTRA_REEL').attraction);
    expect(resolveModEffects('ROULETTE', ['EXTRA_REEL']).attraction).toBe(0);
    expect(resolveModEffects('PLINKO', ['EXTRA_REEL']).attraction).toBe(0);
    expect(resolveModEffects('ROULETTE', ['EXTRA_REEL'])).toEqual(resolveModEffects('ROULETTE', []));
  });

  it('unterscheidet eingeschränkte und uneingeschränkte Regeln', () => {
    expect(modAppliesTo('EXTRA_REEL', 'SLOT')).toBe(true);
    expect(modAppliesTo('EXTRA_REEL', 'PLINKO')).toBe(false);
    expect(modAppliesTo('EXTRA_REEL', undefined)).toBe(false);
    expect(modAppliesTo('NEON', undefined)).toBe(true);
    expect(resolveModEffects(undefined, ['EXTRA_REEL']).attraction).toBe(0);
    expect(resolveModEffects(undefined, ['NEON']).attraction).toBe(getMod('NEON').attraction);
  });

  it('summiert mehrere Mods über denselben Weg', () => {
    const effects = resolveModEffects('SLOT', ['NEON', 'CHERRY', 'EXTRA_REEL']);
    expect(effects.attraction).toBe(
      getMod('NEON').attraction + getMod('CHERRY').attraction + getMod('EXTRA_REEL').attraction,
    );
    expect(effects.bonusBps).toBe(getMod('CHERRY').bonusBps);
    expect(effects.patience).toBe(
      getMod('NEON').patience + getMod('CHERRY').patience + getMod('EXTRA_REEL').patience,
    );
    expect(effects.operating).toBe(
      getMod('NEON').operating + getMod('CHERRY').operating + getMod('EXTRA_REEL').operating,
    );
  });

  it('lässt fremde Häuser durch denselben Resolver laufen', () => {
    const machines = getRival('NEBELPALAST').machines;
    const roulette = machines.find((entry) => entry.game === 'ROULETTE')!;
    expect(roulette.mods).toContain('EXTRA_REEL');
    expect(resolveModEffects(roulette.game, roulette.mods).attraction).toBe(0);

    const plinko = machines.find((entry) => entry.game === 'PLINKO')!;
    expect(resolveModEffects(plinko.game, plinko.mods).attraction)
      .toBe(getMod('NEON').attraction + getMod('NEAR_MISS').attraction);
  });
});
