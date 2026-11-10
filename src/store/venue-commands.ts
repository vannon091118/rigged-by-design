/** Venue Commands: Bau, Einrichtung, Preise – alles was das Haus verändert. */
import type { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import type { Prng } from '../core/rng/prng';
import { applySlotOdds, cleanAll, cleanTile, installMod, repair, setBaseBet, setCarpet, setPrice, upgradeReels } from '../core/sim/actions';
import { buyCrate, orderDrinks, orderParts } from '../core/sim/deliveries';
import { deployHeldCrate, pickupCrate, serveDesk, setNeonColor, setWallColor, storeHeldCrate, upgradeBar, upgradeWc } from '../core/sim/player';
import { calmDispute } from '../core/sim/disputes';
import { talkToGuest } from '../core/sim/charisma-talk';
import { emitFact } from '../core/sim/narrative/facts';
import { actorRefOfVisitor } from '../core/sim/narrative/relationships';
import { guestById } from '../core/sim/world';
import { consumeMopUse, dropMop, pickupMop, spawnMop } from '../core/sim/mop';
import { removeStain } from '../core/sim/stain';
import { isInRange, planInteraction, INTERACTION_RADII } from '../core/sim/interaction';
import { spendPoint, type RpgAttribute } from '../core/sim/player-rpg';
import { duelNotice, resolveDuel } from '../core/sim/duel';
import { fireAgent, hireAgent } from '../core/sim/staff';
import type { BuildId } from '../core/sim/offers';
import type { CarpetId, ModId, StaffRole } from '../core/sim/types';
import type { SlotProfile } from '../core/games/slot-profile';
import type { WorldState } from '../core/sim/types';

export function buyCmd(world: WorldState, ledger: Ledger, id: BuildId): void {
  buyCrate(world, ledger, id);
}

export function orderDrinksCmd(world: WorldState, ledger: Ledger, count: number): string {
  orderDrinks(world, ledger, count);
  return 'Getränke bestellt.';
}

export function orderPartsCmd(world: WorldState, ledger: Ledger, count: number): string {
  orderParts(world, ledger, count);
  return 'Teile bestellt.';
}

export function pickupCmd(world: WorldState, crateId: number): string {
  pickupCrate(world, crateId);
  return world.lastEvent;
}

export function deployCmd(world: WorldState, x: number, y: number): string {
  deployHeldCrate(world, x, y);
  return world.lastEvent;
}

export function unloadHereCmd(world: WorldState): string {
  const pos = world.player.position;
  const bar = world.furniture.find((item) => item.kind === 'BAR'
    && Math.abs(item.x - pos.x) + Math.abs(item.y - pos.y) <= 3);
  storeHeldCrate(world, pos.x, pos.y, bar?.id);
  return world.lastEvent;
}

export function storeDepositCmd(world: WorldState, x: number, y: number, barId?: number): string {
  storeHeldCrate(world, x, y, barId);
  return world.lastEvent;
}

export function calmCmd(world: WorldState, disputeId: number): string {
  if (!calmDispute(world, disputeId)) throw new Error('Zu weit weg. Geh zum Streit.');
  const d = world.disputes.find((d) => d.id === disputeId);
  const g = d?.guestIds?.[0] ? guestById(world, d.guestIds[0]) : undefined;
  if (g?.visitorId) emitFact(world, { kind: 'VISITOR_CONFLICT', actorRefs: [actorRefOfVisitor(g.visitorId)], initiator: actorRefOfVisitor(g.visitorId), severity: 1 });
  return world.lastEvent;
}

export function talkCmd(world: WorldState, prng: Prng, guestId: number): string {
  const guest = guestById(world, guestId);
  if (!guest) throw new Error('Gast nicht gefunden.');
  if (!isInRange(world.player.position, guest.position, INTERACTION_RADII.GUEST)) {
    throw new Error('Zu weit weg. Geh erst zum Gast.');
  }
  if (!talkToGuest(world, prng, guestId)) throw new Error('Gast gerade nicht ansprechbar.');
  return world.lastEvent;
}

export function fightBrawlCmd(world: WorldState, ledger: Ledger, prng: Prng, disputeId: number): string {
  const d = world.disputes.find((d) => d.id === disputeId);
  if (!d) throw new Error('Der Streit ist vorbei.');
  if (!isInRange(world.player.position, d, INTERACTION_RADII.DISPUTE)) {
    throw new Error('Zu weit weg. Geh erst zum Streit.');
  }
  const g = d?.guestIds?.[0] ? guestById(world, d.guestIds[0]) : undefined;
  if (g?.visitorId) emitFact(world, { kind: 'VISITOR_CONFLICT', actorRefs: [actorRefOfVisitor(g.visitorId)], initiator: actorRefOfVisitor(g.visitorId), severity: 2 });
  return duelNotice(resolveDuel(world, ledger, prng, disputeId), world.lastEvent);
}

export function spendSkillCmd(world: WorldState, attribute: RpgAttribute): string {
  if (!spendPoint(world.player.rpg, attribute)) throw new Error('Kein Skillpunkt frei.');
  return 'Skill verbessert.';
}

export function serveDeskCmd(world: WorldState, ledger: Ledger, prng: Prng): string {
  const served = serveDesk(world, ledger, prng);
  return served ? 'Gast gewechselt.' : 'Niemand wartet an der Kasse.';
}

export function setWallCmd(world: WorldState, color: string): string {
  setWallColor(world, color);
  return 'Wand gestrichen.';
}

export function setNeonCmd(world: WorldState, color: string): string {
  setNeonColor(world, color);
  return 'Neon neu gefärbt.';
}

export function upgradeBarCmd(world: WorldState, ledger: Ledger): string {
  upgradeBar(world, ledger);
  return world.lastEvent;
}

export function upgradeWcCmd(world: WorldState, ledger: Ledger): string {
  upgradeWc(world, ledger);
  return world.lastEvent;
}

export function repairCmd(world: WorldState, ledger: Ledger, itemId: number): string {
  repair(world, ledger, itemId);
  return 'Reparatur bezahlt.';
}

export function cleanCmd(world: WorldState, ledger: Ledger, tile?: number): string {
  if (tile === undefined) {
    const count = cleanAll(world, ledger);
    return count ? `${count} Flecken weg.` : 'Alles sauber.';
  }
  // Interaktionsradius-Check: Spieler muss am Fleck stehen (Radius 1 Tile).
  const x = tile % world.size;
  const y = Math.floor(tile / world.size);
  if (!isInRange(world.player.position, { x, y }, INTERACTION_RADII.STAIN)) {
    throw new Error('Zu weit weg. Geh erst zum Fleck.');
  }
  cleanTile(world, ledger, tile);
  return 'Fleck weg.';
}

export function hireCmd(world: WorldState, ledger: Ledger, role: StaffRole): string {
  hireAgent(world, ledger, role);
  return world.lastEvent;
}

export function fireCmd(world: WorldState, role: StaffRole): string {
  fireAgent(world, role);
  return 'Personal entlassen.';
}

export function setPriceCmd(world: WorldState, key: 'drinkPrice' | 'slotMinBet', vc: number): string {
  setPrice(world, key, fromVC(vc));
  return 'Preis geändert.';
}

export function setCarpetCmd(world: WorldState, carpet: CarpetId): string {
  setCarpet(world, carpet);
  return 'Teppich verlegt.';
}

export function installModCmd(world: WorldState, ledger: Ledger, itemId: number, mod: ModId): string {
  installMod(world, ledger, itemId, mod);
  return 'Mod verbaut.';
}

export function addReelCmd(world: WorldState, ledger: Ledger, itemId: number): string {
  upgradeReels(world, ledger, itemId);
  return 'Walze eingebaut.';
}

export function setBetCmd(world: WorldState, itemId: number, vc: number): string {
  setBaseBet(world, itemId, fromVC(vc));
  return 'Mindesteinsatz geändert.';
}

export function setSlotOddsCmd(world: WorldState, itemId: number, profile: SlotProfile): string {
  return applySlotOdds(world, itemId, profile);
}

/** Wischer am Spielerstandort aufheben (Radius 1, nur mit leeren Händen). */
export function pickupMopCmd(world: WorldState, mopId: number): string {
  const mop = world.mops.find((m) => m.id === mopId);
  if (!mop) throw new Error('Wischer nicht gefunden.');
  if (!isInRange(world.player.position, { x: mop.x, y: mop.y }, INTERACTION_RADII.MOP)) {
    throw new Error('Zu weit weg. Geh erst zum Wischer.');
  }
  pickupMop(world, mopId);
  return world.lastEvent;
}

/** Getragenen Wischer am Spielerstandort ablegen. */
export function dropMopCmd(world: WorldState): string {
  dropMop(world);
  return world.lastEvent;
}

/** Einen Fleck reinigen (Radius 1, benötigt getragenen Wischer). */
export function cleanStainCmd(world: WorldState, ledger: Ledger, stainId: number): string {
  const stain = world.stains.find((s) => s.id === stainId);
  if (!stain) throw new Error('Fleck nicht gefunden.');
  if (!isInRange(world.player.position, { x: stain.x, y: stain.y }, INTERACTION_RADII.STAIN)) {
    throw new Error('Zu weit weg. Geh erst zum Fleck.');
  }
  if (!/^MOP:(\d+)$/.exec(world.player.carrying ?? '')) {
    throw new Error('Du brauchst einen Wischer.');
  }
  removeStain(world, ledger, stainId);
  consumeMopUse(world);
  return world.lastEvent;
}

/** Wischer an der Toilette holen (Radius 2). */
export function getMopAtToiletCmd(world: WorldState, toiletId?: number): string {
  const toilet = toiletId === undefined
    ? world.furniture.find((item) => item.kind === 'TOILET')
    : world.furniture.find((item) => item.id === toiletId && item.kind === 'TOILET');
  if (!toilet) throw new Error('Keine Toilette im Haus.');
  if (!planInteraction(world, { kind: 'furniture', id: toilet.id }).inRange) {
    throw new Error('Zu weit weg. Geh erst zur Toilette.');
  }
  const pos = { x: toilet.x, y: toilet.y };
  spawnMop(world, pos.x + 1, pos.y);
  return 'Wischer bereitgestellt.';
}
