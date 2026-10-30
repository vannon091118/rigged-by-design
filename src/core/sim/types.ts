/** Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. */
import type { PlinkoConfig, PlinkoDrop, PlinkoMode } from '../games/plinko-config';
import type { JournalEvent } from './journal';
import type { PlayerLook } from './player-look';
import type { ExclusionPact } from './self-exclusion-bet';
import type {
  ActivePenalty, CarpetId, Crate, DemandEvent, DemandTier, Dispute, Furniture, Guest, Player,
  PriceBook, StaffAgent, StaffState, TemplateId, Visitor, Zone,
} from './types-model';

export type * from './types-model';

export interface WorldState {
  template: TemplateId;
  size: number;
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
  demandEvent: DemandEvent | null;
  nextFurnitureId: number;
  lastEvent: string;
  guardsHired: number;
  crates: Crate[];
  agents: StaffAgent[];
  disputes: Dispute[];
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
  activePenalties: ActivePenalty[];
  visitors: Visitor[];
  nextVisitorId: number;
  journal: JournalEvent[];
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
  playerAddictionScore: number;
  brokenExclusionPacts: number;
  clarityBadge: boolean;
}

// Board-Konstanten liegen in eigenem Modul; hier nur re-exportiert, damit Imports gleich bleiben.
export { TILE, REGION, CARPETS } from './board-constants';
