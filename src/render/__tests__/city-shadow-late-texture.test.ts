/**
 * @test-target: src/render/city-exterior-layer.ts
 * @error-code: ERR-3001
 *
 * Schatten und Licht teilen die lazy geladene Radialtextur. Fehlt sie beim
 * ersten Stadtaufbau, muss der gedrosselte Retry die Schatten nachziehen.
 */
import { Container, Texture } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCityExteriorModel } from '../../core/sim/city-exterior';
import type { GameView } from '../../store/types';
import { ASSET } from '../assets/keys';
import { textureFor } from '../assets/textures';
import { ambientPlanFor } from '../ambient-plan';
import { CityExteriorLayer } from '../city-exterior-layer';
import { cityRenderPlan } from '../city-plan';
import { DepthStage } from '../depth';

vi.mock('../assets/textures', () => ({ textureFor: vi.fn() }));
vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>();
  return {
    ...actual,
    Text: class extends actual.Container {
      anchor = { set: (): void => undefined };
      constructor(_options?: unknown) { super(); }
    },
  };
});

const plan = cityRenderPlan(createCityExteriorModel());
if (!plan) throw new Error('Stadtplan fehlt');
const view = { dayPhase: 'night', scene: { kind: 'CITY' }, size: 60 } as GameView;
let lightReady = false;

function nodes(layer: CityExteriorLayer): Container[] {
  return layer.root.children.filter((child): child is Container => child instanceof Container);
}

function shadows(layer: CityExteriorLayer): number {
  return nodes(layer).filter((node) => {
    const first = node.children[0] as { tint?: number } | undefined;
    return first?.tint === 0;
  }).length;
}

describe('Stadtschatten bei spaeter Textur', () => {
  beforeEach(() => {
    lightReady = false;
    vi.mocked(textureFor).mockReset();
    vi.mocked(textureFor).mockImplementation((path) =>
      path === ASSET.lightPool && !lightReady ? null : Texture.WHITE,
    );
  });

  it('baut die Schatten im Retry nach, sobald die Textur da ist', () => {
    const layer = new CityExteriorLayer(new DepthStage());
    layer.setAmbient(ambientPlanFor('night', 'CITY'));
    layer.update(plan);
    expect(shadows(layer)).toBe(0);
    lightReady = true;
    layer.animate(1_000, 'night');
    expect(shadows(layer)).toBeGreaterThan(0);
    expect(ambientPlanFor('night', 'CITY').shadow).toBeGreaterThan(0);
    expect(view.scene.kind).toBe('CITY');
    layer.destroy();
  });
});
