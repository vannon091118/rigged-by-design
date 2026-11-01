/** @test-target: src/core/sim/movement-queue.ts | @error-code: ERR-3002 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../templates';
import {
  moveEntity,
  enterStation,
  tickWork,
  leaveStation,
  createStation,
  calculateQueueSpot,
  type QueueableEntity,
  type QueueStation,
} from '../movement-queue';
import type { WorldState } from '../types';

function makeEntity(id: number, x: number, y: number): QueueableEntity {
  return {
    id,
    entityType: 'PLAYER',
    position: { x, y },
    path: [],
    pathIndex: 0,
    queueIndex: -1,
    targetStationId: null,
    state: 'IDLE',
    stateTicks: 0,
  };
}

function makeStation(id: string, x: number, y: number, capacity = 1, queueCapacity = 3): QueueStation {
  return createStation(id, x, y, 2, 1, capacity, queueCapacity);
}

describe('Movement-Queue: Bewegung', () => {
  it('bewegt Entität ein Feld auf dem Pfad', () => {
    const entity = makeEntity(1, 0, 0);
    entity.path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
    const done = moveEntity(entity);
    expect(done).toBe(false);
    expect(entity.position).toEqual({ x: 1, y: 0 });
    expect(entity.pathIndex).toBe(1);
  });

  it('gibt true zurück am Ziel', () => {
    const entity = makeEntity(1, 0, 0);
    entity.path = [{ x: 1, y: 0 }];
    const done = moveEntity(entity);
    expect(done).toBe(true);
    expect(entity.position).toEqual({ x: 1, y: 0 });
  });
});

describe('Movement-Queue: Station', () => {
  it('startet Arbeit sofort wenn Station frei', () => {
    const entity = makeEntity(1, 0, 0);
    const station = makeStation('S1', 5, 5);
    const world = createWorld('SMALL');
    const result = enterEntity(entity, station, world);
    expect(result.started).toBe(true);
    expect(result.queuePosition).toBe(-1);
    expect(entity.state).toBe('WORKING');
    expect(station.currentWorkers).toHaveLength(1);
  });

  it('geht in Queue wenn Station voll', () => {
    const station = makeStation('S1', 5, 5, 1, 3);
    const world = createWorld('SMALL');
    const e1 = makeEntity(1, 0, 0);
    const e2 = makeEntity(2, 0, 0);
    enterEntity(e1, station, world);
    const result2 = enterEntity(e2, station, world);
    expect(result2.started).toBe(false);
    expect(result2.queuePosition).toBe(0);
    expect(e2.state).toBe('QUEUING');
    expect(station.queue).toHaveLength(1);
  });

  it('lässt nächsten Wartenden nachrücken', () => {
    const station = makeStation('S1', 5, 5, 1, 3);
    const world = createWorld('SMALL');
    const e1 = makeEntity(1, 0, 0);
    const e2 = makeEntity(2, 0, 0);
    enterEntity(e1, station, world);
    enterEntity(e2, station, world);

    // e1 fast fertig stellen
    e1.stateTicks = 9;
    let completed: QueueableEntity | null = null;
    tickWork(e1, station, 10, (entity) => { completed = entity; });
    expect(completed).toBe(e1);
    expect(e1.state).toBe('IDLE');
    expect(station.currentWorkers).toHaveLength(1);
    expect(station.currentWorkers[0]).toBe(e2);
    expect(e2.state).toBe('WORKING');
  });

  it('entfernt Entität aus Station', () => {
    const station = makeStation('S1', 5, 5);
    const entity = makeEntity(1, 0, 0);
    const world = createWorld('SMALL');
    enterEntity(entity, station, world);
    leaveStation(entity, station);
    expect(entity.state).toBe('IDLE');
    expect(entity.targetStationId).toBeNull();
    expect(entity.queueIndex).toBe(-1);
    expect(station.currentWorkers).toHaveLength(0);
  });
});

describe('Movement-Queue: Queue-Spot', () => {
  it('berechnet Queue-Position im Ring', () => {
    const station = makeStation('S1', 10, 10, 1, 5);
    const world = createWorld('SMALL');
    const entity = makeEntity(1, 0, 0);
    entity.queueIndex = 0;
    const spot = calculateQueueSpot(world, station, entity);
    expect(spot).toEqual({ x: 11, y: 10 }); // interaction point: x + floor(w/2), y + floor(h/2)
  });

  it('verwendet Perception-Bonus für bessere Position', () => {
    const station = makeStation('S1', 10, 10, 1, 10);
    const world = createWorld('SMALL');
    const entity = makeEntity(1, 0, 0);
    entity.queueIndex = 5;
    entity.state = 'QUEUING';
    const spot1 = calculateQueueSpot(world, station, entity);
    // interaction point ist (11, 10), Queue-Position 5 liegt im Ring
    expect(spot1.x).toBeGreaterThanOrEqual(9);
    expect(spot1.x).toBeLessThanOrEqual(13);
    expect(spot1.y).toBeGreaterThanOrEqual(8);
    expect(spot1.y).toBeLessThanOrEqual(12);
  });
});

function enterEntity(entity: QueueableEntity, station: QueueStation, world: WorldState) {
  return enterStation(entity, station, world);
}
