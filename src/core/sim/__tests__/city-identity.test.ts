/**
 * @test-target: src/core/sim/city-identity.ts
 * @error-code: ERR-2001
 *
 * Identität ist eine Kennung, kein Name: Jeder Bewohner bekommt eine eigene ID,
 * die Sicht liest sie, ein Profil entsteht ohne Besuch — und ein Namensvetter
 * im Gästepool kann weder Traits noch Beziehungen tauschen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_NPCS, ensureCityVisitor } from '../city-npcs';
import { bindCityIdentities } from '../city-identity';
import { ensureCityLife } from '../city-life-state';
import { cityLifeView } from '../city-life-view';
import { tickWorld } from '../tick';
import { createWorld, ensureStarter } from '../templates';
import { pickReturningVisitor, recordVisitor, VISITOR_CAP } from '../visitors';

const start = () => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};

const ritaDef = CITY_NPCS.find((entry) => entry.id === 'rita')!;

describe('Stadt-Identität', () => {
  it('gibt jedem Bewohner eine eigene Kennung auf sein Profil', () => {
    const { world } = start();
    const life = ensureCityLife(world);
    const ids = life.residents.map((resident) => resident.visitorId);
    for (const id of ids) expect(Number.isInteger(id) && (id ?? 0) > 0).toBe(true);
    expect(new Set(ids).size).toBe(3);
    for (const resident of life.residents) {
      const profile = world.visitors.find((visitor) => visitor.id === resident.visitorId);
      expect(profile?.residentNpcId).toBe(resident.npcId);
    }
  });

  it('verwechselt einen Namensvetter im Gästepool nicht mit Rita', () => {
    const { world } = start();
    ensureCityLife(world);
    const namesake = recordVisitor(world, { name: 'Rita Kern', persona: 'STREET', tick: 0 });
    const profile = ensureCityVisitor(world, ritaDef);
    expect(namesake.id).not.toBe(profile.id);
    expect(profile.residentNpcId).toBe('rita');
    expect(profile.charisma).toBe(ritaDef.charisma);
    // Der Namensvetter bleibt ohne Bewohnerdaten, die Sicht liest Ritas Profil.
    expect(namesake.charisma).toBeUndefined();
    expect(cityLifeView(world).find((entry) => entry.npcId === 'rita')?.traits.length).toBeGreaterThan(0);
    expect(namesake.traits).toBeUndefined();
  });

  it('legt Bewohnerprofile ohne Besuch an und lässt sie nicht als Stammgast zurückkehren', () => {
    const { world } = start();
    const life = ensureCityLife(world);
    for (const resident of life.residents) {
      const profile = world.visitors.find((visitor) => visitor.id === resident.visitorId)!;
      expect(profile.visits).toBe(0);
    }
    const residentIds = new Set(life.residents.map((resident) => resident.visitorId));
    for (let guestId = 1; guestId <= 60; guestId += 1) {
      const picked = pickReturningVisitor(world, guestId);
      expect(picked === null || !residentIds.has(picked.id)).toBe(true);
    }
  });

  it('bleibt idempotent: kein zweites Profil, keine neue Kennung', () => {
    const { world } = start();
    const first = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    const count = world.visitors.length;
    bindCityIdentities(world);
    ensureCityLife(world);
    expect(world.visitors).toHaveLength(count);
    expect(ensureCityLife(world).residents.map((resident) => resident.visitorId)).toEqual(first);
  });

  it('hält die Kennung über Save/Load', () => {
    const { world, ledger, prng } = start();
    for (let index = 0; index < 300; index += 1) tickWorld(world, ledger, prng);
    const before = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState()))))!;
    expect(ensureCityLife(loaded.world).residents.map((resident) => resident.visitorId)).toEqual(before);
    expect(loaded.world.visitors.filter((visitor) => visitor.residentNpcId !== undefined)).toHaveLength(3);
  });

  it('behält Bewohnerprofile, wenn der Gastpool überläuft', () => {
    const { world } = start();
    const before = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    for (let index = 0; index < VISITOR_CAP + 12; index += 1) {
      recordVisitor(world, { name: `Gast ${index}`, persona: 'STREET', tick: index });
    }
    const after = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    expect(after).toEqual(before);
    expect(after.every((id) => world.visitors.some((visitor) => visitor.id === id))).toBe(true);
  });

  it('adoptiert ein altes Profil ohne Kennung genau einmal', () => {
    const { world } = start();
    ensureCityLife(world);
    // Alter Save: Profil ohne Kennung, Bewohner ohne Zeiger.
    for (const visitor of world.visitors) delete visitor.residentNpcId;
    world.cityLife = {
      ...ensureCityLife(world),
      residents: ensureCityLife(world).residents.map((resident) => ({ ...resident, visitorId: null })),
    };
    const legacyRita = world.visitors.find((visitor) => visitor.name === 'Rita Kern')!;
    const bound = ensureCityLife(world).residents.find((resident) => resident.npcId === 'rita')!;
    expect(bound.visitorId).toBe(legacyRita.id);
    expect(legacyRita.residentNpcId).toBe('rita');
    // Ein späterer Namensvetter erbt die Kennung nicht.
    const namesake = recordVisitor(world, { name: 'Rita Kern', persona: 'STREET', tick: 3 });
    expect(ensureCityVisitor(world, ritaDef).id).toBe(legacyRita.id);
    expect(namesake.residentNpcId).toBeUndefined();
  });
});
