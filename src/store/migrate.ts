/** Hydration und Migration gespeicherter Stände (v5/v6/v7) in eine frische Welt. */
import { ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { GAME_FOOTPRINT, SERVICE_FOOTPRINT } from '../core/sim/grid-zones';
import { reputation } from '../core/sim/spawn';
import { newPlayerRpg } from '../core/sim/player-rpg';
import { normalizeLook, type PlayerLook } from '../core/sim/player-look';
import { defaultPlinkoConfig, normalizePlinkoConfig, type PlinkoConfig, type PlinkoDrop, type PlinkoMode } from '../core/games/plinko-config';
import { migrateReels } from '../core/games/slot-config';
import type { ExclusionPact } from '../core/sim/self-exclusion-bet';
import { recordJournal, type JournalEvent } from '../core/sim/journal';
import type { ActivePenalty, CarpetId, Crate, DemandEvent, DemandTier, Dispute, FightFx, Furniture, Guest, Player, PriceBook, StaffAgent, StaffState, TemplateId, Visitor, WorldState } from '../core/sim/types';

const DEMAND_TIERS: ReadonlySet<string> = new Set(['BUDE', 'KASSE', 'SAAL', 'KONZERN']);
const DEMAND_EVENTS: ReadonlySet<string> = new Set(['NEON_NACHT', 'TURNIER_ABEND']);

interface SavedEntry {
  readonly tick: number;
  readonly from: string;
  readonly to: string;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

/** v5-Gaeste konnten noch ein Fiat-Feld tragen; ab v6 liegt es im Ledger. */
type SavedGuest = Guest & { readonly fiat?: VaCoinMicro };

export interface SavedGame {
  readonly version: 5 | 6 | 7 | 8;
  readonly template: TemplateId;
  readonly carpet: CarpetId;
  readonly furniture: Furniture[];
  readonly guests: SavedGuest[];
  readonly player: Player;
  readonly dirty: number[];
  readonly prices: PriceBook;
  readonly staff: StaffState;
  readonly tick: number;
  readonly day: number;
  readonly nextGuestId: number;
  readonly nextArrivalTick?: number;
  readonly satisfaction?: number;
  readonly demandTier?: DemandTier;
  readonly demandEvent?: DemandEvent | null;
  readonly nextFurnitureId: number;
  readonly guardsHired: number;
  readonly crates?: Crate[];
  readonly agents?: StaffAgent[];
  readonly disputes?: Dispute[];
  readonly parts?: number;
  readonly guestsServed?: number;
  readonly reputation?: number;
  readonly wallColor?: string;
  readonly neonColor?: string;
  readonly barLevel?: number;
  readonly wcLevel?: number;
  readonly nextCrateId?: number;
  readonly nextAgentId?: number;
  readonly nextDisputeId?: number;
  readonly activePenalties?: ActivePenalty[];
  readonly visitors?: Visitor[];
  readonly nextVisitorId?: number;
  readonly lastEvent: string;
  readonly journal?: JournalEvent[];
  readonly archive?: JournalEvent[];
  readonly fightFx?: FightFx | null;
  readonly nextJournalId?: number;
  readonly journaledSeq?: number;
  readonly look?: PlayerLook;
  readonly plinko?: PlinkoConfig;
  readonly plinkoMode?: PlinkoMode;
  readonly totalPlinkoDrops?: number;
  readonly addictionScore?: number;
  readonly lastPlinko?: PlinkoDrop | null;
  readonly exclusionPact?: ExclusionPact | null;
  readonly playerAddictionScore?: number;
  readonly brokenExclusionPacts?: number;
  readonly clarityBadge?: boolean;
  readonly entries: readonly SavedEntry[];
  readonly prngState: number;
}

function footprintOf(item: Furniture): { w: number; h: number; seats: number } | null {
  if (item.gameId) return GAME_FOOTPRINT[item.gameId] ?? null;
  if (item.kind === 'EXCHANGE' || item.kind === 'BAR' || item.kind === 'TOILET' || item.kind === 'STORAGE') {
    return SERVICE_FOOTPRINT[item.kind];
  }
  return null;
}

/** Füllt alle Felder mit Defaults, heilt verwaiste Referenzen, sammelt altes Fiat. */
export function hydrateWorld(world: WorldState, saved: SavedGame): Array<{ id: number; amount: VaCoinMicro }> {
  world.furniture = saved.furniture.map((item) => {
    const fp = footprintOf(item);
    return {
      ...item,
      w: fp?.w ?? item.w, h: fp?.h ?? item.h, seats: fp?.seats ?? item.seats,
      damaged: item.damaged ?? false,
      stock: item.stock ?? (item.kind === 'BAR' ? 4 : 0),
      clog: item.clog ?? 0,
      clogged: item.clogged ?? false,
      occupants: [...(item.occupants ?? [])],
      mods: [...(item.mods ?? [])],
      reels: item.gameId === 'SLOT' ? migrateReels(item.reels) : (item.reels ?? 3),
    };
  });
  const legacyFiat: { id: number; amount: VaCoinMicro }[] = [];
  world.guests = saved.guests.map((guest) => {
    const { fiat, ...rest } = guest;
    if (fiat && fiat > ZERO_VC) legacyFiat.push({ id: guest.id, amount: fiat });
    return {
      ...rest,
      thirst: rest.thirst ?? 20,
      bladder: rest.bladder ?? 10,
      disputeId: rest.disputeId ?? null,
      path: [...(guest.path ?? [])],
    };
  });
  world.player = { ...world.player, ...saved.player, path: [...(saved.player?.path ?? [])], rpg: { ...newPlayerRpg(), ...(saved.player?.rpg ?? {}) } };
  world.dirty = new Set(saved.dirty ?? []);
  world.prices = { ...world.prices, ...(saved.prices ?? {}) };
  world.staff = { ...world.staff, ...(saved.staff ?? {}) };
  world.tick = saved.tick ?? 0;
  world.day = saved.day ?? 1;
  world.nextGuestId = saved.nextGuestId ?? 1;
  const arrival = saved.nextArrivalTick;
  world.nextArrivalTick = arrival !== undefined && Number.isFinite(arrival)
    ? Math.max(world.tick + 1, Math.floor(arrival)) : world.tick + 8;
  world.satisfaction = Number.isFinite(saved.satisfaction)
    ? Math.min(100, Math.max(0, saved.satisfaction!)) : 55;
  world.demandTier = saved.demandTier && DEMAND_TIERS.has(saved.demandTier) ? saved.demandTier : 'BUDE';
  const event = saved.demandEvent;
  world.demandEvent = event && DEMAND_EVENTS.has(event.kind) && Number.isFinite(event.untilTick)
    && event.untilTick > world.tick ? { kind: event.kind, untilTick: Math.floor(event.untilTick) } : null;
  world.nextFurnitureId = saved.nextFurnitureId ?? 100;
  world.guardsHired = saved.guardsHired ?? 0;
  world.crates = (saved.crates ?? []).map((crate) => ({ ...crate, carriedBy: crate.carriedBy ?? null }));
  world.agents = (saved.agents ?? []).map((agent) => ({
    ...agent, path: [...(agent.path ?? [])], carryingCrate: agent.carryingCrate ?? null,
    task: agent.task ?? 'idle', blockedReason: agent.blockedReason ?? '', targetDisputeId: agent.targetDisputeId ?? null,
  }));
  world.disputes = (saved.disputes ?? []).map((dispute) => ({ ...dispute, guestIds: [...dispute.guestIds] }));
  world.parts = saved.parts ?? 2;
  world.guestsServed = saved.guestsServed ?? 0;
  world.reputation = saved.reputation ?? reputation(world);
  world.wallColor = saved.wallColor ?? '#241a35';
  world.neonColor = saved.neonColor ?? '#00ffcc';
  world.barLevel = saved.barLevel ?? 1;
  world.wcLevel = saved.wcLevel ?? 1;
  world.nextCrateId = saved.nextCrateId ?? world.crates.reduce((max, crate) => Math.max(max, crate.id + 1), 1);
  world.nextAgentId = saved.nextAgentId ?? world.agents.reduce((max, agent) => Math.max(max, agent.id + 1), 1);
  world.nextDisputeId = saved.nextDisputeId ?? world.disputes.reduce((max, dispute) => Math.max(max, dispute.id + 1), 1);
  const agentIds = new Set(world.agents.map((agent) => agent.id));
  for (const crate of world.crates) {
    if (typeof crate.carriedBy === 'number' && !agentIds.has(crate.carriedBy)) crate.carriedBy = null;
  }
  const crateIds = new Set(world.crates.map((crate) => crate.id));
  for (const agent of world.agents) {
    if (agent.carryingCrate !== null && !crateIds.has(agent.carryingCrate)) agent.carryingCrate = null;
  }
  const guestIds = new Set(world.guests.map((guest) => guest.id));
  for (const dispute of world.disputes) dispute.guestIds = dispute.guestIds.filter((id) => guestIds.has(id));
  world.disputes = world.disputes.filter((dispute) => dispute.guestIds.length >= 2);
  for (const guest of world.guests) {
    if (guest.disputeId !== null && !world.disputes.some((dispute) => dispute.id === guest.disputeId)) {
      guest.disputeId = null;
    }
  }
  world.activePenalties = (saved.activePenalties ?? []).map((penalty) => ({ ...penalty }));
  world.visitors = (saved.visitors ?? []).map((visitor) => ({ ...visitor }));
  world.nextVisitorId = saved.nextVisitorId ?? world.visitors.reduce((max, visitor) => Math.max(max, visitor.id + 1), 1);
  world.journal = (saved.journal ?? []).map((event) => ({ ...event, refs: event.refs ? { ...event.refs } : undefined }));
  world.nextJournalId = saved.nextJournalId
    ?? world.journal.reduce((max, event) => Math.max(max, event.id + 1), 1);
  world.journaledSeq = saved.journaledSeq ?? saved.entries.length;
  // Aeltere Staende kennen kein Archiv: der vorhandene Puffer wird dann zum Startbestand.
  world.archive = (saved.archive ?? world.journal).map((event) => ({
    ...event, refs: event.refs ? { ...event.refs } : undefined,
  }));
  world.fightFx = saved.fightFx ?? null;
  world.look = normalizeLook(saved.look);
  try {
    world.plinko = normalizePlinkoConfig(saved.plinko);
  } catch {
    world.plinko = defaultPlinkoConfig();
  }
  world.plinkoMode = saved.plinkoMode === 'TWIN' || saved.plinkoMode === 'TRIPLE' ? saved.plinkoMode : 'SINGLE';
  world.totalPlinkoDrops = Number.isSafeInteger(saved.totalPlinkoDrops) ? Math.max(0, saved.totalPlinkoDrops!) : 0;
  world.addictionScore = Number.isFinite(saved.addictionScore) ? Math.min(100, Math.max(0, saved.addictionScore!)) : 0;
  world.lastPlinko = saved.lastPlinko ?? null;
  world.exclusionPact = saved.exclusionPact ? { ...saved.exclusionPact } : null;
  world.playerAddictionScore = Number.isFinite(saved.playerAddictionScore)
    ? Math.min(100, Math.max(0, saved.playerAddictionScore!)) : 0;
  world.brokenExclusionPacts = Number.isSafeInteger(saved.brokenExclusionPacts)
    ? Math.max(0, saved.brokenExclusionPacts!) : 0;
  world.clarityBadge = saved.clarityBadge ?? false;
  world.lastEvent = saved.lastEvent ?? 'Spielstand geladen.';
  if (world.journal.length === 0) {
    recordJournal(world, {
      kind: 'SYSTEM', subject: 'Spielstand', cause: 'Save geladen',
      effect: world.lastEvent,
    });
  }
  return legacyFiat;
}
