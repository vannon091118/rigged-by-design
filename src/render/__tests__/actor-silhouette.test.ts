/** @test-target: src/render/actor-silhouette.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { SILHOUETTE, SILHOUETTE_PERSONAS } from '../actor-silhouette';

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
});
