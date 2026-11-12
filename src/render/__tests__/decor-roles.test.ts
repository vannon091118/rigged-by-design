/** @test-target: src/render/decor-roles.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { ZERO_VC } from '../../core/economy/vacoin';
import type { Furniture } from '../../core/sim/types';
import { isUnresolvedFurniture, resolveFurnitureRole } from '../decor-roles';

const base = {
  id: 1, x: 1, y: 1, w: 1, h: 1, seats: 0, label: '', price: ZERO_VC, quality: 100,
  condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false,
  zoneId: 'gaming', occupants: [], mods: [], reels: 3, baseBet: ZERO_VC,
} satisfies Omit<Furniture, 'kind'>;

describe('stabile Renderrollen', () => {
  it('löst bekannte Geräte über gameId auf', () => {
    expect(resolveFurnitureRole({ ...base, kind: 'SLOT', gameId: 'SLOT' } as Furniture)?.role).toBe('SLOT');
    expect(resolveFurnitureRole({ ...base, kind: 'TABLE', gameId: 'BLACKJACK' } as Furniture)?.asset).toContain('blackjack');
  });

  it('löst Wohnungsmöbel über exakte Labels auf', () => {
    expect(resolveFurnitureRole({ ...base, kind: 'DECOR', label: 'Eigenes Bett' } as Furniture)?.role).toBe('BED');
    expect(resolveFurnitureRole({ ...base, kind: 'DECOR', label: 'Sofa' } as Furniture)?.role).toBe('SOFA');
  });

  it('rät bei unbekannten Labels keine Rolle und markiert den unaufgelöste Fläche', () => {
    const unknown = { ...base, kind: 'DECOR' as const, label: 'Mysteriöses Dings' } as Furniture;
    expect(resolveFurnitureRole(unknown)).toBeNull();
    expect(isUnresolvedFurniture(unknown)).toBe(true);
  });

  it('behandelt Label-Präfixe nicht als Treffer', () => {
    expect(resolveFurnitureRole({ ...base, kind: 'DECOR', label: 'Sofa deluxe' } as Furniture)).toBeNull();
  });
});
