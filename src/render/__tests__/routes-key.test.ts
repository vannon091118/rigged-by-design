/**
 * @test-target: src/render/floor-route.ts
 * @error-code: ERR-2001
 *
 * Der Laufweg-Cache haengt an der Zonengeometrie. Ein Layout-Import mit
 * gleicher Zonenzahl, aber verschobener Zone muss den Schluessel aendern.
 */
import { describe, expect, it } from 'vitest';
import { routesKey } from '../floor-route';
import type { LayoutZone } from '../../core/sim/layout-types';
import type { GameView } from '../../store/types';

function viewWith(zones: readonly LayoutZone[]): GameView {
  return {
    template: 'MEDIUM', carpet: 'red', scene: { kind: 'OWN' }, zones,
  } as unknown as GameView;
}

const zone = (x: number): LayoutZone => ({
  id: 'z1', kind: 'ENTRANCE', name: 'Eingang', x, y: 2, w: 6, h: 4, color: 0x888888,
});

describe('Laufweg-Schluessel', () => {
  it('aendert sich bei verschobener Zone gleicher Anzahl', () => {
    expect(routesKey(viewWith([zone(2)]))).not.toBe(routesKey(viewWith([zone(3)])));
  });

  it('aendert sich bei skalierter Zone', () => {
    expect(routesKey(viewWith([zone(2)]))).not.toBe(routesKey(viewWith([{ ...zone(2), w: 8 }])));
  });

  it('bleibt bei gleicher Geometrie stabil', () => {
    expect(routesKey(viewWith([zone(2)]))).toBe(routesKey(viewWith([zone(2)])));
  });
});
