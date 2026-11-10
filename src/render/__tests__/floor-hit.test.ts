/**
 * @test-target: src/render/floor-hit.ts
 * @error-code: ERR-4017
 *
 * Ein Trefferpfad: Tiefe vor Array-Reihenfolge, Figur vor Moebel, Wand vor
 * Klick. Die Faelle sind die drei Beschwerden aus dem Betrieb: zwei Popups,
 * klickbare NPCs durch Waende, falsches Objekt bei Ueberlappung.
 */
import { describe, expect, it } from 'vitest';
import { pickHit, resolveHit, sightBlocked, type HitView } from '../floor-hit';

const view = (over: Partial<HitView> = {}): HitView => ({
  size: 12, furniture: [], guests: [], crates: [], stains: [], ...over,
});

describe('Floor-Treffer', () => {
  it('nimmt das vorderste Moebel statt des ersten im Snapshot', () => {
    const furniture = [
      { id: 1, x: 1, y: 1, w: 2, h: 2 },
      { id: 2, x: 1, y: 2, w: 2, h: 2 },
    ];
    const hit = resolveHit(view({ furniture }), { x: 2, y: 3 }, { x: 5, y: 5 });
    expect(hit).toMatchObject({ kind: 'furniture', id: 2 });
  });

  it('gibt dem Gast den Vorrang, wenn er vor dem Geraet steht', () => {
    const furniture = [{ id: 7, x: 2, y: 2, w: 1, h: 1 }];
    const guests = [{ id: 3, position: { x: 2, y: 3 } }];
    const hit = resolveHit(view({ furniture, guests }), { x: 2, y: 2 }, { x: 6, y: 6 });
    expect(hit?.kind).toBe('guest');
    expect(hit?.id).toBe(3);
  });

  it('blockiert ein Ziel hinter einer Wand, erlaubt aber das eigene Feld', () => {
    const layout = { edges: [{ axis: 'H' as const, x: 1, y: 2, kind: 'WALL' }, { axis: 'V' as const, x: 9, y: 0, kind: 'DOOR' }] };
    const guests = [{ id: 4, position: { x: 1, y: 0 } }];
    const behind = view({ guests, layout });
    expect(sightBlocked(behind, { x: 1, y: 4 }, { x: 1, y: 0 })).toBe(true);
    expect(resolveHit(behind, { x: 1, y: 1 }, { x: 1, y: 4 })).toBeNull();
    // Aus der Naehe ist derselbe Gast erreichbar: keine Wand zwischen beiden.
    expect(resolveHit(behind, { x: 1, y: 1 }, { x: 1, y: 1 })?.id).toBe(4);
  });

  it('entscheidet Gleichstand deterministisch ueber Rang und ID', () => {
    expect(pickHit([
      { kind: 'furniture', id: 2, depth: 4, at: { x: 1, y: 1 } },
      { kind: 'furniture', id: 1, depth: 4, at: { x: 1, y: 1 } },
    ])?.id).toBe(1);
    expect(pickHit([
      { kind: 'stain', id: 9, depth: 4, at: { x: 1, y: 1 } },
      { kind: 'guest', id: 9, depth: 4, at: { x: 1, y: 1 } },
    ])?.kind).toBe('guest');
  });

  it('meldet ausserhalb des Bodens keinen Treffer', () => {
    expect(resolveHit(view(), { x: -1, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(resolveHit(view(), { x: 12, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('nimmt die Kiste vor dem Gast und gibt ihren Fussanker zurueck', () => {
    const crates = [{ id: 8, x: 3, y: 3 }];
    const guests = [{ id: 9, position: { x: 3, y: 2 } }];
    const hit = resolveHit(view({ crates, guests }), { x: 3, y: 3 }, { x: 6, y: 6 });
    expect(hit).toMatchObject({ kind: 'crate', id: 8, at: { x: 3.5, y: 3.5 } });
  });

  it('haelt eine Kiste hinter einer Wand zurueck, die Kiste davor aber klickbar', () => {
    const layout = { edges: [{ axis: 'H' as const, x: 1, y: 2, kind: 'WALL' }] };
    const crates = [{ id: 10, x: 1, y: 0 }];
    expect(resolveHit(view({ crates, layout }), { x: 1, y: 0 }, { x: 1, y: 4 })).toBeNull();
    expect(resolveHit(view({ crates, layout }), { x: 1, y: 0 }, { x: 1, y: 1 })?.id).toBe(10);
  });
});
