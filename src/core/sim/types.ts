// @loc-exception: Der serialisierbare Weltzustand ist eine einzige Typwahrheit; Aufteilen wuerde Saves und Hydration auseinanderziehen.
/** Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { BuildId } from './offers';
import type { PlayerRpgState } from './player-rpg';
import type { JournalEvent } from './journal';
import type { PlayerLook } from './player-look';

export type StaffRole = 'guard' | 'cleaner' | 'bartender' | 'cashier' | 'porter';

export type TemplateId = 'SMALL' | 'MEDIUM' | 'LARGE';
type ZoneKind = 'ENTRANCE' | 'EXCHANGE' | 'GAMING' | 'BAR' | 'TOILET' | 'STORAGE' | 'LOUNGE' | 'EXPANSION';
export type GameId = 'SLOT' | 'BLACKJACK' | 'POKER' | 'ROULETTE' | 'PLINKO' | 'SHELL' | 'DICE';
type GuestState = 'ENTER' | 'EXCHANGE' | 'CHOOSE' | 'WAIT' | 'PLAY' | 'DRINK' | 'TOILET' | 'CASHOUT' | 'LEAVE' | 'ANGRY';
type Need = 'play' | 'drink' | 'toilet' | 'social';
export type PersonaId = 'LUMPEN' | 'STREET' | 'BUSINESS' | 'HIGH_ROLLER' | 'STAMMGAST';
export type CarpetId = 'VIOLET' | 'CRIMSON' | 'JADE' | 'GOLD';
export type ModId = 'NEON' | 'NEAR_MISS' | 'CHERRY' | 'FREE_DRINK' | 'EXTRA_REEL' | 'VELVET';

export interface Point { readonly x: number; readonly y: number; }

export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: number;
}

export interface Furniture {
  readonly id: number;
  readonly kind: 'SLOT' | 'TABLE' | 'BAR' | 'TOILET' | 'EXCHANGE' | 'DECOR' | 'STORAGE';
  readonly gameId?: GameId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly seats: number;
  readonly label: string;
  readonly price: VaCoinMicro;
  readonly quality: number;
  condition: number;
  damaged: boolean;
  dirt: number;
  stock: number;
  clog: number;
  clogged: boolean;
  readonly zoneId: string;
  occupants: number[];
  mods: ModId[];
  reels: number;
  baseBet: VaCoinMicro;
}

export interface Guest {
  readonly id: number;
  readonly name: string;
  readonly persona: PersonaId;
  mood: number;
  patience: number;
  addiction: number;
  /** Tick, ab dem der Spieler diesen Gast erneut ansprechen darf (optional fuer alte Saves). */
  talkReadyTick?: number;
  /** Verknuepft den Gast mit einem Besucherprofil (fehlt bei alten Staenden). */
  visitorId?: number;
  sociability: number;
  thirst: number;
  bladder: number;
  disputeId: number | null;
  state: GuestState;
  stateTicks: number;
  position: Point;
  path: Point[];
  pathIndex: number;
  targetFurniture: number;
  targetZone: string;
  queueIndex: number;
  need: Need;
  anger: number;
  dirtTimer: number;
  lastResult: string;
  spins: number;
  /** Klartext-Grund der letzten Entscheidung; fehlt in alten Saves. */
  intent?: string;
}

export interface Player {
  position: Point;
  path: Point[];
  pathIndex: number;
  carrying: string;
  rpg: PlayerRpgState;
}

export interface ActivePenalty {
  readonly kind: 'UNSAFE_REPUTATION' | 'MOOD_SHOCK';
  daysLeft: number;
}

export interface PriceBook {
  entryFee: VaCoinMicro;
  drinkPrice: VaCoinMicro;
  slotMinBet: VaCoinMicro;
  staffWage: VaCoinMicro;
  guardWage: VaCoinMicro;
  cashierWage: VaCoinMicro;
  porterWage: VaCoinMicro;
  cleaningCost: VaCoinMicro;
  repairCost: VaCoinMicro;
  partCost: VaCoinMicro;
  drinkCrateCost: VaCoinMicro;
  barUpgrade: VaCoinMicro;
  wcUpgrade: VaCoinMicro;
}

export interface StaffState {
  guard: boolean;
  cleaner: boolean;
  bartender: boolean;
  cashier: boolean;
  porter: boolean;
}

export type CratePayload =
  | { kind: 'FURNITURE'; buildId: BuildId }
  | { kind: 'DRINKS'; count: number }
  | { kind: 'PARTS'; count: number };

export interface Crate {
  id: number;
  payload: CratePayload;
  x: number;
  y: number;
  carriedBy: number | 'player' | null;
}

export type StaffTask =
  | 'idle' | 'toCrate' | 'toBar' | 'toStorage' | 'toGuest' | 'toDispute'
  | 'cleaning' | 'cashier' | 'patrol' | 'serve';

export interface StaffAgent {
  id: number;
  role: StaffRole;
  x: number;
  y: number;
  path: Point[];
  pathIndex: number;
  carryingCrate: number | null;
  workTicks: number;
  /** Expliziter Auftrag statt aus dem Pfad geraten. */
  task: StaffTask;
  blockedReason: string;
}

export interface Dispute {
  id: number;
  guestIds: number[];
  x: number;
  y: number;
  level: number;
  ticks: number;
}

/** Ein wiedererkennbarer Besucher; bleibt ueber Besuche und Speicherstaende erhalten. */
export interface Visitor {
  readonly id: number;
  readonly name: string;
  readonly persona: PersonaId;
  visits: number;
  lastSeenTick: number;
}

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
}

// Board-Konstanten liegen in eigenem Modul; hier nur re-exportiert, damit Imports gleich bleiben.
export { TILE, REGION, CARPETS } from './board-constants';
