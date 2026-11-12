/**
 * @test-target: src/render/ambient-layer.ts
 * @error-code: ERR-3001
 *
 * Die Lichttextur wird lazy geladen. Ein identischer Ambient-Plan darf den
 * Sichtradius nach dem ersten fehlenden Versuch nicht dauerhaft unsichtbar
 * lassen; der zweite Snapshot muss ihn nachziehen.
 */
import { Texture } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { AmbientLayer } from '../ambient-layer';
import { ambientPlanFor } from '../ambient-plan';
import { textureFor } from '../assets/textures';

vi.mock('../assets/textures', () => ({ textureFor: vi.fn() }));

const view = { dayPhase: 'night', scene: { kind: 'CITY' }, size: 60 } as GameView;

describe('Ambient-Sichtradius bei spaeter Textur', () => {
  beforeEach(() => {
    vi.mocked(textureFor).mockReset();
  });

  it('zeichnet den Radius im zweiten Update, sobald die Textur da ist', () => {
    vi.mocked(textureFor).mockReturnValueOnce(null).mockReturnValue(Texture.WHITE);
    const layer = new AmbientLayer();
    const bounds = { width: 60, height: 60 };
    layer.update(view, bounds);
    expect(layer.root.children[2]?.visible).toBe(false);
    layer.update(view, bounds);
    expect(layer.root.children[2]?.visible).toBe(true);
    expect(ambientPlanFor('night', 'CITY').visionTiles).toBeGreaterThan(0);
    layer.destroy();
  });
});
