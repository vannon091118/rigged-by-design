/** Was die UI sieht: Welt plus abgeleitete Ledger-Werte. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { ActivePenalty, Crate, Dispute, Guest, Player, PriceBook, StaffAgent, StaffState, TemplateId, Zone, Furniture, CarpetId } from '../core/sim/types';
import type { JournalEvent } from '../core/sim/journal';
import type { PlayerLook } from '../core/sim/player-look';

export interface GameView {
  readonly template: TemplateId;
  readonly size: number;
  readonly zones: readonly Zone[];
  readonly furniture: readonly Furniture[];
  readonly guests: readonly Guest[];
  readonly capacity: number;
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
  readonly brawlChance: number;
  readonly activePenalties: readonly ActivePenalty[];
  readonly journal: readonly JournalEvent[];
  readonly look: PlayerLook;
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
