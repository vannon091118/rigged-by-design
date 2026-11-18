/** @test-target: src/render/actor-silhouette.ts * @error-code: ERR-3001 */
import type { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  LOD_SPRITE_LAYERS, LOD_SPRITE_SHEET, SILHOUETTE, SILHOUETTE_HEADS, SILHOUETTE_PERSONAS,
  drawActorSilhouette, lodHairColor, lodSpriteFrame, silhouetteHeadFor, silhouettePinScale,
} from '../actor-silhouette';

describe('Akteur-Silhouette', () => {
  it('ist größer als der alte 6×6-Pin und bleibt eine 24×32-Quelle', () => {
    expect(SILHOUETTE.width).toBe(12);
    expect(SILHOUETTE.height).toBe(16);
    expect(SILHOUETTE.width * 2).toBe(24);
    expect(SILHOUETTE.height * 2).toBe(32);
  });

  it('deckt alle fünf Personafamilien ab', () => {
    expect(SILHOUETTE_PERSONAS).toHaveLength(5);
    expect(new Set(SILHOUETTE_PERSONAS).size).toBe(5);
  });

  it('haelt die Fernsilhouette bei 1× und 2× auf derselben Bildschirmgroesse', () => {
    for (const zoom of [1, 2]) {
      const scale = silhouettePinScale(false, zoom);
      expect(SILHOUETTE.width * scale * zoom).toBe(SILHOUETTE.width);
      expect(SILHOUETTE.height * scale * zoom).toBe(SILHOUETTE.height);
    }
    expect(silhouettePinScale(false, 0)).toBe(1);
    expect(silhouettePinScale(true, 2)).toBe(1);
  });

  it('zeichnet fuer Kappe, Bob und Rund drei verschiedene Fernkonturen', () => {
    const draw = (head: (typeof SILHOUETTE_HEADS)[number]): { w: number; h: number; x: number; y: number }[] => {
      const rects: { w: number; h: number; x: number; y: number }[] = [];
      const g = {
        rect: (x: number, y: number, w: number, h: number) => { rects.push({ x, y, w, h }); return g; },
        roundRect: () => g,
        circle: () => g,
        fill: () => g,
      } as unknown as Graphics;
      drawActorSilhouette(g, { outfit: 0x8d99ae, skin: 0xf2d3b3, hair: 0x2a1a14, head });
      return rects;
    };
    const cap = draw('cap');
    const bob = draw('bob');
    const round = draw('round');
    expect(cap.some((r) => r.w === 10 && r.h === 1)).toBe(true);
    expect(bob.filter((r) => r.w === 2 && r.h === 4 && r.y === -14)).toHaveLength(2);
    expect(round.every((r) => r.w <= 6)).toBe(true);
  });

  it('legt drei Familien als neun 12×16-Zellen in ein 36×48-Sheet', () => {
    expect(LOD_SPRITE_SHEET).toBe('characters/lod-families.svg');
    expect(LOD_SPRITE_LAYERS).toEqual(['body', 'head', 'hair']);
    expect(lodSpriteFrame('round', 'body')).toEqual({ x: 0, y: 0, width: 12, height: 16 });
    expect(lodSpriteFrame('cap', 'head')).toEqual({ x: 12, y: 16, width: 12, height: 16 });
    expect(lodSpriteFrame('bob', 'hair')).toEqual({ x: 24, y: 32, width: 12, height: 16 });
    const cells = SILHOUETTE_HEADS.flatMap((head) => LOD_SPRITE_LAYERS.map((layer) => JSON.stringify(lodSpriteFrame(head, layer))));
    expect(new Set(cells).size).toBe(9);
  });

  it('hebt dunkles Haar fuer den dunklen Boden an, helles bleibt hell', () => {
    expect(lodHairColor(0x000000)).toBeGreaterThan(0);
    expect(lodHairColor(0xffffff)).toBe(0xffffff);
  });

  it('bindet die drei Kopffamilien an drei Fernformen', () => {
    expect(silhouetteHeadFor('head-01')).toBe('round');
    expect(silhouetteHeadFor('head-02')).toBe('cap');
    expect(silhouetteHeadFor('head-03')).toBe('bob');
    expect(silhouetteHeadFor(null)).toBe('round');
    expect(new Set(SILHOUETTE_HEADS).size).toBe(3);
  });
});
