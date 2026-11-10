/**
 * @test-target: src/render/floor-input.ts
 * @error-code: ERR-3001
 *
 * Ein Klick, ein Ergebnis: Maus und Finger teilen den Trefferpfad, die
 * Zoomstufe aendert die Bedeutung des Bodens nicht, ein Doppelklick erzeugt
 * keinen zweiten Auftrag.
 */
import type { Application, Container } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { TILE } from '../../core/sim/types';
import type { GameView } from '../../store/types';
import { acceptTap, handleTap, screenAnchorOf, screenPoint } from '../floor-input';

const cues = () => ({ ping: vi.fn() });

function view(over: Record<string, unknown> = {}): GameView {
  return {
    size: 12,
    player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
    furniture: [],
    guests: [],
    crates: [],
    stains: [],
    ...over,
  } as unknown as GameView;
}

const at = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

describe('Ein Trefferpfad', () => {
  it('liefert fuer einen Gast genau ein Ziel, eine Karte und den Fussanker', () => {
    const ping = cues();
    const result = handleTap(0, at(5, 5), view({ guests: [{ id: 3, position: { x: 5, y: 5 } }] }), ping);

    expect(result?.target).toEqual({ kind: 'guest', id: 3 });
    expect(result?.actions.map((action) => action.id)).toContain('TALK');
    expect(result?.at).toEqual({ x: 5.5 * TILE, y: 5.5 * TILE });
    expect(ping.ping).toHaveBeenCalledTimes(1);
  });

  it('erkennt eine Kiste als Ziel und nicht als leeren Boden', () => {
    const result = handleTap(0, at(6, 4), view({
      crates: [{ id: 9, payload: { kind: 'DRINKS', count: 1 }, x: 6, y: 4, carriedBy: null }],
    }), cues());

    expect(result?.target).toEqual({ kind: 'crate', id: 9 });
    expect(result?.actions[0]).toMatchObject({ id: 'PICKUP_CRATE', enabled: true });
  });

  it('behandelt leeren Boden immer als Laufziel, unabhaengig von der Zoomstufe', () => {
    const result = handleTap(0, at(4, 4), view(), cues());
    expect(result?.target).toEqual({ kind: 'floor', x: 4, y: 4 });
    expect(result?.actions).toEqual([]);
  });

  it('klickt nicht durch eine Wand auf einen Gast', () => {
    const layout = { edges: [{ axis: 'H' as const, x: 5, y: 3, kind: 'WALL' }] };
    const result = handleTap(0, at(5, 2), view({
      player: { position: { x: 5, y: 4 }, path: [], pathIndex: 0, carrying: '' },
      guests: [{ id: 4, position: { x: 5, y: 2 } }],
      layout,
    }), cues());
    expect(result?.target.kind).toBe('floor');
  });
});

describe('Doppelklick', () => {
  it('nimmt denselben Treffer nur einmal und danach wieder an', () => {
    expect(acceptTap(null, 'guest:3', 1000)).toBe(true);
    const mark = { key: 'guest:3', at: 1000 };
    expect(acceptTap(mark, 'guest:3', 1200)).toBe(false);
    expect(acceptTap(mark, 'guest:3', 1320)).toBe(true);
    expect(acceptTap(mark, 'furniture:3', 1001)).toBe(true);
  });
});

describe('Kamera und Treffer', () => {
  const app = {
    canvas: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }) },
    screen: { width: 800, height: 600 },
  } as unknown as Application;

  it('rechnet Zoom und Schwenk hin und zurueck, ohne die Position zu verfaelschen', () => {
    const camera = { x: -120, y: -80, scale: { x: 2.4, y: 2.4 } } as unknown as Container;
    const point = { x: 300, y: 220 };
    const anchor = screenAnchorOf(point, app, camera);
    const back = screenPoint(anchor!.x, anchor!.y, app, camera);

    expect(back!.x).toBeCloseTo(point.x, 6);
    expect(back!.y).toBeCloseTo(point.y, 6);
  });
});
