/**
 * Stationsgeometrie und Bereitschaft fuer die aktive Betreiberarbeit.
 *
 * Eine Zustaendigkeit: Wo steht welche Station, wer steht daran, und was fehlt
 * gerade. Die Ausfuehrung selbst liegt in `business-active-work.ts`; hier wird
 * nichts gebucht, nichts veraendert und kein Zufall gezogen.
 */
import { propertyWorld } from './property';
import type { Furniture, Guest, StaffRole, WorldState, Zone } from './types';

export type BusinessWorkTaskId = 'BARKEEP' | 'CROUPIER' | 'HOST';

/** Die Naehe, die eine Handlung an der Station verlangt; dieselbe Groesse wie am Tresen. */
export const BUSINESS_WORK_RANGE = 3;

interface WorkStationReadiness {
  readonly ready: boolean;
  readonly reason: string;
}

const near = (ax: number, ay: number, bx: number, by: number, range: number): boolean =>
  Math.abs(ax - bx) + Math.abs(ay - by) <= range;

export function zoneFor(zones: readonly Zone[], kind: Zone['kind']): Zone | null {
  return zones.find((zone) => zone.kind === kind) ?? null;
}

export function inside(
  zone: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  x: number,
  y: number,
): boolean {
  return x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h;
}

/** Der Gast, der gerade an genau diesem Objekt bedient wird. */
export function guestAt(world: WorldState, item: Furniture, state: Guest['state']): Guest | null {
  return world.guests.find((guest) => guest.targetFurniture === item.id && guest.state === state) ?? null;
}

/** Ein Gast, der in dieser Zone steht und nicht schon geht. */
export function guestIn(zone: Zone, guests: readonly Guest[]): Guest | null {
  return [...guests]
    .filter((guest) => guest.state !== 'LEAVE' && inside(zone, guest.position.x, guest.position.y))
    .sort((left, right) => left.mood - right.mood)[0] ?? null;
}

function staffCovers(world: WorldState, role: StaffRole, item: Furniture): boolean {
  return world.agents.some((agent) => agent.role === role
    && near(agent.x, agent.y, item.x, item.y, 4));
}

export function barStation(world: WorldState): Furniture | null {
  return world.furniture.find((item) => item.kind === 'BAR' && zoneOf(world, item)?.kind === 'BAR') ?? null;
}

export function gamingStation(world: WorldState): Furniture | null {
  return world.furniture.find((item) => item.gameId != null && zoneOf(world, item)?.kind === 'GAMING') ?? null;
}

function zoneOf(world: WorldState, item: Furniture): Zone | null {
  return world.zones.find((zone) => inside(zone, item.x, item.y)) ?? null;
}

/** Was an dieser Aufgabe gerade fehlt; dieselbe Reihenfolge der Gruende wie im Panel. */
export function stationReadiness(world: WorldState, task: BusinessWorkTaskId): WorkStationReadiness {
  if (world.player.properties.length === 0) return { ready: false, reason: 'Ohne eigene Immobilie fuehrst du keinen Betrieb.' };
  const binding = propertyWorld(world);
  if (binding === null || binding.area === null) return { ready: false, reason: 'Der Immobilie fehlt eine Flaeche im Raster.' };
  const barZone = zoneFor(binding.zones, 'BAR');
  const gamingZone = zoneFor(binding.zones, 'GAMING');
  const loungeZone = zoneFor(binding.zones, 'LOUNGE');
  if (task === 'BARKEEP') {
    const bar = barStation(world);
    if (!barZone || !bar) return { ready: false, reason: 'Keine Bar auf der eigenen Flaeche.' };
    if (staffCovers(world, 'bartender', bar)) return { ready: false, reason: 'Der Barkeeper steht schon am Tresen: er bedient diese Schicht.' };
    if (!near(world.player.position.x, world.player.position.y, bar.x, bar.y, BUSINESS_WORK_RANGE)) {
      return { ready: false, reason: 'Geh an den eigenen Tresen.' };
    }
    if (bar.stock <= 0) return { ready: false, reason: 'Die Bar ist leer: erst Getraenke nachfuellen.' };
    if (!guestAt(world, bar, 'DRINK')) return { ready: false, reason: 'Kein Gast wartet gerade an der Bar auf einen Drink.' };
    return { ready: true, reason: 'Ein Gast wartet am Tresen.' };
  }
  if (task === 'CROUPIER') {
    const machine = gamingStation(world);
    if (!gamingZone || !machine) return { ready: false, reason: 'Kein Tisch oder Automat auf der eigenen Casino-Flaeche.' };
    if (!near(world.player.position.x, world.player.position.y, machine.x, machine.y, BUSINESS_WORK_RANGE)) {
      return { ready: false, reason: 'Geh an deinen Tisch.' };
    }
    if (!guestAt(world, machine, 'PLAY')) return { ready: false, reason: 'Niemand spielt gerade an deinem Tisch.' };
    return { ready: true, reason: 'Ein Gast spielt an deinem Tisch.' };
  }
  if (!loungeZone) return { ready: false, reason: 'Keine Lounge auf der eigenen Flaeche.' };
  if (!near(world.player.position.x, world.player.position.y, loungeZone.x + 1, loungeZone.y + 1, BUSINESS_WORK_RANGE)) {
    return { ready: false, reason: 'Geh in deine Lounge.' };
  }
  if (guestIn(loungeZone, binding.guests) === null) return { ready: false, reason: 'Kein Gast in der Lounge.' };
  return { ready: true, reason: 'Ein Gast wartet auf Betreuung.' };
}
