/** Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. */
import type { PlinkoConfig, PlinkoDrop, PlinkoMode } from '../games/plinko-config';
import type { NarrativeState } from './narrative/types';
import type { JournalEvent } from './journal';
import type { PlayerLook } from './player-look';
import type { ExclusionPact } from './self-exclusion-bet';
import type {
  ActivePenalty, CarpetId, Crate, DemandTier, Dispute, Furniture, Guest, Mop, Player,
  PriceBook, StaffAgent, StaffState, Stain, TemplateId, Visitor, Zone, FightFx,
  ForeignFloorState,
} from './types-model';
import type { RivalMindState } from './rival-ai/types';
import type { LayoutState } from './layout-types';

export type * from './types-model';

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
}

// Board-Konstanten liegen in eigenem Modul; hier nur re-exportiert, damit Imports gleich bleiben.
export { TILE, REGION, CARPETS } from './board-constants';
