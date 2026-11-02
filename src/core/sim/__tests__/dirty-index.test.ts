/**
 * @test-target: src/core/sim/emotion.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import { dirtyNear, dirtyTileIndex } from '../emotion';

describe('Dreck-Kacheln', () => {
  it('adressiert eine Kachel als y * size + x', () => {
    expect(dirtyTileIndex(24, 10, 22)).toBe(22 * 24 + 10);
  });

  it('wird von dirtyNear an genau dieser Kachel gefunden', () => {
    const tiles = new Set([dirtyTileIndex(24, 10, 22)]);
    expect(dirtyNear(tiles, 24, 10, 22, 0)).toBe(true);
  });

  it('liegt nicht diagonal versetzt auf der Nachbarkachel', () => {
    const tiles = new Set([dirtyTileIndex(24, 10, 22)]);
    expect(dirtyNear(tiles, 24, 11, 23, 0)).toBe(false);
  });
});
