/**
 * @test-target: src/render/city-exterior-layer.ts
 * @error-code: ERR-3001
 *
 * Schatten und Licht teilen die lazy geladene Radialtextur. Fehlt sie beim
 * ersten Stadtaufbau, muss der gedrosselte Retry die Schatten nachziehen.
 *
 * Der Lauf laedt die Renderer-Module nach `resetModules` dynamisch: der
 * Regellauf teilt den Worker (`isolate: false`), deshalb darf ein bereits
 * geladenes `textures`-Modul den Mock dieser Datei nicht ueberspringen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCityExteriorModel } from '../../core/sim/city-exterior';
import type { GameView } from '../../store/types';
import { ASSET } from '../assets/keys';
import { ambientPlanFor } from '../ambient-plan';
import { cityRenderPlan } from '../city-plan';

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

function shadows(layer: import('../city-exterior-layer').CityExteriorLayer): number {
  return layer.root.children.filter((node) => {
    const first = (node as { children?: Array<{ tint?: number }> }).children?.[0];
    return first?.tint === 0;
  }).length;
}

describe('Stadtschatten bei spaeter Textur', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('baut die Schatten im Retry nach, sobald die Textur da ist', async () => {
    const { Texture } = await import('pixi.js');
    const { CityExteriorLayer } = await import('../city-exterior-layer');
    const { DepthStage } = await import('../depth');
    const { textureFor } = await import('../assets/textures');
    let lightReady = false;
    vi.mocked(textureFor).mockReset();
    vi.mocked(textureFor).mockImplementation((path) =>
      path === ASSET.lightPool && !lightReady ? null : Texture.WHITE,
    );

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
