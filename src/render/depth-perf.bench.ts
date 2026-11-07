/**
 * @test-target: src/render/depth.ts
 * @error-code: ERR-3001
 *
 * Tiefensortierung derselben Szene auf SMALL, MEDIUM und LARGE: 200 Figuren,
 * alle Wandkanten des Layouts. Bewusst nicht in verify:all (Geschwindigkeit).
 */
import { test } from 'vitest';
import { Container } from 'pixi.js';
import type { TemplateId } from '../core/sim/types';
import { createWorld } from '../core/sim/templates';
import { measure } from '../test/measure';
import { DepthStage, footAnchor } from './depth';
import { wallBandRect, wallDepthId } from './wall-art';

const TEMPLATES: readonly TemplateId[] = ['SMALL', 'MEDIUM', 'LARGE'];
const ENTITIES = 200;

for (const template of TEMPLATES) {
  test(`Tiefensortierung ${template}`, { timeout: 60_000 }, () => {
    const world = createWorld(template);
    const stage = new DepthStage();
    const actors: Container[] = [];
    for (let index = 0; index < ENTITIES; index += 1) {
      const node = new Container();
      stage.root.addChild(node);
      stage.set(node, footAnchor((index * 7) % world.size, 0.8, 26), 'actor', index);
      actors.push(node);
    }
    const walls = world.layout.edges.filter((edge) => edge.kind === 'WALL');
    for (const edge of walls) {
      const node = new Container();
      stage.root.addChild(node);
      const band = wallBandRect(edge, world.size, 26);
      stage.set(node, band.y + band.h, 'wall', wallDepthId(edge));
    }
    stage.flush();

    let shift = 0;
    measure('sort', () => {
      shift = (shift + 1) % 8;
      for (let index = 0; index < actors.length; index += 1) {
        stage.set(actors[index]!, footAnchor(index % world.size, 0.8, 26) + shift, 'actor', index);
      }
      stage.flush();
    }, { iterations: 20, note: `${ENTITIES} Figuren, ${walls.length} Waende` });
  });
}
