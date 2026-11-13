/**
 * @test-target: src/core/sim/city-npc-roster.ts
 * @error-code: ERR-2001
 *
 * Die Stadt ist keine Dreiergruppe: Jeder Index der Besetzung ergibt eine
 * vollständige Figur, jeder Bewohner bekommt ein Profil und eine Schicht, und
 * die Simulation läuft für alle — nicht nur für Rita, Boris und Mira.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { cityLifeView } from '../city-life-view';
import { CITY_POPULATION_DEFAULT, npcIndexById, rosterDefAt, rosterDefs } from '../city-npc-roster';
import { CITY_SLOTS, slotOf } from '../city-npc-shift';
import { tickWorld } from '../tick';
import { createWorld, ensureStarter } from '../templates';

const start = () => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};

const POPULATION = 14;

describe('Stadt-Bevölkerung', () => {
  it('erzeugt für jeden Index eine vollständige, seedfeste Figur', () => {
    const defs = rosterDefs(20, 4242);
    expect(defs).toHaveLength(20);
    expect(new Set(defs.map((def) => def.id)).size).toBe(20);
    expect(new Set(defs.map((def) => def.name)).size).toBe(20);
    for (const def of defs) {
      expect(def.name.length).toBeGreaterThan(3);
      expect(def.role.length).toBeGreaterThan(3);
      expect(def.traits).toHaveLength(2);
      expect(def.traits[0]).not.toBe(def.traits[1]);
      expect(def.charisma).toBeGreaterThanOrEqual(1);
      expect(def.charisma).toBeLessThanOrEqual(10);
    }
    expect(rosterDefs(20, 4242)).toEqual(defs);
    expect(rosterDefAt(0).id).toBe('rita');
  });

  it('gibt jeder Figur eine Schicht in ihrem Gebäude, auch den kuratierten', () => {
    for (const index of [0, 1, 2, 3, 4, 7, 13]) {
      const def = rosterDefAt(index);
      const slot = slotOf(def.id);
      expect(slot).not.toBeNull();
      expect(slot!.holderId).toBe(def.id);
      expect(slot!.from).toBeGreaterThanOrEqual(0);
      expect(slot!.to).toBeLessThanOrEqual(24);
      expect(slot!.from).toBeLessThan(slot!.to);
    }
    expect(CITY_SLOTS).toHaveLength(3);
    expect(npcIndexById('npc_9')).toBe(8);
    expect(npcIndexById('fremd')).toBeNull();
    expect(slotOf('fremd')).toBeNull();
  });

  it('wächst auf jede Zielgröße, ohne bestehende Bewohner anzufassen', () => {
    const { world } = start();
    const before = ensureCityLife(world).residents;
    expect(before).toHaveLength(CITY_POPULATION_DEFAULT);
    expect(ensureCityPopulation(world, POPULATION)).toBe(POPULATION - CITY_POPULATION_DEFAULT);
    const life = ensureCityLife(world);
    expect(life.residents).toHaveLength(POPULATION);
    expect(life.residents.slice(0, before.length)).toEqual(before);
    expect(ensureCityPopulation(world, POPULATION)).toBe(0);
  });

  it('gibt jedem neuen Bewohner ein eigenes Profil mit Traits', () => {
    const { world } = start();
    ensureCityPopulation(world, POPULATION);
    const view = cityLifeView(world);
    expect(view).toHaveLength(POPULATION);
    expect(new Set(view.map((entry) => entry.npcId)).size).toBe(POPULATION);
    for (const resident of ensureCityLife(world).residents) {
      const profile = world.visitors.find((visitor) => visitor.id === resident.visitorId);
      expect(profile?.residentNpcId).toBe(resident.npcId);
      expect(profile?.traits?.length).toBeGreaterThan(0);
      expect(profile?.visits).toBe(0);
    }
    for (const entry of view) expect(entry.traits.length).toBeGreaterThan(0);
  });

  it('lässt alle Bewohner über einen Tag laufen und behält sie im Save', () => {
    const { world, ledger, prng } = start();
    ensureCityPopulation(world, POPULATION);
    const startPositions = ensureCityLife(world).residents.map((resident) => resident.npcId);
    for (let index = 0; index < 320; index += 1) tickWorld(world, ledger, prng);
    const life = ensureCityLife(world);
    expect(life.residents.map((resident) => resident.npcId)).toEqual(startPositions);
    const decisions = new Set((life.lastDecisions ?? []).map((decision) => decision.npcId));
    expect(decisions.size).toBeGreaterThan(3);
    const traveled = life.residents.filter((resident) => resident.location !== 'HOME'
      || resident.travel !== null || resident.intent !== 'SLEEP');
    expect(traveled.length).toBeGreaterThan(3);
    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState()))))!;
    const restored = ensureCityLife(loaded.world);
    expect(restored.residents).toHaveLength(POPULATION);
    expect(restored.residents.map((resident) => resident.npcId)).toEqual(startPositions);
    expect(loaded.world.visitors.filter((visitor) => visitor.residentNpcId !== undefined))
      .toHaveLength(POPULATION);
  });

  it('verliert keine Kennung, wenn der Gästepool überläuft', () => {
    const { world } = start();
    ensureCityPopulation(world, POPULATION);
    const ids = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    for (let index = 0; index < 80; index += 1) tickWorld(world, new Ledger({}), new Prng(index + 1));
    const after = ensureCityLife(world).residents.map((resident) => resident.visitorId);
    expect(after).toEqual(ids);
    expect(after.every((id) => world.visitors.some((visitor) => visitor.id === id))).toBe(true);
  });
});
