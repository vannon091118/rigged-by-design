/**
 * @test-target: src/render/city-actor-sync.ts
 * @error-code: ERR-1002
 *
 * sync() und animate() mit gestubbten Figuren: eine Figur je NPC-Kennung,
 * Snapshot-Position sofort, Bewegung nur im vorhandenen Tick und Tiefe aus
 * der tatsaechlich gerenderten Position (#731).
 */
import type { Container } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { TILE } from '../../core/sim/types';
import { CityActorSync } from '../city-actor-sync';
import type { DepthStage } from '../depth';

const artMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../guest-art', () => ({ createGuestArt: artMock.create }));

interface StubArt {
  root: {
    x: number; y: number; rotation: number; visible: boolean; destroyed: boolean;
    destroy: () => void;
  };
  sticker: { visible: boolean; position: { x: number; y: number; set: (x: number, y: number) => void } };
  from: { x: number; y: number };
  target: { x: number; y: number };
  moveStart: number;
  phase: number;
  facing: string;
  animated: number[];
  lods: boolean[];
  animate: (now: number) => void;
  setMood: () => void;
  setState: () => void;
  setNameVisible: () => void;
  setLod: (lod: boolean) => void;
  setFacing: (facing: string) => void;
}

function makeArt(): StubArt {
  const animated: number[] = [];
  const lods: boolean[] = [];
  const root = {
    x: 0, y: 0, rotation: 0, visible: false, destroyed: false,
    destroy: () => { root.destroyed = true; },
  };
  const sticker = {
    visible: true,
    position: { x: 0, y: 0, set: (x: number, y: number) => { sticker.position.x = x; sticker.position.y = y; } },
  };
  return {
    root, sticker, from: { x: 0, y: 0 }, target: { x: 0, y: 0 }, moveStart: 0, phase: 0, facing: 'down',
    animated, lods,
    animate: (now: number) => { animated.push(now); },
    setMood: () => undefined,
    setState: () => undefined,
    setNameVisible: () => undefined,
    setLod: (lod: boolean) => { lods.push(lod); },
    setFacing: (_facing: string) => undefined,
  };
}

const cityView = (actors: readonly { npcId: string; x: number; y: number; name?: string; traveling?: boolean }[]) => ({
  scene: { kind: 'CITY' },
  cityActors: actors.map((actor) => ({ name: 'Gast', traveling: false, ...actor })),
}) as unknown as GameView;

function harness() {
  const arts: StubArt[] = [];
  const added: unknown[] = [];
  const depth = { set: vi.fn() };
  artMock.create.mockImplementation(() => {
    const art = makeArt();
    arts.push(art);
    return art;
  });
  const sync = new CityActorSync({
    renderer: {} as never,
    world: { addChild: (child: unknown) => { added.push(child); } } as unknown as Container,
    depth: depth as unknown as DepthStage,
    stepMs: 520,
  });
  return { sync, arts, added, depth };
}

describe('CityActorSync · sync', () => {
  beforeEach(() => {
    artMock.create.mockReset();
  });

  it('setzt eine neue Figur sofort auf die Snapshot-Position und in die Tiefenebene', () => {
    const { sync, arts, added, depth } = harness();
    sync.sync(cityView([{ npcId: 'npc-1', x: 2, y: 3 }]), 1_000, 1);
    expect(arts).toHaveLength(1);
    expect(added).toEqual([arts[0]?.root]);
    expect(arts[0]?.root).toMatchObject({ x: 2.5 * TILE, y: 3.8 * TILE, visible: true });
    expect(arts[0]?.from).toMatchObject({ x: 2.5 * TILE, y: 3.8 * TILE });
    expect(arts[0]?.sticker.visible).toBe(false);
    expect(arts[0]?.lods).toEqual([true]);
    expect(depth.set).toHaveBeenCalledWith(arts[0]?.root, 3.8 * TILE, 'actor', expect.any(Number));
  });

  it('haelt dieselbe Figur ueber Ticks und Zielwechsel an der Kennung', () => {
    const { sync, arts } = harness();
    sync.sync(cityView([{ npcId: 'npc-1', x: 2, y: 3 }]), 1_000, 1);
    sync.sync(cityView([{ npcId: 'npc-1', x: 4, y: 3 }]), 1_520, 1);
    expect(artMock.create).toHaveBeenCalledTimes(1);
    expect(arts[0]?.from.x).toBe(2.5 * TILE);
    expect(arts[0]?.target.x).toBe(4.5 * TILE);
    expect(arts[0]?.moveStart).toBe(1_000);
  });

  it('entfernt verschwundene Bewohner und raeumt bei Nicht-CITY-Szenen auf', () => {
    const { sync, arts } = harness();
    sync.sync(cityView([{ npcId: 'npc-1', x: 2, y: 3 }]), 1_000, 1);
    sync.sync(cityView([]), 1_520, 1);
    expect(arts[0]?.root.destroyed).toBe(true);
    sync.sync(cityView([{ npcId: 'npc-2', x: 0, y: 0 }]), 2_040, 1);
    sync.sync({ scene: { kind: 'FLOOR' }, cityActors: [] } as unknown as GameView, 2_560, 1);
    expect(arts.every((art) => art.root.destroyed)).toBe(true);
  });
});

describe('CityActorSync · animate', () => {
  beforeEach(() => {
    artMock.create.mockReset();
  });

  it('interpoliert im vorhandenen Tick und endet exakt am Ziel', () => {
    const { sync, arts } = harness();
    sync.sync(cityView([{ npcId: 'npc-1', x: 2, y: 3 }]), 1_000, 1);
    sync.sync(cityView([{ npcId: 'npc-1', x: 4, y: 3 }]), 1_520, 1);
    sync.animate(1_260);
    expect(arts[0]?.root.x).toBeCloseTo(3.5 * TILE, 6);
    sync.animate(1_520);
    expect(arts[0]?.root.x).toBeCloseTo(4.5 * TILE, 6);
    expect(arts[0]?.root.y).toBeCloseTo(3.8 * TILE, 6);
    expect(arts[0]?.root.rotation).toBe(0);
    expect(arts[0]?.sticker.position).toMatchObject({ x: arts[0]?.root.x, y: arts[0]?.root.y });
    expect(arts[0]?.animated).toEqual([1_260, 1_520]);
  });
});
