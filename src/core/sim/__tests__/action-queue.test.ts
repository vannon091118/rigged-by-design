/**
 * @test-target: src/core/sim/action-queue.ts
 * @error-code: ERR-4019
 *
 * Die Auftragskette bleibt simulationsseitig: ein Wischer wird hoechstens
 * einmal erzeugt, Auftraege werden seriell abgearbeitet und ein abgebrochener
 * Auftrag gibt den naechsten frei.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import {
  cancelTask, enqueueTask, normalizeActionQueue, tickActionQueue,
} from '../action-queue';
import { createWorld } from '../templates';
import type { WorldState } from '../types';
import { interactionPoint } from '../world';

function still(world: WorldState): void {
  world.player.path = [];
  world.player.pathIndex = 0;
}

describe('Auftragskette', () => {
  it('nimmt einen freien Wischer auf und schliesst den Auftrag ab', () => {
    const world = createWorld('SMALL');
    world.furniture = [];
    world.stains = [];
    world.mops = [];
    world.player.position = { x: 10, y: 10 };
    still(world);
    world.mops.push({ id: 1, x: 10, y: 10, carriedBy: null, usesLeft: 5 });

    const task = enqueueTask(world, { kind: 'GET_MOP' });
    tickActionQueue(world, new Ledger());

    expect(task.status).toBe('COMPLETED');
    expect(world.player.carrying).toBe('MOP:1');
  });

  it('reinigt ueber Arbeitstakte und bringt den Wischer zur Toilette zurueck', () => {
    const world = createWorld('SMALL');
    const toilet = world.furniture.find((item) => item.kind === 'TOILET')!;
    const spot = interactionPoint(world, toilet)!;
    world.furniture = [toilet];
    world.guests = [];
    world.crates = [];
    world.stains = [{
      id: 7, x: spot.x, y: spot.y, dirtValue: 10, influenceRadius: 1,
      removeDurationTicks: 1, ticksRemaining: 0, createdAt: 0,
    }];
    world.mops = [{ id: 1, x: spot.x, y: spot.y, carriedBy: null, usesLeft: 5 }];
    world.player.position = { ...spot };
    still(world);

    const task = enqueueTask(world, { kind: 'CLEAN_STAIN', target: { kind: 'stain', id: 7 } });
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(500) });
    for (let tick = 0; tick < 8 && task.status === 'ACTIVE'; tick += 1) {
      tickActionQueue(world, ledger);
    }

    expect(task.status).toBe('COMPLETED');
    expect(world.stains).toEqual([]);
    expect(world.player.carrying).toBe('');
  });

  it('erzeugt beim Wischerholen nicht bei jedem Tick einen neuen Wischer', () => {
    const world = createWorld('SMALL');
    world.mops = [];

    const task = enqueueTask(world, { kind: 'GET_MOP' });
    for (let tick = 0; tick < 80 && task.status === 'ACTIVE'; tick += 1) {
      tickActionQueue(world, new Ledger());
    }

    expect(world.mops).toHaveLength(1);
    expect(world.nextMopId).toBe(2);
  });

  it('gibt nach einem Abbruch den naechsten Auftrag frei und normalisiert den Save', () => {
    const world = createWorld('SMALL');
    const first = enqueueTask(world, { kind: 'MOVE', point: { x: 2, y: 2 } });
    const second = enqueueTask(world, { kind: 'MOVE', point: { x: 3, y: 3 } });

    expect(first.status).toBe('ACTIVE');
    expect(second.status).toBe('QUEUED');
    expect(cancelTask(world, first.id)).toBe(true);
    expect(second.status).toBe('ACTIVE');
    expect(cancelTask(world, 'task-999')).toBe(false);

    second.status = 'QUEUED';
    const restored = normalizeActionQueue(JSON.parse(JSON.stringify(world.actionQueue)));
    expect(restored.tasks[0]?.status).toBe('ACTIVE');
    expect(restored.nextId).toBe(3);
  });
});
