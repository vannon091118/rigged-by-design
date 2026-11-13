/**
 * @test-target: src/render/floor-props.ts
 * @error-code: ERR-2001
 *
 * Personal ist kein verschobener Wurzelknoten: Es bekommt Facing, Gang und
 * Tragepose, und eine getragene Kiste bleibt sichtbar am Traeger (#514).
 */
import { describe, expect, it } from 'vitest';
import { Container, Texture, type Renderer } from 'pixi.js';
import { TILE } from '../../core/sim/types';
import type { GameView } from '../../store/types';
import { DepthStage } from '../depth';
import { FloorProps } from '../floor-props';
import { primeGuestShadow } from '../guest-parts';

const RECT = { left: 0, top: 0, right: 30 * TILE, bottom: 30 * TILE };

// Der Schatten wird sonst beim ersten Bild gebacken; im Test reicht eine weisse Textur.
primeGuestShadow({ generateTexture: () => Texture.WHITE } as unknown as Renderer);

function setup() {
  const layers = {
    world: new Container(), overhead: new Container(), stickers: new Container(), depth: new DepthStage(),
  };
  const props = new FloorProps(layers, new Container(), () => undefined);
  return { layers, props };
}

function viewWith(agentX: number, carried: boolean): GameView {
  return {
    size: 30,
    layout: { size: 30 },
    furniture: [],
    player: { position: { x: 1, y: 1 } },
    guests: [],
    disputes: [],
    stains: [],
    mops: [],
    agents: [{
      id: 3, role: 'porter', x: agentX, y: 6,
      path: [{ x: 5, y: 6 }, { x: 6, y: 6 }], pathIndex: 0,
      carryingCrate: carried ? 7 : null, workTicks: 0,
      task: 'PORTER', blockedReason: '', targetDisputeId: null,
    }],
    crates: [{
      id: 7, payload: { kind: 'FURNITURE' }, x: 4, y: 4,
      carriedBy: carried ? 3 : null,
    }],
  } as unknown as GameView;
}

describe('Personal im Renderpfad', () => {
  it('zeigt eine getragene Kiste am Traeger statt sie auszublenden', () => {
    const { props } = setup();
    props.update(viewWith(5, true), RECT, 1);
    const art = props.agentArt(3)!;
    const crate = props.crateRoot(7)!;
    expect(crate.visible).toBe(true);
    expect(crate.x).toBeCloseTo(art.root.x - TILE / 2, 5);
    expect(crate.y).toBeCloseTo(art.root.y - TILE * 0.9, 5);
  });

  it('folgt dem Traeger auch waehrend der Bewegung', () => {
    const { props } = setup();
    props.update(viewWith(5, true), RECT, 1);
    props.walk(1000, 100);
    props.update(viewWith(7, true), RECT, 1);
    props.walk(2000, 100);
    const art = props.agentArt(3)!;
    const crate = props.crateRoot(7)!;
    expect(crate.visible).toBe(true);
    expect(crate.x).toBeCloseTo(art.root.x - TILE / 2, 5);
  });

  it('haelt eine abgelegte Kiste am Boden und sichtbar', () => {
    const { props } = setup();
    props.update(viewWith(5, false), RECT, 1);
    const crate = props.crateRoot(7)!;
    expect(crate.visible).toBe(true);
    expect(crate.x).toBeCloseTo(4 * TILE, 5);
  });

  it('animiert das Personal mit Facing statt nur den Wurzelknoten zu verschieben', () => {
    const { props } = setup();
    props.update(viewWith(5, false), RECT, 1);
    props.update(viewWith(8, false), RECT, 1);
    props.walk(500, 100);
    const art = props.agentArt(3)!;
    expect(art.facing).toBe('right');
    expect(art.root.rotation).not.toBe(0);
  });
});
