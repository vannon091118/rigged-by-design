/** Was die UI sieht: Welt plus abgeleitete Ledger-Werte. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { ActivePenalty, Crate, DemandSnapshot, Dispute, Guest, Player, PriceBook, StaffAgent, StaffState, TemplateId, Zone, Furniture, CarpetId } from '../core/sim/types';
import type { JournalEvent } from '../core/sim/journal';
import type { PlayerLook } from '../core/sim/player-look';
import type { PlinkoConfig, PlinkoDrop, PlinkoMode } from '../core/games/plinko-config';
import type { ExclusionPact } from '../core/sim/self-exclusion-bet';
import type { DuelPreview } from '../core/sim/duel';

export interface GameView {
  readonly template: TemplateId;
  readonly size: number;
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
  readonly staff: StaffState;
  readonly prices: PriceBook;
  readonly carpet: CarpetId;
  readonly lastEvent: string;
  readonly crates: readonly Crate[];
  readonly agents: readonly StaffAgent[];
  readonly disputes: readonly Dispute[];
  readonly talkChances: Readonly<Record<number, number>>;
  /** Je Disput: Gegnerprofil und die daraus folgende Siegchance. */
  readonly duels: Readonly<Record<number, DuelPreview>>;
  /** Je Disput: greift ein Guard gerade wirklich ein (in Reichweite)? */
  readonly disputeGuard: Readonly<Record<number, boolean>>;
  readonly activePenalties: readonly ActivePenalty[];
  readonly journal: readonly JournalEvent[];
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
  readonly parts: number;
  readonly guestsServed: number;
  readonly wallColor: string;
  readonly neonColor: string;
  readonly barLevel: number;
  readonly wcLevel: number;
  readonly house: VaCoinMicro;
  readonly wallet: VaCoinMicro;
  readonly desk: VaCoinMicro;
  readonly pending: VaCoinMicro;
  readonly guestMoney: Readonly<Record<number, { readonly wallet: VaCoinMicro; readonly pending: VaCoinMicro; readonly fiat: VaCoinMicro }>>;
  readonly mood: number;
  readonly reputation: number;
  readonly ledgerOk: boolean;
  readonly ledgerEntries: number;
  readonly ledgerLastSeq: number;
  readonly ledgerCirculating: VaCoinMicro;
  readonly notice: string;
}
