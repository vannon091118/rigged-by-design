/**
 * @module actor-continuity — Kontinuitaet von Akteuren ueber Raum- und Gebaeudegrenzen hinweg
 */

import type { DayPlan, NpcLODLevel, NpcNeeds } from './npc-types';
import { computeLODLevel, createDefaultNeeds } from './npc-needs';
import { createDayPlan } from './npc-schedule';
import type { SpatialContextKind, TransitionDoor } from './room-transition';

export interface ActorContinuityRecord {
  readonly actorId: string;
  readonly name: string;
  readonly currentContext: SpatialContextKind;
  readonly buildingId: string | null;
  readonly position: { readonly x: number; readonly y: number };
  readonly needs: NpcNeeds;
  readonly dayPlan: DayPlan;
  readonly lodLevel: NpcLODLevel;
  readonly relationships: Readonly<Record<string, number>>;
  readonly inventory: readonly string[];
}

export function createActorContinuityRecord(params: {
  readonly actorId: string;
  readonly name: string;
  readonly currentContext: SpatialContextKind;
  readonly buildingId?: string | null;
  readonly position?: { readonly x: number; readonly y: number };
  readonly needs?: Partial<NpcNeeds>;
  readonly homeBuildingId?: string;
  readonly workBuildingId?: string;
  readonly relationships?: Record<string, number>;
  readonly inventory?: readonly string[];
}): ActorContinuityRecord {
  const dayPlan = createDayPlan(
    params.actorId,
    params.homeBuildingId ?? 'apt_player',
    params.workBuildingId ?? 'bld_office_01'
  );

  return {
    actorId: params.actorId,
    name: params.name,
    currentContext: params.currentContext,
    buildingId: params.buildingId ?? null,
    position: params.position ?? { x: 0, y: 0 },
    needs: createDefaultNeeds(params.needs),
    dayPlan,
    lodLevel: 'ACTIVE',
    relationships: params.relationships ?? {},
    inventory: params.inventory ?? [],
  };
}

export function transferActorAcrossDoor(
  record: ActorContinuityRecord,
  door: TransitionDoor
): ActorContinuityRecord {
  if (door.locked) {
    return record;
  }

  return {
    ...record,
    currentContext: door.targetContext,
    buildingId: door.targetBuildingId,
    position: {
      x: door.targetPosition.x,
      y: door.targetPosition.y,
    },
  };
}

export function syncActorSpatialLOD(
  record: ActorContinuityRecord,
  playerContext: SpatialContextKind,
  playerPosition: { readonly x: number; readonly y: number }
): ActorContinuityRecord {
  const sameContext = record.currentContext === playerContext;
  const sameBuilding = Boolean(
    sameContext &&
    record.buildingId !== null &&
    record.buildingId !== undefined &&
    record.currentContext === 'INTERIOR'
  );

  let distance = 999;
  if (sameContext) {
    const dx = record.position.x - playerPosition.x;
    const dy = record.position.y - playerPosition.y;
    distance = Math.sqrt(dx * dx + dy * dy);
  }

  const newLOD = computeLODLevel(distance, sameBuilding);

  if (newLOD === record.lodLevel) {
    return record;
  }

  return {
    ...record,
    lodLevel: newLOD,
  };
}
