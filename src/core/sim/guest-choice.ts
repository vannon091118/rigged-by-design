/** Was ein Gast als Nächstes tut: Bedürfnis, freier Platz, Ausweichen statt Stillstand. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import { blockedTiles, isWalkable, nearestWalkable } from './pathfinding';
import type { Prng } from '../rng/prng';
import { pickWeighted } from '../rng/weighted';
import { clamp } from './guest-core';
import { refreshNeeds } from './needs';
import { guestAccount } from './money';
import { offerScore } from './offers';
import type { Furniture, Guest, Point, WorldState } from './types';
import { freeSeat, interactionPoint, releaseSeat, reserveSeat, seatPoint, sendGuest, zoneById } from './world';

export function startActivity(world: WorldState, guest: Guest, item: Furniture): boolean {
  if (item.damaged || !reserveSeat(world, item.id, guest.id)) return false;
  const seat = item.occupants.indexOf(guest.id);
  const point = seatPoint(world, item, seat) ?? interactionPoint(world, item);
  if (!point) { releaseSeat(world, item.id, guest.id); return false; }
  guest.targetFurniture = item.id;
  guest.targetZone = item.zoneId;
  guest.state = item.kind === 'BAR' ? 'DRINK' : item.kind === 'TOILET' ? 'TOILET' : item.kind === 'DECOR' ? 'WAIT' : 'PLAY';
  guest.intent = item.kind === 'BAR' ? 'Durst und Laune: geht zur Bar.'
    : item.kind === 'TOILET' ? 'Blase voll oder Laune im Keller: geht zum WC.'
      : item.kind === 'DECOR' ? 'Sucht Gesellschaft und einen ruhigen Platz.'
        : `Spielt ${item.label}: Angebot passt zu Persona und Budget.`;
  guest.stateTicks = 0;
  if (item.gameId) {
    guest.mood = clamp(guest.mood + 2);
    guest.patience = clamp(guest.patience + 2);
  }
  sendGuest(world, guest, point);
  return true;
}

function waitForSpace(world: WorldState, guest: Guest): void {
  const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE') ?? world.zones.find((zone) => zone.kind === 'ENTRANCE');
  guest.state = 'WAIT';
  guest.stateTicks = 0;
  guest.intent = 'Kein freier Platz: wartet und verliert Geduld.';
  guest.targetFurniture = 0;
  // Warten ist eine Entscheidung: es kostet Geduld, aber es soll sich lohnen koennen.
  guest.patience = Math.max(0, guest.patience - 1.5);
  guest.mood = Math.max(0, guest.mood - 0.5);
  const zone = lounge ? zoneById(world, lounge.id) : null;
  if (zone) {
    guest.targetZone = zone.id;
    // Warten ohne Stau: besetzt sind Kacheln, die andere Wartende treuhalten —
    // ihre Position wie auch das Pfadende als Ziel — plus Moebel. Zwei Gaeste
    // faellen dadurch nie denselben Fleck zu, auch nicht beim Aufholen.
    const blocked = blockedTiles(world.size, world.furniture);
    const taken = new Set<number>();
    for (const other of world.guests) {
      if (other.id === guest.id || other.state !== 'WAIT') continue;
      taken.add(other.position.y * world.size + other.position.x);
      const last = other.path[other.path.length - 1];
      if (last) taken.add(last.y * world.size + last.x);
    }
    let spot: Point | null = null;
    for (let y = zone.y + 1; y < zone.y + zone.h - 1 && !spot; y += 1) {
      for (let x = zone.x + 1; x < zone.x + zone.w - 1 && !spot; x += 1) {
        const tile = y * world.size + x;
        if (!taken.has(tile) && isWalkable(world.size, blocked, x, y)) spot = { x, y };
      }
    }
    const target = spot ?? nearestWalkable(world.size, blocked, { x: zone.x + 1, y: zone.y + 1 });
    if (target) sendGuest(world, guest, target);
  }
  if (guest.patience <= 0) {
    // Wer keine Geduld mehr hat, entscheidet sich zu gehen, statt das Inventar zu zerlegen.
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    guest.path = [];
    guest.intent = 'Geduld aufgebraucht: verlaesst enttaeuscht.';
  }
}

function tryGame(world: WorldState, guest: Guest, wallet: VaCoinMicro, prng: Prng): boolean {
  const candidates = world.furniture
    .filter((item) => item.gameId && !item.damaged && item.condition >= 18 && freeSeat(item))
    .map((item) => ({ item, weight: offerScore(world, guest, item, wallet) }))
    .filter((entry) => entry.weight > 0);
  const chosen = pickWeighted(prng, candidates, (item) => startActivity(world, guest, item));
  return chosen !== null;
}

export function chooseActivity(world: WorldState, guest: Guest, ledger: Ledger, prng: Prng): void {
  refreshNeeds(guest);
  const wallet = ledger.getBalance(guestAccount(guest.id));
  // Der billigste Einsatz entscheidet, ob sich Warten ueberhaupt lohnen kann.
  const cheapest = world.furniture.reduce((min, item) => (item.gameId
    ? Math.min(min, Math.max(world.prices.slotMinBet, item.baseBet)) : min), Number.POSITIVE_INFINITY);
  const minBet = Number.isFinite(cheapest) ? cheapest : world.prices.slotMinBet;
  if (wallet < minBet) {
    guest.intent = 'Zu wenig Chips fuer den Mindesteinsatz: will auszahlen.';
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    guest.path = [];
    if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
    guest.targetFurniture = 0;
    return;
  }

  const wantsToilet = guest.need === 'toilet' || guest.patience < 22 || guest.mood < 22;
  if (wantsToilet) {
    const toilet = world.furniture.find((item) => item.kind === 'TOILET' && !item.clogged && freeSeat(item));
    if (toilet && startActivity(world, guest, toilet)) return;
  }

  const wantsDrink = wallet >= world.prices.drinkPrice
    && (guest.need === 'drink' || guest.mood < 44 || guest.patience < 38 || (guest.sociability > 68 && guest.mood < 55));
  if (wantsDrink) {
    const bar = world.furniture.find((item) => item.kind === 'BAR' && item.stock > 0 && freeSeat(item));
    if (bar && startActivity(world, guest, bar)) return;
  }

  if (guest.need === 'social' || (guest.sociability > 72 && guest.mood < 50 && guest.addiction < 20)) {
    const sofa = world.furniture.find((item) => item.kind === 'DECOR' && item.seats > 0 && freeSeat(item));
    if (sofa && startActivity(world, guest, sofa)) return;
  }

  if (tryGame(world, guest, wallet, prng)) return;

  // Kein freier Spielplatz: erst Bar mit Bestand, dann Sofa, dann freies Klo, sonst warten.
  const bar = world.furniture.find((item) => item.kind === 'BAR' && item.stock > 0 && freeSeat(item));
  if (bar && wallet >= world.prices.drinkPrice && startActivity(world, guest, bar)) return;
  const sofa = world.furniture.find((item) => item.kind === 'DECOR' && item.seats > 0 && freeSeat(item));
  if (sofa && startActivity(world, guest, sofa)) return;
  const toilet = world.furniture.find((item) => item.kind === 'TOILET' && !item.clogged && freeSeat(item));
  if (toilet && startActivity(world, guest, toilet)) return;
  waitForSpace(world, guest);
}
