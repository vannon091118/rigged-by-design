/** Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. */
import type { Ledger } from '../core/economy/ledger';
import { addVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { fiatAccount, guestAccount, pendingAccount, HAUSKONTO, PORTEMONNAIE, WECHSELKASSE } from '../core/sim/money';
import { brawlWinChance } from '../core/sim/brawl-combat';
import { talkChance } from '../core/sim/charisma-talk';
import { reputation, serviceCapacity } from '../core/sim/spawn';
import type { WorldState } from '../core/sim/types';
import type { GameView } from './types';

function worldSnapshot(world: WorldState) {
  return {
    template: world.template,
    size: world.size,
    zones: world.zones,
    furniture: world.furniture.map((item) => ({ ...item, occupants: [...item.occupants], mods: [...item.mods] })),
    guests: world.guests.map((guest) => ({ ...guest, path: [...guest.path] })),
    capacity: serviceCapacity(world),
    player: { ...world.player, position: { ...world.player.position }, path: [...world.player.path] },
    dirtyTiles: new Set(world.dirty),
    tick: world.tick,
    day: world.day,
    staff: { ...world.staff },
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
    look: world.look,
    plinko: world.plinko,
    plinkoMode: world.plinkoMode,
    totalPlinkoDrops: world.totalPlinkoDrops,
    addictionScore: world.addictionScore,
    lastPlinko: world.lastPlinko,
  };
}

export function buildView(world: WorldState, ledger: Ledger, notice: string): GameView {
  let pending: VaCoinMicro = ZERO_VC;
  let mood = 0;
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
    brawlChance: brawlWinChance(world),
    house: ledger.getBalance(HAUSKONTO),
    wallet: ledger.getBalance(PORTEMONNAIE),
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
