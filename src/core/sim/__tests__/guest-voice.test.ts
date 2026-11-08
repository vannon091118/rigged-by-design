/**
 * @test-target: src/core/sim/narrative/guest-voice.ts
 * @error-code: ERR-2001
 *
 * Der Ruf hoert man: Das Rufband waehlt den Pool, der Gast waehlt den Satz,
 * und dieselbe Lage liest denselben Satz. Kein Zufall, keine leeren Pools.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, ensureStarter } from '../templates';
import { makeGuest } from '../traits';
import { Prng } from '../../rng/prng';
import { NARRATIVE_REGISTRY } from '../narrative/composer/registry.generated';
import { guestVoice, VOICE_SLOT, voiceBand, voiceLine } from '../narrative/guest-voice';

const SEED = 4711;

function guest(id: number, visitorId = id) {
  return { ...makeGuest({ id, persona: 'STAMMGAST', prng: new Prng(SEED), spawn: { x: 2, y: 13 } }), visitorId };
}

describe('Gaststimme nach Ruf', () => {
  it('ordnet den Ruf drei Baendern zu, mit klaren Grenzen', () => {
    expect(voiceBand(0)).toBe('LOW');
    expect(voiceBand(39)).toBe('LOW');
    expect(voiceBand(40)).toBe('MID');
    expect(voiceBand(69)).toBe('MID');
    expect(voiceBand(70)).toBe('HIGH');
    expect(voiceBand(100)).toBe('HIGH');
    expect(voiceBand(Number.NaN)).toBe('LOW');
  });

  it('haelt je Band mindestens 50 verdrahtete Bausteine bereit', () => {
    for (const slot of Object.values(VOICE_SLOT)) {
      const pool = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === slot && fragment.locale === 'de');
      expect(pool.length, `Pool ${slot}`).toBeGreaterThanOrEqual(50);
    }
  });

  it('liest fuer dieselbe Lage denselben Satz', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const first = guest(3);
    expect(guestVoice(world, first, 20)).toBe(guestVoice(world, first, 20));
    expect(guestVoice(world, first, 85)).toBe(guestVoice(world, first, 85));
  });

  it('wechselt mit dem Rufband die Stimme, nicht nur den Ton', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const speaker = guest(5);
    const low = new Set<string>();
    const high = new Set<string>();
    for (let id = 1; id <= 10; id += 1) {
      const entry = { ...guest(id) };
      low.add(guestVoice(world, entry, 10) ?? '');
      high.add(guestVoice(world, entry, 90) ?? '');
    }
    for (const text of low) expect(NARRATIVE_REGISTRY.some((fragment) => fragment.slot === 'guest-voice-low' && fragment.text === text)).toBe(true);
    for (const text of high) expect(NARRATIVE_REGISTRY.some((fragment) => fragment.slot === 'guest-voice-high' && fragment.text === text)).toBe(true);
    expect(guestVoice(world, speaker, 55)).not.toBe(guestVoice(world, speaker, 95));
  });

  it('haengt die Stimme an den mechanischen Intent, ohne ihn zu ersetzen', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const line = voiceLine(world, guest(9), 'Spielt den Slot: Angebot passt.');
    expect(line.startsWith('Spielt den Slot: Angebot passt. ')).toBe(true);
    expect(line.length).toBeGreaterThan('Spielt den Slot: Angebot passt.'.length + 10);
  });
});
