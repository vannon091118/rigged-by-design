/** Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. */
import type { PlinkoConfig, PlinkoDrop, PlinkoMode } from '../games/plinko-config';
import type { NarrativeState } from './narrative/types';
import type { JournalEvent } from './journal';
import type { PlayerLook } from './player-look';
import type { ExclusionPact } from './self-exclusion-bet';
import type {
  ActivePenalty, CarpetId, Crate, DemandTier, Dispute, Furniture, Guest, Player,
  PriceBook, StaffAgent, StaffState, TemplateId, Visitor, Zone, FightFx,
  ForeignFloorState, Point,
} from './types-model';
import type { Mop } from './mop';
import type { Stain } from './stain';
import type { RivalMindState } from './rival-ai/types';
import type { LayoutState } from './layout-types';
import type { CityState } from './city';
import type { ActionQueueState } from './action-queue';
import type { CitySceneState } from './city-scene';

export type * from './types-model';
export type { Mop } from './mop';
export type { Stain } from './stain';
export type { CitySceneState } from './city-scene';

/** Die eine aktive Szene; die Projektion in der UI liest nur diesen Zustand. */
type SceneKind = 'OWN' | 'FOREIGN' | 'CITY' | 'APARTMENT';
export interface SceneState { readonly kind: SceneKind; readonly foreignFloorId?: number; }
/**
 * Der eine Startzustand: erst die Eröffnung, dann die Wohnung, dann Stadt und Raum.
 * Die Reihenfolge ist die einzige Wahrheit dafuer, welches Startmodal sichtbar
 * ist - zwei unabhaengige Sichtbarkeitsregeln waren der Grund fuer zwei Modals.
 */
type OnboardingStep = 'OPENING' | 'APARTMENT' | 'CITY' | 'CASINO' | 'DONE';
export interface OnboardingState { step: OnboardingStep; }

export interface WorldState {
  template: TemplateId;
  /** Kanonische raeumliche Wahrheit: Dimension, Boden, Zonen und Wandkanten. */
  layout: LayoutState;
  /** Abgeleitet aus `layout.size`; nur ueber `applyLayout` schreiben. */
  size: number;
  /** Abgeleitet aus `layout.zones`; Legacy-Sicht fuer Renderer, UI und Simulation. */
  zones: readonly Zone[];
  furniture: Furniture[];
  guests: Guest[];
  player: Player;
  dirty: Set<number>;
  prices: PriceBook;
  staff: StaffState;
  carpet: CarpetId;
  tick: number;
  day: number;
  nextGuestId: number;
  /** Absoluter Tick der naechsten geplanten Ankunft; macht die Planung speicherbar. */
  nextArrivalTick: number;
  /** Gleitende Zufriedenheit der tatsaechlich bedienten Gaeste (0..100). */
  satisfaction: number;
  /** Hoechste erreichte Unternehmensstufe fuer additive Nachfrage. */
  demandTier: DemandTier;
  nextFurnitureId: number;
  lastEvent: string;
  guardsHired: number;
  crates: Crate[];
  agents: StaffAgent[];
  disputes: Dispute[];
  stains: Stain[];
  mops: Mop[];
  parts: number;
  guestsServed: number;
  reputation: number;
  wallColor: string;
  neonColor: string;
  barLevel: number;
  wcLevel: number;
  nextCrateId: number;
  nextAgentId: number;
  nextDisputeId: number;
  nextStainId: number;
  nextMopId: number;
  activePenalties: ActivePenalty[];
  visitors: Visitor[];
  nextVisitorId: number;
  /** Persistente Narrative-Domaene: Fact-Queue, Kurzzeithistorie, Flags. */
  narrative: NarrativeState;
  /** Persistenter Rivalen-Zustand; Ruf und Ausstattung bleiben daraus abgeleitet. */
  rivals: RivalMindState[];
  journal: JournalEvent[];
  /** Dauerhaftes, filterbares Archiv jenseits des 240er-Puffers. */
  archive: JournalEvent[];
  nextJournalId: number;
  /** Naechste Ledger-Seq, die bereits als MONEY-Event kopiert wurde. */
  journaledSeq: number;
  look: PlayerLook;
  plinko: PlinkoConfig;
  plinkoMode: PlinkoMode;
  totalPlinkoDrops: number;
  addictionScore: number;
  lastPlinko: PlinkoDrop | null;
  exclusionPact: ExclusionPact | null;
  /** Kurzlebige Kampf-Rueckmeldung fuer den Floor; null, wenn nichts passiert. */
  fightFx: FightFx | null;
  playerAddictionScore: number;
  brokenExclusionPacts: number;
  clarityBadge: boolean;
  /** Fremde Casinos als besuchbare Floors. */
  foreignFloors: ForeignFloorState[];
  nextForeignFloorId: number;
  /** ID des fremden Floors auf dem der Spieler gerade ist (null = eigener Floor). */
  activeForeignFloorId: number | null;
  /** Aktive Szene; `activeForeignFloorId` bleibt fuer alte Pfade gespiegelt. */
  scene: SceneState;
  /** Serialisierbare Auftragskette der aktiven Szene. */
  actionQueue: ActionQueueState;
  /** Stadt als eigener Floor; der Stadtzustand bleibt die Uebersicht. */
  cityScene?: CitySceneState;
  /** Position, zu der die Figur aus der Stadt ins eigene Casino zurueckkehrt. */
  sceneReturnPosition?: Point;
  /** Erster Start: Wohnung, Stadt, Casino oder abgeschlossen. Alte Saves sind DONE. */
  onboarding?: OnboardingState;
  /**
   * Stadt-Zustand des ersten Vertical Slice. Optional, weil Saves davor ihn
   * nicht tragen; `cityOf` legt ihn beim ersten Zugriff an.
   */
  city?: CityState;
}

// Board-Konstanten liegen in eigenem Modul; hier nur re-exportiert, damit Imports gleich bleiben.
export { TILE, REGION, CARPETS } from './board-constants';
