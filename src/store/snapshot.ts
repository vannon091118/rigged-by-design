/** Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. */
import type { Ledger } from '../core/economy/ledger';
import { addVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { fiatAccount, guestAccount, pendingAccount, HAUSKONTO, PLAYER_CASH, PORTEMONNAIE, WECHSELKASSE } from '../core/sim/money';
import { duelPreview, type DuelPreview } from '../core/sim/duel';
import { demandBreakdown } from '../core/sim/demand';
import { guardHandling } from '../core/sim/disputes';
import { talkChance } from '../core/sim/charisma-talk';
import { reputation } from '../core/sim/spawn';
import { hasStaff } from '../core/sim/staff-queries';
import type { WorldState } from '../core/sim/types';
import { seatCount } from '../core/sim/world';
import type { GameView, StaffView } from './types';

/** Personal-Sicht der UI: der Guard besteht, sobald sein Agent existiert. */
function staffView(world: WorldState): StaffView {
  return { ...world.staff, guard: hasStaff(world, 'guard') };
}

function worldSnapshot(world: WorldState) {
  return {
    template: world.template,
    size: world.size,
    zones: world.zones,
    furniture: world.furniture.map((item) => ({ ...item, occupants: [...item.occupants], mods: [...item.mods] })),
    guests: world.guests.map((guest) => ({ ...guest, path: [...guest.path] })),
    seats: seatCount(world),
    demand: demandBreakdown(world),
    player: { ...world.player, position: { ...world.player.position }, path: [...world.player.path] },
    dirtyTiles: new Set(world.dirty),
    tick: world.tick,
    day: world.day,
    // Die UI sieht, ob ein Guard existiert – das leitet sich jetzt aus seinem
    // Agenten ab, nicht aus einem eigenen Flag.
    staff: staffView(world),
    prices: { ...world.prices },
    carpet: world.carpet,
    lastEvent: world.lastEvent,
    crates: world.crates.map((crate) => ({ ...crate })),
    agents: world.agents.map((agent) => ({ ...agent, path: [...agent.path] })),
    disputes: world.disputes.map((dispute) => ({ ...dispute, guestIds: [...dispute.guestIds] })),
    parts: world.parts,
    guestsServed: world.guestsServed,
    wallColor: world.wallColor,
    neonColor: world.neonColor,
    barLevel: world.barLevel,
    wcLevel: world.wcLevel,
    activePenalties: world.activePenalties.map((penalty) => ({ ...penalty })),
    journal: world.journal.map((event) => ({ ...event, refs: event.refs ? { ...event.refs } : undefined })),
    archive: world.archive.map((event) => ({ ...event, refs: event.refs ? { ...event.refs } : undefined })),
    fightFx: world.fightFx ? { ...world.fightFx } : null,
    look: world.look,
    plinko: world.plinko,
    plinkoMode: world.plinkoMode,
    totalPlinkoDrops: world.totalPlinkoDrops,
    addictionScore: world.addictionScore,
    lastPlinko: world.lastPlinko,
    exclusionPact: world.exclusionPact ? { ...world.exclusionPact } : null,
    playerAddictionScore: world.playerAddictionScore,
    brokenExclusionPacts: world.brokenExclusionPacts,
    clarityBadge: world.clarityBadge,
  };
}

export function buildView(world: WorldState, ledger: Ledger, notice: string): GameView {
  let pending: VaCoinMicro = ZERO_VC;
  let mood = 0;
  const duels: Record<number, DuelPreview> = {};
  for (const dispute of world.disputes) {
    const preview = duelPreview(world, dispute);
    if (preview) duels[dispute.id] = preview;
  }
  const guestMoney: Record<number, { wallet: VaCoinMicro; pending: VaCoinMicro; fiat: VaCoinMicro }> = {};
  for (const guest of world.guests) {
    const wallet = ledger.getBalance(guestAccount(guest.id));
    const open = ledger.getBalance(pendingAccount(guest.id));
    guestMoney[guest.id] = { wallet, pending: open, fiat: ledger.getBalance(fiatAccount(guest.id)) };
    pending = addVC(pending, open);
    mood += guest.mood;
  }
  return {
    ...worldSnapshot(world),
    talkChances: Object.fromEntries(world.guests.map((guest) => [guest.id, talkChance(world, guest.id)])),
    // Restticks bis die Ansprache wieder frei ist; die UI zaehlt daraus die Sekunden.
    talkReady: Object.fromEntries(world.guests.map((guest) => [guest.id, Math.max(0, (guest.talkReadyTick ?? 0) - world.tick)])),
    // Nur ein Security vor Ort beendet den Streit; die UI folgt derselben Aussage.
    disputeGuard: Object.fromEntries(world.disputes.map((dispute) => [dispute.id, guardHandling(world, dispute)])),
    duels,
    house: ledger.getBalance(HAUSKONTO),
    wallet: ledger.getBalance(PORTEMONNAIE),
    playerCash: ledger.getBalance(PLAYER_CASH),
    desk: ledger.getBalance(WECHSELKASSE),
    pending,
    guestMoney,
    mood: world.guests.length ? Math.round(mood / world.guests.length) : 0,
    reputation: Math.round(reputation(world)),
    ledgerOk: ledger.verifyIncremental(),
    ledgerEntries: ledger.entryCount,
    ledgerLastSeq: ledger.entryCount - 1,
    ledgerCirculating: ledger.circulating,
    notice,
  };
}
