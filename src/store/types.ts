/** Was die UI sieht: Welt plus abgeleitete Ledger-Werte. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { ActivePenalty, Crate, DemandSnapshot, Dispute, FightFx, Guest, Player, PriceBook, StaffAgent, TemplateId, Zone, Furniture, CarpetId, PlayerJobState, RivalId, Mop, Stain } from '../core/sim/types';
import type { JournalEvent } from '../core/sim/journal';
import type { PlayerLook } from '../core/sim/player-look';
import type { PlayerCareer } from '../core/sim/player-career';
import type { PlinkoConfig, PlinkoDrop, PlinkoMode } from '../core/games/plinko-config';
import type { ExclusionPact } from '../core/sim/self-exclusion-bet';
import type { DuelPreview } from '../core/sim/duel';
import type { NarrativeView } from '../core/sim/narrative/view-types';
import type { LayoutState } from '../core/sim/layout-types';
import type { DayPhase } from '../core/sim/day-phase';
import type { CompanyStatus } from '../core/sim/progression';
import type { RenovationView } from '../core/sim/renovation';
import type { MachineHallView } from '../core/sim/machine-hall';
import type { CityView } from '../core/sim/city';
import type { ActionTaskView } from '../core/sim/action-queue';

interface SceneView {
  readonly key: string;
  readonly kind: 'OWN' | 'FOREIGN' | 'CITY';
  readonly label: string;
}

/**
 * Personal-Sicht der UI: Bestand, abgeleitet aus dem Agentenbestand – nicht
 * aus einem eigenen Flag, das danebenliegen kann.
 */
export interface StaffView {
  readonly guard: boolean;
  readonly cleaner: boolean;
  readonly bartender: boolean;
  readonly cashier: boolean;
  readonly porter: boolean;
}

interface ForeignFloorView {
  readonly id: number;
  readonly rivalId: RivalId;
  readonly size: number;
  readonly jobStations: readonly import('../core/sim/types').JobStationDef[];
  readonly playerPosition: import('../core/sim/types').Point | null;
  readonly day: number;
}

export interface GameView {
  readonly template: TemplateId;
  /** Kanonische raeumliche Wahrheit fuer Simulation, Renderer und Editor. */
  readonly layout: LayoutState;
  /** Abgeleitet aus `layout.size` (Legacy-Sicht). */
  readonly size: number;
  /** Abgeleitet aus `layout.zones` (Legacy-Sicht). */
  readonly zones: readonly Zone[];
  readonly furniture: readonly Furniture[];
  readonly guests: readonly Guest[];
  /** Spielplätze: Servicegröße, keine Obergrenze für Ankünfte. */
  readonly seats: number;
  readonly demand: DemandSnapshot;
  readonly player: Player;
  readonly dirtyTiles: ReadonlySet<number>;
  readonly tick: number;
  readonly day: number;
  /** Morgen, Abend oder Nacht; aus dem Tick, nie aus der Uhr. */
  readonly dayPhase: DayPhase;
  readonly staff: StaffView;
  readonly prices: PriceBook;
  readonly carpet: CarpetId;
  readonly lastEvent: string;
  readonly crates: readonly Crate[];
  readonly agents: readonly StaffAgent[];
  readonly disputes: readonly Dispute[];
  readonly stains: readonly Stain[];
  readonly mops: readonly Mop[];
  readonly talkChances: Readonly<Record<number, number>>;
  /** Je Gast: Restticks bis zur naechsten Ansprache (0 = frei). */
  readonly talkReady: Readonly<Record<number, number>>;
  /** Je Disput: Gegnerprofil und die daraus folgende Siegchance. */
  readonly duels: Readonly<Record<number, DuelPreview>>;
  /** Je Disput: greift ein Guard gerade wirklich ein (in Reichweite)? */
  readonly disputeGuard: Readonly<Record<number, boolean>>;
  readonly activePenalties: readonly ActivePenalty[];
  readonly journal: readonly JournalEvent[];
  /** Aktive Szenen und Besucherprofile, bereits ausgewertet (NAR-14). */
  readonly narrative: NarrativeView;
  /** Dauerhaftes Archiv jenseits des 240er-Puffers, filterbar. */
  readonly archive: readonly JournalEvent[];
  /** Kurzlebige Kampf-Rueckmeldung fuer den Floor. */
  readonly fightFx: FightFx | null;
  readonly look: PlayerLook;
  readonly plinko: PlinkoConfig;
  readonly plinkoMode: PlinkoMode;
  readonly totalPlinkoDrops: number;
  readonly addictionScore: number;
  readonly lastPlinko: PlinkoDrop | null;
  readonly exclusionPact: ExclusionPact | null;
  readonly playerAddictionScore: number;
  readonly brokenExclusionPacts: number;
  readonly clarityBadge: boolean;
  readonly playerCash: VaCoinMicro;
  /** Karriere-Sicht: abgeleitet aus Welt, Ledger und Archiv, kein eigener Zustand. */
  readonly career: PlayerCareer;
  readonly parts: number;
  readonly guestsServed: number;
  readonly wallColor: string;
  readonly neonColor: string;
  readonly barLevel: number;
  readonly wcLevel: number;
  readonly house: VaCoinMicro;
  /** Renovierungsstufe der eigenen Immobilie samt naechstem Schritt. */
  readonly renovation: RenovationView;
  /** Automaten der eigenen Flaeche samt Wartungsbedarf. */
  readonly machineHall: MachineHallView;
  readonly wallet: VaCoinMicro;
  readonly desk: VaCoinMicro;
  readonly pending: VaCoinMicro;
  readonly guestMoney: Readonly<Record<number, { readonly wallet: VaCoinMicro; readonly pending: VaCoinMicro; readonly fiat: VaCoinMicro }>>;
  readonly mood: number;
  readonly reputation: number;
  /** Erreichte Firmenstufe mit offenen Bedingungen bis zur naechsten. */
  readonly company: CompanyStatus;
  readonly ledgerOk: boolean;
  readonly ledgerEntries: number;
  readonly ledgerLastSeq: number;
  readonly ledgerCirculating: VaCoinMicro;
  /** Stadt-Sicht: Orte, Energie, Zweige und blockierte Handlungen. */
  readonly city: CityView;
  readonly notice: string;
  /** Aktive Szene und ihre serialisierte Auftragskette. */
  readonly scene: SceneView;
  readonly queue: readonly ActionTaskView[];
  readonly onboarding: { readonly step: 'CITY' | 'CASINO' | 'DONE' };
  /** Aktiver Foreign Floor (null = eigener Floor). */
  readonly currentForeignFloorId: number | null;
  /** Verfuegbare fremde Floors fuer die UI. */
  readonly foreignFloors: readonly ForeignFloorView[];
  /** Aktueller Spieler-Job (null = kein Job). */
  readonly playerJob: PlayerJobState | null;
  /** Erste Bude gekauft (Meilenstein). */
  readonly barPurchased: boolean;
}
