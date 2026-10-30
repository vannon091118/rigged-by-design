/**
 * @test-target: src/core/sim/player-look.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import {
  applyLook, DEFAULT_LOOK, LOOK_OUTFITS, LOOK_SKINS, normalizeLook,
} from '../player-look';

describe('Charakter-Look', () => {
  it('fällt bei kaputten Saves auf gültige Defaults zurück', () => {
    const look = normalizeLook({ skin: 'rot', hair: '#123456', outfit: null, accessory: 'HELM' });
    expect(look.skin).toBe(DEFAULT_LOOK.skin);
    expect(look.outfit).toBe(DEFAULT_LOOK.outfit);
    expect(look.accessory).toBe(DEFAULT_LOOK.accessory);
    expect(normalizeLook(null)).toEqual(DEFAULT_LOOK);
  });

  it('akzeptiert nur echte Optionen und behält sonst den alten Wert', () => {
    const next = applyLook(DEFAULT_LOOK, { skin: LOOK_SKINS[1], outfit: LOOK_OUTFITS[2], accessory: 'CAP' });
    expect(next.skin).toBe(LOOK_SKINS[1]);
    expect(next.outfit).toBe(LOOK_OUTFITS[2]);
    expect(next.accessory).toBe('CAP');
    const rejected = applyLook(next, { skin: '#123456', accessory: 'CHAIN' });
    expect(rejected.skin).toBe(LOOK_SKINS[1]);
    expect(rejected.accessory).toBe('CHAIN');
  });
});
