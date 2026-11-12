/**
 * @test-target: src/core/sim/city-exterior.ts
 * @error-code: ERR-2001
 *
 * Die Stadt ist nur dann dieselbe Umgebung fuer Bild und Navigation, wenn die
 * gezeichneten Requisiten auch begehbare Kacheln belegen. Der Test liest den
 * Fussabdruck aus dem Modell, prueft jede Kachel im Stadt-Nav und laesst den
 * Pfad um die Bank herumlaufen statt durch sie hindurch.
 */
import { describe, expect, it } from 'vitest';
import { STREET_PROP_FOOTPRINTS, streetPropFootprintTiles } from '../city-exterior';
import { cityNav, createCityScene, normalizeCityScene, type CitySceneState } from '../city-scene';
import { tileIndex } from '../nav-grid';
import { findPath, isWalkable } from '../pathfinding';

const city = createCityScene();
const nav = cityNav(city);
const props = city.exterior.props;

describe('Stadt: Strassenrequisiten belegen ihren Fussabdruck', () => {
  it('blockiert jede Kachel des Fussabdrucks und keine doppelt', () => {
    const tiles = props.flatMap((prop) =>
      streetPropFootprintTiles(prop).map((tile) => ({ prop, ...tile })),
    );
    expect(tiles).toHaveLength(props.reduce((sum, prop) => sum + prop.footprint.w * prop.footprint.h, 0));
    const indices = tiles.map(({ x, y }) => tileIndex(nav.size, x, y));
    expect(new Set(indices).size).toBe(indices.length);
    expect(nav.blocked.size).toBe(indices.length);
    for (const { prop, x, y } of tiles) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(nav.size);
      expect(y).toBeLessThan(nav.size);
      expect(nav.blocked.has(tileIndex(nav.size, x, y)), `${prop.id} @ ${x},${y}`).toBe(true);
    }
  });

  it('nimmt die Bank mit zwei Kacheln und die uebrigen Requisiten mit einer', () => {
    expect(STREET_PROP_FOOTPRINTS.BENCH).toEqual({ w: 2, h: 1 });
    expect(props.map((prop) => [prop.kind, prop.footprint.w, prop.footprint.h])).toEqual([
      ['STREET_LIGHT', 1, 1],
      ['BENCH', 2, 1],
      ['TRASH_BIN', 1, 1],
      ['BUS_STOP', 1, 1],
      ['TREE', 1, 1],
    ]);
  });

  it('laeuft um die Bank herum statt durch sie hindurch', () => {
    const bench = props.find((prop) => prop.kind === 'BENCH')!;
    const start = { x: bench.position.x - 1, y: bench.position.y };
    const goal = { x: bench.position.x + bench.footprint.w, y: bench.position.y };
    expect(isWalkable(nav, bench.position.x, bench.position.y)).toBe(false);
    expect(isWalkable(nav, start.x, start.y)).toBe(true);
    expect(isWalkable(nav, goal.x, goal.y)).toBe(true);
    expect(findPath(nav, bench.position, goal)).toEqual([]);
    const path = findPath(nav, start, goal);
    expect(path.length).toBeGreaterThan(Math.abs(goal.x - start.x));
    expect(path.every((step) => isWalkable(nav, step.x, step.y))).toBe(true);
  });

  it('ergaenzt den Fussabdruck beim Laden alter Stadtsaves', () => {
    const legacy = JSON.parse(JSON.stringify(createCityScene())) as {
      exterior: { props: Array<{ footprint?: unknown }> };
    };
    for (const prop of legacy.exterior.props) delete prop.footprint;
    const normalized = normalizeCityScene(legacy as unknown as CitySceneState);
    expect(normalized.exterior.props.map((prop) => prop.footprint)).toEqual([
      { w: 1, h: 1 },
      { w: 2, h: 1 },
      { w: 1, h: 1 },
      { w: 1, h: 1 },
      { w: 1, h: 1 },
    ]);
  });
});
