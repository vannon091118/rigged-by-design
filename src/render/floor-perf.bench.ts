/**
 * @test-target: src/render/floor-math.ts
 * @error-code: ERR-1003
 *
 * Worst-Case: 90×90-Floor, 9 Regionen, 500 Dreck-Tiles, 200 Entities.
 * Bewusst nicht Teil von verify:all: misst Geschwindigkeit, wird nie rot.
 */
import { test } from 'vitest';
import { Graphics } from 'pixi.js';
import { measure } from '../test/measure';
import { areasFor } from '../core/sim/grid-zones';
import { createWorld } from '../core/sim/templates';
import { isVisible, regionHash, visibleRect } from './floor-math';
import { drawRegionDirt, drawRegionFloor } from './room-art';

const world = createWorld('LARGE');
const areas = areasFor('LARGE');
const view = {
  size: world.size,
  template: world.template,
  carpet: world.carpet,
  zones: world.zones,
  furniture: [],
  dirtyTiles: new Set(Array.from({ length: 500 }, (_, index) => (index * 37) % (world.size * world.size))),
};
const rect = visibleRect(0, 0, 0.2, 1600, 900);

test('Floor-Durchsatz im Worst-Case', { timeout: 60_000 }, () => {
  measure('hash', () => {
    for (const area of areas) regionHash(view as never, area);
  }, { iterations: 20, note: '9 Regionen' });

  measure('boden', () => {
    for (const area of areas) {
      const g = new Graphics();
      drawRegionFloor(g, view as never, area, 26);
      g.destroy();
    }
  }, { iterations: 10, note: '9 Chunks, 90x90' });

  measure('dreck', () => {
    for (const area of areas) {
      const g = new Graphics();
      drawRegionDirt(g, view as never, area, 26);
      g.destroy();
    }
  }, { iterations: 10, note: '500 Tiles' });

  measure('cull', () => {
    for (let index = 0; index < 200; index += 1) {
      isVisible((index * 53) % 2340, (index * 91) % 2340, 26, 26, rect, 40);
    }
  }, { iterations: 20, note: '200 Entities' });
});
