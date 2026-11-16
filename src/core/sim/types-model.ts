/** Welttypen ohne den Weltzustand selbst. */

import type { VaCoinMicro } from '../economy/vacoin';

import type { SlotMemory } from '../games/slot-transparency';

import type { SlotProfile } from '../games/slot-profile';

import type { BuildId } from './offers';


import type { VisitorMemory } from './narrative/types';

import type { TraitState } from './city-types';

import type { LayoutState, LayoutZone, ZoneKind } from './layout-types';
import type { StaffQualification } from './staff-qualification';
import type { JobStationDef } from './player-state';

export type { JobStationDef, OwnedProperty, Player, PlayerJobState, PlayerJobTask, PlayerNeeds } from './player-state';



/** Spielbedeutung einer Zone; der Layout-Vertrag ist ihre einzige Definition. */

export type { ZoneKind };



export type StaffRole = 'guard' | 'cleaner' | 'bartender' | 'cashier' | 'porter';

export type TemplateId = 'SMALL' | 'MEDIUM' | 'LARGE';

export type DemandTier = 'BUDE' | 'KASSE' | 'SAAL' | 'KONZERN';

export type DemandEventKind = 'NEON_NACHT' | 'TURNIER_ABEND';

export const RIVAL_IDS = ['HAFENKLAUSE', 'GOLDENE_HAND', 'NEBELPALAST'] as const;

export type RivalId = (typeof RIVAL_IDS)[number];

export type PlayerJobId = 'CLEANER' | 'BARTENDER' | 'CARD_DEALER' | 'MECHANIC';

export type JobTaskType = 'CLEAN' | 'SERVE' | 'DEAL' | 'REPAIR';



export interface DemandSource { readonly id: string; readonly label: string; readonly perDay: number; }

export interface DemandSnapshot {

  readonly perDay: number; readonly sources: readonly DemandSource[];

  readonly nextArrivalIn: number;

  readonly event: { readonly kind: DemandEventKind; readonly label: string; readonly ticksLeft: number } | null;

}



export type GameId = 'SLOT' | 'BLACKJACK' | 'POKER' | 'VIDEO_POKER' | 'ROULETTE' | 'PLINKO' | 'SHELL' | 'DICE';

type GuestState = 'ENTER' | 'EXCHANGE' | 'CHOOSE' | 'WAIT' | 'PLAY' | 'DRINK' | 'TOILET' | 'CASHOUT' | 'LEAVE' | 'ANGRY';

type Need = 'play' | 'drink' | 'toilet';

export type PersonaId = 'LUMPEN' | 'STREET' | 'BUSINESS' | 'HIGH_ROLLER' | 'STAMMGAST';

export type CarpetId = 'VIOLET' | 'CRIMSON' | 'JADE' | 'GOLD';

export type ModId = 'NEON' | 'NEAR_MISS' | 'CHERRY' | 'FREE_DRINK' | 'EXTRA_REEL' | 'VELVET';



export interface Point { readonly x: number; readonly y: number; }

/** Legacy-Sicht der semantischen Zone; die Wahrheit liegt in `LayoutState.zones`. */

export type Zone = LayoutZone;

export interface Furniture {

  readonly id: number;

  readonly kind: 'SLOT' | 'TABLE' | 'BAR' | 'TOILET' | 'EXCHANGE' | 'DECOR' | 'STORAGE' | 'JOB_STATION';

  readonly gameId?: GameId; readonly x: number; readonly y: number; readonly w: number; readonly h: number;

  readonly seats: number; readonly label: string; readonly price: VaCoinMicro; readonly quality: number;
  /** Stabile Kunst-ID fuer Sondermoebel (z. B. Wohnung); Renderrollen lesen sie zuerst. */
  readonly artId?: string;

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

export interface ForeignFloorState {

  readonly id: number; readonly rivalId: RivalId; readonly size: number;

  zones: Zone[]; furniture: Furniture[];

  readonly jobStations: readonly JobStationDef[];

  /** Der fremde Floor traegt seinen eigenen Plan, nicht nur seine Groesse. */

