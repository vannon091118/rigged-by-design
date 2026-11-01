/** Welttypen ohne den Weltzustand selbst. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { SlotMemory } from '../games/slot-transparency';
import type { SlotProfile } from '../games/slot-profile';
import type { BuildId } from './offers';
import type { PlayerRpgState } from './player-rpg';
import type { VisitorMemory } from './narrative/types';

export type StaffRole = 'guard' | 'cleaner' | 'bartender' | 'cashier' | 'porter';
export type TemplateId = 'SMALL' | 'MEDIUM' | 'LARGE';
export type DemandTier = 'BUDE' | 'KASSE' | 'SAAL' | 'KONZERN';
export type DemandEventKind = 'NEON_NACHT' | 'TURNIER_ABEND';
export type RivalId = 'HAFENKLAUSE' | 'GOLDENE_HAND' | 'NEBELPALAST';
export type PlayerJobId = 'CLEANER' | 'BARTENDER' | 'CARD_DEALER' | 'MECHANIC';
export type JobTaskType = 'CLEAN' | 'SERVE' | 'DEAL' | 'REPAIR';

export interface DemandEvent { kind: DemandEventKind; untilTick: number; }
export interface DemandSource { readonly id: string; readonly label: string; readonly perDay: number; }
export interface DemandSnapshot {
  readonly perDay: number; readonly sources: readonly DemandSource[];
  readonly nextArrivalIn: number;
  readonly event: { readonly kind: DemandEventKind; readonly label: string; readonly ticksLeft: number } | null;
}

type ZoneKind = 'ENTRANCE' | 'EXCHANGE' | 'GAMING' | 'BAR' | 'TOILET' | 'STORAGE' | 'LOUNGE' | 'EXPANSION';
export type GameId = 'SLOT' | 'BLACKJACK' | 'POKER' | 'VIDEO_POKER' | 'ROULETTE' | 'PLINKO' | 'SHELL' | 'DICE';
type GuestState = 'ENTER' | 'EXCHANGE' | 'CHOOSE' | 'WAIT' | 'PLAY' | 'DRINK' | 'TOILET' | 'CASHOUT' | 'LEAVE' | 'ANGRY';
type Need = 'play' | 'drink' | 'toilet' | 'social';
export type PersonaId = 'LUMPEN' | 'STREET' | 'BUSINESS' | 'HIGH_ROLLER' | 'STAMMGAST';
export type CarpetId = 'VIOLET' | 'CRIMSON' | 'JADE' | 'GOLD';
export type ModId = 'NEON' | 'NEAR_MISS' | 'CHERRY' | 'FREE_DRINK' | 'EXTRA_REEL' | 'VELVET';

export interface Point { readonly x: number; readonly y: number; }
export interface Zone {
  readonly id: string; readonly name: string; readonly kind: ZoneKind;
  readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: number;
}
export interface Furniture {
  readonly id: number;
  readonly kind: 'SLOT' | 'TABLE' | 'BAR' | 'TOILET' | 'EXCHANGE' | 'DECOR' | 'STORAGE' | 'JOB_STATION';
  readonly gameId?: GameId; readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly seats: number; readonly label: string; readonly price: VaCoinMicro; readonly quality: number;
  condition: number; damaged: boolean; dirt: number; stock: number; clog: number; clogged: boolean;
  readonly zoneId: string; occupants: number[]; mods: ModId[]; reels: number; baseBet: VaCoinMicro;
  slotMemory?: SlotMemory; slotOdds?: SlotProfile;
}
export interface Guest {
  readonly id: number; readonly name: string; readonly persona: PersonaId;
  mood: number; patience: number; addiction: number;
  talkReadyTick?: number; visitorId?: number; sociability: number;
  thirst: number; bladder: number; disputeId: number | null;
  state: GuestState; stateTicks: number; position: Point; path: Point[]; pathIndex: number;
  targetFurniture: number; targetZone: string; queueIndex: number; need: Need;
  anger: number; dirtTimer: number; lastResult: string; spins: number; intent?: string;
}
export interface PlayerJobState {
  readonly jobId: PlayerJobId; readonly rivalId: RivalId; readonly stationId: string;
  currentTask: PlayerJobTask | null; workDays: number; lastPaidDay: number;
}
export interface PlayerJobTask {
  readonly stationId: string; readonly taskType: JobTaskType;
  ticksElapsed: number; readonly ticksTotal: number;
}
export interface JobStationDef {
  readonly id: string; readonly jobId: PlayerJobId; readonly x: number; readonly y: number;
  readonly w: number; readonly h: number; readonly label: string; readonly description: string;
}
export interface ForeignFloorState {
  readonly id: number; readonly rivalId: RivalId; readonly size: number;
  readonly zones: readonly Zone[]; readonly furniture: Furniture[];
  readonly jobStations: readonly JobStationDef[];
  playerPosition: Point | null; playerPath: Point[]; playerPathIndex: number;
  playerCarrying: string; day: number; lastPaidDay: number;
}
export interface Player {
  position: Point; path: Point[]; pathIndex: number; carrying: string; rpg: PlayerRpgState;
  job: PlayerJobState | null; barPurchased: boolean;
}
export interface ActivePenalty {
  readonly kind: 'UNSAFE_REPUTATION' | 'MOOD_SHOCK'; daysLeft: number;
}
export interface PriceBook {
  entryFee: VaCoinMicro; drinkPrice: VaCoinMicro; slotMinBet: VaCoinMicro;
  staffWage: VaCoinMicro; guardWage: VaCoinMicro; cashierWage: VaCoinMicro;
  porterWage: VaCoinMicro; cleaningCost: VaCoinMicro; repairCost: VaCoinMicro;
  partCost: VaCoinMicro; drinkCrateCost: VaCoinMicro; barUpgrade: VaCoinMicro; wcUpgrade: VaCoinMicro;
}
export interface StaffState {
  cleaner: boolean; bartender: boolean; cashier: boolean; porter: boolean;
}
export type CratePayload =
  | { kind: 'FURNITURE'; buildId: BuildId }
  | { kind: 'DRINKS'; count: number }
  | { kind: 'PARTS'; count: number };
export interface Crate {
  id: number; payload: CratePayload; x: number; y: number;
  carriedBy: number | 'player' | null;
}
export type StaffTask =
  | 'idle' | 'toCrate' | 'toBar' | 'toStorage' | 'toGuest' | 'toDispute'
  | 'cleaning' | 'cashier' | 'patrol' | 'serve';
export interface StaffAgent {
  id: number; role: StaffRole; x: number; y: number; path: Point[]; pathIndex: number;
  carryingCrate: number | null; workTicks: number; task: StaffTask;
  blockedReason: string; targetDisputeId: number | null;
}
export interface Dispute {
  id: number; guestIds: number[]; x: number; y: number; level: number; ticks: number;
}
export type { FightFx } from './fight-fx';
export interface Visitor {
  readonly id: number; readonly name: string; readonly persona: PersonaId;
  visits: number; lastSeenTick: number; experience?: number;
  /** Strukturierte Erinnerungen aus abgeschlossenen Besuchen; begrenzt. */
  memories?: VisitorMemory[];
}
