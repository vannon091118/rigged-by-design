/**
 * @module npc-types — Kanonische Typen und Schnittstellen fuer autonome NPC-Simulation
 */

export type NpcIntentKind =
  | 'SLEEP'
  | 'WAKE_UP'
  | 'EAT_HOME'
  | 'EAT_OUT'
  | 'WORK'
  | 'LEISURE'
  | 'VISIT_FRIEND'
  | 'SHOP'
  | 'PUB'
  | 'COMMUTE'
  | 'IDLE';

export type NpcLODLevel = 'ACTIVE' | 'NEIGHBORHOOD' | 'OFFSCREEN' | 'ABSTRACT';

export interface NpcIntent {
  readonly kind: NpcIntentKind;
  readonly targetBuildingId?: string;
  readonly startHour: number;
  readonly durationHours: number;
  readonly priority: number;
}

export interface NpcNeeds {
  readonly hunger: number;
  readonly fatigue: number;
  readonly social: number;
  readonly money: number;
  readonly mood: number;
}

export interface NpcScheduleEntry {
  readonly startHour: number;
  readonly intent: NpcIntentKind;
  readonly targetBuildingId?: string;
}

export interface DayPlan {
  readonly npcId: string;
  readonly entries: readonly NpcScheduleEntry[];
}

export interface NpcLODState {
  readonly npcId: string;
  readonly level: NpcLODLevel;
  readonly buildingId: string | null;
  readonly positionApprox?: { readonly x: number; readonly y: number };
  readonly lastKnownHour: number;
}