  layout?: LayoutState; template?: TemplateId; guests?: Guest[];

  playerPosition: Point | null; playerPath: Point[]; playerPathIndex: number;

  playerCarrying: string; day: number; lastPaidDay: number;

}

export type PropertyId = 'GEWERBERAUM' | 'KNEIPE' | 'SPIELSALON';

/** Eigentum als Datensatz: welche Immobilie, zu welchem Preis, an welchem Tag. */

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
  /** Qualifikationsstufe des Agenten; sie bestimmt Lohn und Bewertung. */
  qualification: StaffQualification;

}

export interface Dispute {

  id: number; guestIds: number[]; x: number; y: number; level: number; ticks: number;

}

export type { FightFx } from './fight-fx';

/** Verbindlicher Issue-Lebenszyklus (Issue #920). Jeder Zustand hat exakt ein zustand-*-Label. */
export type IssueLifeCycle =
  | 'OPEN_UNTRIAGED'
  | 'OPEN_READY'
  | 'OPEN_CLAIMED'
  | 'OPEN_IN_PROGRESS'
  | 'OPEN_BLOCKED'
  | 'OPEN_REVIEW'
  | 'OPEN_WAITING'
  | 'CLOSED_COMPLETED'
  | 'CLOSED_NOT_PLANNED'
  | 'CLOSED_DUPLICATE';

/** Beleg fuer einen Issue-Closeout (Issue #920, Regel 4). */
export interface CloseoutEvidence {
  readonly prNumber: number | null;
  readonly prHeadSha: string | null;
  readonly prMergedSha: string | null;
  readonly acceptanceCriteriaMet: boolean;
  readonly metBy: string;
  readonly authorizedBy: string;
  readonly remainingPoints: string | null;
  readonly followUpIssue: number | null;
}

/** Zustandsuebergang im Issue-Lebenszyklus (Issue #920). */
export interface IssueStateTransition {
  readonly from: IssueLifeCycle;
  readonly to: IssueLifeCycle;
  readonly actor: string;
  readonly actorRole: 'maintainer' | 'user' | 'worker';
  readonly at: string;
  readonly evidence: CloseoutEvidence | null;
}

/** Identitaetsgebundenes ID-Postfach (Issue #920, Abschnitt B). */
export interface MailboxMessage {
  readonly messageId: string;
  readonly issueNumber: number | null;
  readonly prNumber: number | null;
  readonly commentId: number | null;
  readonly sender: string;
  readonly senderRole: 'maintainer' | 'user' | 'worker';
  readonly recipient: string;
  readonly recipientRole: 'maintainer' | 'user' | 'worker';
  readonly sessionId: string | null;
  readonly type: 'requirement' | 'decision' | 'claim' | 'progress' | 'finding' | 'blocker' | 'acceptance';
  readonly expectedAction: string | null;
  readonly status: 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'REJECTED';
  readonly nextActor: string | null;
  readonly timestamp: string;
  readonly cursor: number;
  readonly read: boolean;
}

export interface Visitor {

  readonly id: number; readonly name: string; readonly persona: PersonaId;

    /**
   * Stabile Kennung, wenn dieses Profil einem Stadtbewohner gehoert. Sie ist
   * die Identitaet, der Name nur Anzeige: Ein Gast mit demselben Namen bleibt
   * ein anderer Mensch. Veraenderbar nur fuer die einmalige Adoption eines
   * alten Saves ohne Kennung.
   */
  residentNpcId?: string;

  visits: number; lastSeenTick: number; experience?: number;

  /** Strukturierte Erinnerungen aus abgeschlossenen Besuchen; begrenzt. */

  memories?: VisitorMemory[];

  /** Charisma und Intelligenz steuern Redseligkeit und Gewinnfilter. */

  charisma?: number; intellect?: number;

  /** Laster verstaerken Trait-Entwicklung (0..10). */

  vice?: number;

  /** Entwickelbare Eigenschaften; nur benannte Stadt-NPCs tragen sie. */

  traits?: TraitState[];

}

