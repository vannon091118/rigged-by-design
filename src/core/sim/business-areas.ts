/**
 * Modulare Business-Bereiche: das Haus fuehrt seine Bereiche im einen
 * WorldState, diese Ableitung nennt sie mit echten Zahlen.
 *
 * Kein zweites Modul-Register und keine neuen Save-Felder: ein Bereich ist die
 * vorhandene Zone (`ZoneKind`), seine Belegung ergibt sich aus den Objekten,
 * die in dieser Zone stehen, und aus den Gaesten, die sie ansteuern. Ein Konto
 * (`HAUSKONTO`) und eine Besuchersimulation bleiben unveraendert.
 */
import type { ZoneKind } from './layout-types';
import type { Furniture, Guest, Zone } from './types';

interface AreaDef {
  readonly id: 'CASINO' | 'BAR' | 'LOUNGE';
  readonly name: string;
  /** Die ZoneKinds, die diesen Bereich raeumlich tragen. */
  readonly kinds: readonly ZoneKind[];
}

/** Ausgabe-Reihenfolge und Bedeutung der Bereiche; neue Bereiche brauchen eine eigene Zone. */
export const BUSINESS_AREAS: readonly AreaDef[] = [
  { id: 'CASINO', name: 'Casino', kinds: ['GAMING'] },
  { id: 'BAR', name: 'Bar', kinds: ['BAR'] },
  { id: 'LOUNGE', name: 'Lounge', kinds: ['LOUNGE'] },
];

export type BusinessAreaId = AreaDef['id'];

export interface BusinessArea {
  readonly id: BusinessAreaId;
  readonly name: string;
  /** Ohne Zone im Layout fuehrt das Haus diesen Bereich nicht. */
  readonly open: boolean;
  readonly zones: number;
  /** Objekte, deren Ankerpunkt in einer Zone des Bereichs liegt. */
  readonly objects: number;
  readonly seats: number;
  /** Gaeste, die den Bereich ansteuern oder darin stehen; jeder Gast zaehlt einmal. */
  readonly guests: number;
}

/** Was die Ableitung liest: der Weltzustand oder eine Sicht mit denselben Feldern. */
export interface BusinessAreaSource {
  readonly zones: readonly Zone[];
  readonly furniture: readonly Furniture[];
  readonly guests: readonly Guest[];
}

const inside = (zone: Zone, x: number, y: number): boolean =>
  x >= zone.x && y >= zone.y && x < zone.x + zone.w && y < zone.y + zone.h;

function zoneAt(zones: readonly Zone[], x: number, y: number): Zone | null {
  for (const zone of zones) if (inside(zone, x, y)) return zone;
  return null;
}

/**
 * Ein Gast gehoert dem Bereich, den er gerade ansteuert; ohne Ziel entscheidet
 * sein Standort. Dadurch zaehlt er nie in zwei Bereichen gleichzeitig.
 */
function areaOfGuest(source: BusinessAreaSource, guest: Guest): Zone | null {
  const target = source.furniture.find((item) => item.id === guest.targetFurniture);
  return (target ? zoneAt(source.zones, target.x, target.y) : null)
    ?? zoneAt(source.zones, guest.position.x, guest.position.y);
}

export function businessAreas(source: BusinessAreaSource): readonly BusinessArea[] {
  return BUSINESS_AREAS.map((area) => {
    const zones = source.zones.filter((zone) => area.kinds.includes(zone.kind));
    const objects = source.furniture.filter((item) => zoneAt(zones, item.x, item.y) !== null);
    let guests = 0;
    for (const guest of source.guests) {
      const zone = areaOfGuest(source, guest);
      if (zone && zones.some((candidate) => candidate.id === zone.id)) guests += 1;
    }
    return {
      id: area.id,
      name: area.name,
      open: zones.length > 0,
      zones: zones.length,
      objects: objects.length,
      seats: objects.reduce((sum, item) => sum + item.seats, 0),
      guests,
    };
  });
}
