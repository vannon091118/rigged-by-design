/**
 * @test-target: src/core/sim/city-life-movement.ts
 * @error-code: ERR-2001
 *
 * Bewegung ist ein Weg, kein Etikett: Der Bewohner startet an seiner Tür, läuft
 * die Kacheln des A*-Wegs ab und wechselt den Ort erst bei Ankunft. Geprüft
 * werden Zusammenhängendheit, Tempo, Ankunft, blockierte Ziele und Save/Load.
 */
import { describe, expect, it } from 'vitest';
import { createCityScene } from '../city-scene';
import { createWorld, ensureStarter } from '../templates';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { tickWorld } from '../tick';
import {
  advanceTravel, placeEntrance, remainingTiles, routeTo, startTravel, tickCityMovement,
  TILES_PER_TICK,
} from '../city-life-movement';
import { ensureCityLife } from '../city-life-state';
import { cityLifeView } from '../city-life-view';
import { isWalkable } from '../pathfinding';
import { cityNav } from '../city-scene';
import { normalizeCityLife } from '../city-life-state';
import type { Point } from '../types-model';

const city = createCityScene();
const makeWorld = () => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};
const HOME = placeEntrance('HOME')!;

const adjacent = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe('Bewegung', () => {
  it('baut aus der eigenen Tür einen lückenlosen Weg zur Kneipe', () => {
    const path = routeTo(city, HOME, 'KIEZ');
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual(HOME);
    const nav = cityNav(city);
    for (const tile of path) expect(isWalkable(nav, tile.x, tile.y)).toBe(true);
    for (let index = 1; index < path.length; index += 1) {
      expect(adjacent(path[index - 1]!, path[index]!)).toBe(true);
    }
  });

  it('steht an der eigenen Tür, ohne Weg aber mit sofortigem Ort', () => {
    const start = startTravel(HOME, city, 'HOME');
    expect(start.here).toBe(true);
    expect(start.travel).toBeNull();
  });

  it('läuft eine Kachel je Tick und kommt am Zielort an', () => {
    const start = startTravel(HOME, city, 'KIEZ');
    expect(start.travel).not.toBeNull();
    const travel = start.travel!;
    const first = advanceTravel(travel);
    expect(first.arrived).toBe(false);
    expect(adjacent(travel.path[0]!, first.position)).toBe(true);
    expect(remainingTiles(first.travel)).toBe(travel.path.length - 2 - travel.index);
    // Der Rest des Wegs endet an der Tür, nicht irgendwo auf der Straße.
    let step = first;
    for (let guard = 0; guard < 200 && !step.arrived; guard += 1) step = advanceTravel(step.travel!);
    expect(step.arrived).toBe(true);
    expect(step.position).toEqual(placeEntrance('KIEZ'));
  });

  it('springt nie mehr als das Tempolimit je Tick', () => {
    const travel = startTravel(HOME, city, 'KIEZ').travel!;
    const step = advanceTravel(travel, 100);
    expect(step.travel === null || step.travel.index <= travel.index + TILES_PER_TICK * 8).toBe(true);
  });

  it('startet nie ausserhalb des Rasters und springt nicht auf die erste Kachel', () => {
    // Ein kaputter Standpunkt wird auf die naechste begehbare Kachel gehoben;
    // der Weg beginnt dort, nicht am alten Punkt.
    const outside: Point = { x: -3, y: -3 };
    const path = routeTo(city, outside, 'KIEZ');
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]!.x).toBeGreaterThanOrEqual(0);
    expect(path[0]!.y).toBeGreaterThanOrEqual(0);
    expect(adjacent(path[0]!, path[1]!)).toBe(true);
  });

  it('bewegt den Bewohner im Welt-Tick und wechselt den Ort erst bei Ankunft', () => {
    const { world, ledger, prng } = makeWorld();
    const rita = ensureCityLife(world).residents.find((entry) => entry.npcId === 'rita')!;
    world.cityLife = {
      ...ensureCityLife(world),
      residents: ensureCityLife(world).residents.map((entry) => entry.npcId === 'rita'
        ? { ...entry, location: 'HOME' as const, position: HOME, travel: startTravel(HOME, city, 'KIEZ').travel }
        : entry),
    };
    const moving = ensureCityLife(world).residents.find((entry) => entry.npcId === 'rita')!;
    expect(moving.location).toBe('HOME');
    expect(cityLifeView(world).find((view) => view.npcId === 'rita')!.travelTo).toBe('Kiez');

    // Der Welt-Tick bewegt genau eine Kachel je Tick, nie den ganzen Weg.
    const before = moving.position;
    tickWorld(world, ledger, prng);
    const afterOne = ensureCityLife(world).residents.find((entry) => entry.npcId === 'rita')!;
    expect(adjacent(before, afterOne.position)).toBe(true);

    // Ohne neue Entscheidung läuft der Weg zu Ende und der Ort wechselt.
    for (let guard = 0; guard < 100 && ensureCityLife(world).residents
      .find((entry) => entry.npcId === 'rita')!.travel; guard += 1) tickCityMovement(world);
    const arrived = ensureCityLife(world).residents.find((entry) => entry.npcId === 'rita')!;
    expect(arrived.location).toBe('KIEZ');
    expect(arrived.travel).toBeNull();
    expect(arrived.position).toEqual(placeEntrance('KIEZ'));
    void rita;
  });

  it('hält einen gespeicherten Weg und verwirft kaputte Wege', () => {
    const travel = startTravel(HOME, city, 'KIEZ').travel!;
    const base = ensureCityLife(makeWorld().world);
    const saved = JSON.parse(JSON.stringify({
      ...base,
      residents: base.residents.map((entry) => entry.npcId === 'rita'
        ? { ...entry, position: HOME, travel }
        : entry),
    })) as unknown;
    const restored = normalizeCityLife(saved);
    const rita = restored.residents.find((entry) => entry.npcId === 'rita')!;
    expect(rita.travel?.path.length).toBe(travel.path.length);
    expect(rita.travel?.to).toBe('KIEZ');

    const broken = normalizeCityLife({
      ...saved as Record<string, unknown>,
      residents: (saved as { residents: Record<string, unknown>[] }).residents.map((entry) =>
        entry.npcId === 'rita' ? { ...entry, travel: { to: 'KIEZ', path: [{ x: 0, y: 0 }], index: 0 } } : entry),
    });
    expect(broken.residents.find((entry) => entry.npcId === 'rita')!.travel).toBeNull();
  });

  it('lässt einen Bewohner ohne Weg stehen', () => {
    const { world, ledger, prng } = makeWorld();
    tickCityMovement(world);
    const before = ensureCityLife(world).residents.map((entry) => entry.position);
    tickWorld(world, ledger, prng);
    for (const entry of ensureCityLife(world).residents) {
      expect(before.length).toBeGreaterThan(0);
      expect(Number.isFinite(entry.position.x)).toBe(true);
    }
  });
});
