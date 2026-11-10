/**
 * @test-target: src/core/sim/interaction.ts
 * @error-code: ERR-4019
 *
 * Ein Ziel, ein Weg, eine Reichweite: die Figur laeuft zum Standplatz, statt zu
 * springen; eingebaute und eingemauerte Ziele nennen einen verstaendlichen Grund.
 */
import { describe, expect, it } from 'vitest';
import { INTERACTION_RADII, approachTarget, planInteraction, stopPlayer } from '../interaction';
import { nearestTarget } from '../interaction-nearest';
import { stepOpen } from '../nav-grid';
import { isWalkable } from '../pathfinding';
import { createWorld } from '../templates';
import type { Furniture, Guest, Point, WorldState } from '../types';
import { worldNav } from '../world';

function blocker(id: number, x: number, y: number, w = 1, h = 1): Furniture {
  return {
    id, kind: 'SLOT', x, y, w, h, seats: 1, label: 'Block', price: 0 as never, quality: 1,
    condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false, zoneId: 'gaming',
    occupants: [], mods: [], reels: 3, baseBet: 0 as never,
  };
}

function guest(id: number, x: number, y: number): Guest {
  return {
    id, name: 'Gast', persona: 'STREET', mood: 50, patience: 50, addiction: 0, sociability: 50,
    thirst: 0, bladder: 0, disputeId: null, state: 'CHOOSE', stateTicks: 0, position: { x, y },
    path: [], pathIndex: 0, targetFurniture: 0, targetZone: '', queueIndex: 0, need: 'play',
    anger: 0, dirtTimer: 0, lastResult: '', spins: 0,
  };
}

/** Ein freier, zusammenhaengender Block: keine Moebel und keine Wandkante dazwischen. */
function openWorld(width = 9, height = 9): { world: WorldState; base: Point } {
  const world = createWorld('SMALL');
  world.furniture = [];
  world.guests = [];
  world.crates = [];
  world.stains = [];
  const nav = worldNav(world);
  for (let y = 0; y <= world.size - height; y += 1) {
    for (let x = 0; x <= world.size - width; x += 1) {
      let ok = true;
      for (let dy = 0; dy < height && ok; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          const point = { x: x + dx, y: y + dy };
          const connected = (dx === 0 || stepOpen(nav, { x: point.x - 1, y: point.y }, point))
            && (dy === 0 || stepOpen(nav, { x: point.x, y: point.y - 1 }, point));
          if (!isWalkable(nav, point.x, point.y) || !connected) { ok = false; break; }
        }
      }
      if (ok) return { world, base: { x, y } };
    }
  }
  throw new Error('Kein freier Block im Blueprint');
}

describe('Annaeherung', () => {
  it('plant einen Weg und laesst die Figur stehen, statt sie zu teleportieren', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    world.player.path = [];
    world.furniture.push(blocker(10, base.x + 4, base.y + 3, 2, 1));
    const plan = approachTarget(world, { kind: 'furniture', id: 10 });

    expect(plan.reachable).toBe(true);
    expect(plan.path.length).toBeGreaterThan(1);
    expect(world.player.position).toEqual({ x: base.x + 1, y: base.y + 1 });
    expect(world.player.path).toEqual(plan.path);
    expect(plan.path.at(-1)).toEqual(plan.spot);
  });

  it('gilt erst auf dem Standplatz als in Reichweite', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    world.furniture.push(blocker(11, base.x + 5, base.y + 3, 2, 1));
    const focus = { kind: 'furniture' as const, id: 11 };

    expect(planInteraction(world, focus).inRange).toBe(false);
    world.player.position = planInteraction(world, focus).spot!;
    expect(planInteraction(world, focus).inRange).toBe(true);
  });

  it('nennt ein eingebautes Moebel als Grund statt still nichts zu tun', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    const x = base.x + 4;
    const y = base.y + 4;
    world.furniture.push(blocker(20, x, y), blocker(21, x - 1, y), blocker(22, x + 1, y),
      blocker(23, x, y - 1), blocker(24, x, y + 1));

    const plan = planInteraction(world, { kind: 'furniture', id: 20 });
    expect(plan.reachable).toBe(false);
    expect(plan.reason).toContain('Kein Zugang');
  });

  it('nennt einen versperrten Weg, wenn kein Standplatz erreichbar ist', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    const cx = base.x + 4;
    const cy = base.y + 4;
    world.guests.push(guest(1, cx, cy));
    let id = 30;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
        world.furniture.push(blocker(id++, cx + dx, cy + dy));
      }
    }

    const plan = planInteraction(world, { kind: 'guest', id: 1 });
    expect(plan.reachable).toBe(false);
    expect(plan.reason).toContain('Kein Weg');
  });

  it('kennt Kisten- und Fleck-Reichweiten aus derselben Tabelle', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    world.crates.push({ id: 7, payload: { kind: 'DRINKS', count: 1 }, x: base.x + 5, y: base.y + 1, carriedBy: null });
    world.stains.push({
      id: 8, x: base.x + 3, y: base.y + 1, dirtValue: 10, influenceRadius: 1,
      removeDurationTicks: 3, ticksRemaining: 0, createdAt: 0,
    });

    expect(planInteraction(world, { kind: 'crate', id: 7 }).reach).toBe(INTERACTION_RADII.CRATE);
    expect(planInteraction(world, { kind: 'stain', id: 8 }).reach).toBe(INTERACTION_RADII.STAIN);
    expect(planInteraction(world, { kind: 'crate', id: 999 }).reason).toContain('gibt es nicht mehr');
  });

  it('stoppt auf Wunsch ohne neuen Pfad', () => {
    const { world, base } = openWorld();
    world.player.path = [{ x: base.x + 2, y: base.y + 2 }];
    stopPlayer(world);
    expect(world.player.path).toEqual([]);
    expect(world.player.pathIndex).toBe(0);
  });
});

describe('Tasten-Ziel', () => {
  it('nimmt den Gast vor dem gleich nahen Moebel und ignoriert getragene Kisten', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    world.guests.push(guest(2, base.x + 1, base.y + 2));
    world.furniture.push(blocker(40, base.x + 2, base.y + 1));
    world.crates.push({ id: 41, payload: { kind: 'PARTS', count: 1 }, x: base.x + 1, y: base.y + 1, carriedBy: 'player' });

    expect(nearestTarget(world, world.player.position, 4)).toEqual({ kind: 'guest', id: 2 });
  });

  it('meldet ausserhalb der Reichweite kein Ziel', () => {
    const { world, base } = openWorld();
    world.player.position = { x: base.x + 1, y: base.y + 1 };
    expect(nearestTarget(world, world.player.position, 1)).toBeNull();
  });
});
