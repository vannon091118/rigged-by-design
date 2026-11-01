/** Zentrale Bewegungs- und Warteschlangen-Logik für alle Entitäten. */

import type { Point, WorldState } from './types';
import { blockedTiles, findPath, isWalkable } from './pathfinding';
import type { PlayerRpgState } from './player-rpg';

export interface QueueableEntity {
  readonly id: number;
  readonly entityType: 'PLAYER' | 'GUEST' | 'STAFF' | 'FOREIGN_PLAYER';
  position: Point;
  path: Point[];
  pathIndex: number;
  queueIndex: number;
  targetStationId: string | null;
  state: EntityState;
  stateTicks: number;
  rpg?: PlayerRpgState;
}

type EntityState = 'IDLE' | 'MOVING' | 'QUEUING' | 'WORKING' | 'INTERACTING' | 'LEAVING';

export interface QueueStation {
  readonly id: string; readonly x: number; readonly y: number;
  readonly w: number; readonly h: number;
  readonly capacity: number; readonly queueCapacity: number;
  currentWorkers: QueueableEntity[];
  queue: QueueableEntity[];
  readonly interactionPoint: Point;
}

export function moveEntity(entity: QueueableEntity): boolean {
  if (entity.pathIndex >= entity.path.length) return true;
  entity.position = { ...entity.path[entity.pathIndex]! };
  entity.pathIndex += 1;
  return entity.pathIndex >= entity.path.length;
}

function generateRingSpots(center: Point, limit: number, size: number, blocked: Set<number>): Point[] {
  const spots: Point[] = [{ x: center.x, y: center.y }];
  const seen = new Set<number>([center.y * size + center.x]);
  for (let ring = 1; spots.length < limit && ring <= size; ring += 1) {
    for (let dy = -ring; dy <= ring && spots.length < limit; dy += 1) {
      const dx = ring - Math.abs(dy);
      for (const step of dx === 0 ? [0] : [-dx, dx]) {
        if (spots.length >= limit) break;
        const x = center.x + step; const y = center.y + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const key = y * size + x;
        if (seen.has(key) || !isWalkable(size, blocked, x, y)) continue;
        seen.add(key); spots.push({ x, y });
      }
    }
  }
  return spots;
}

export function calculateQueueSpot(world: WorldState, station: QueueStation, entity: QueueableEntity): Point {
  const blocked = blockedTiles(world.size, world.furniture);
  const baseSpots = generateRingSpots(station.interactionPoint, station.queueCapacity, world.size, blocked);
  let queuePos = Math.max(0, entity.queueIndex);
  if (entity.rpg) {
    queuePos = Math.max(0, queuePos - Math.floor(entity.rpg.perceptionLevel / 3));
  }
  return baseSpots[Math.min(queuePos, baseSpots.length - 1)] ?? station.interactionPoint;
}

function canStartWork(station: QueueStation): boolean {
  return station.currentWorkers.length < station.capacity;
}

export function enterStation(entity: QueueableEntity, station: QueueStation, world: WorldState): { started: boolean; queuePosition: number } {
  entity.targetStationId = station.id; entity.stateTicks = 0;
  if (canStartWork(station)) {
    station.currentWorkers.push(entity); entity.state = 'WORKING';
    return { started: true, queuePosition: -1 };
  }
  station.queue.push(entity); entity.queueIndex = station.queue.length - 1;
  entity.state = 'QUEUING';
  const spot = calculateQueueSpot(world, station, entity);
  entity.path = findPath(world.size, blockedTiles(world.size, world.furniture), entity.position, spot);
  entity.pathIndex = 0;
  return { started: false, queuePosition: entity.queueIndex };
}

export function tickWork(entity: QueueableEntity, station: QueueStation, workDurationTicks: number, onComplete: (entity: QueueableEntity, station: QueueStation) => void): void {
  if (entity.state !== 'WORKING') return;
  entity.stateTicks += 1;
  const enduranceBonus = entity.rpg ? Math.floor(entity.rpg.enduranceLevel / 5) : 0;
  const effectiveDuration = Math.max(1, workDurationTicks + enduranceBonus);
  if (entity.stateTicks < effectiveDuration) return;
  onComplete(entity, station);
  station.currentWorkers = station.currentWorkers.filter((e) => e.id !== entity.id);
  entity.state = 'IDLE'; entity.targetStationId = null; entity.stateTicks = 0;
  if (station.queue.length > 0) {
    const next = station.queue.shift()!;
    next.state = 'WORKING'; next.stateTicks = 0; next.queueIndex = -1;
    station.currentWorkers.push(next);
    station.queue.forEach((e, i) => { e.queueIndex = i; });
  }
}

export function leaveStation(entity: QueueableEntity, station: QueueStation): void {
  if (entity.state === 'WORKING') station.currentWorkers = station.currentWorkers.filter((e) => e.id !== entity.id);
  else if (entity.state === 'QUEUING') {
    station.queue = station.queue.filter((e) => e.id !== entity.id);
    station.queue.forEach((e, i) => { e.queueIndex = i; });
  }
  entity.state = 'IDLE'; entity.targetStationId = null; entity.stateTicks = 0;
  entity.queueIndex = -1; entity.path = []; entity.pathIndex = 0;
}

export function createStation(id: string, x: number, y: number, w: number, h: number, capacity: number, queueCapacity: number): QueueStation {
  return { id, x, y, w, h, capacity, queueCapacity, currentWorkers: [], queue: [], interactionPoint: { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) } };
}
