/** Fail-closed-Pruefung des Layout-Vertrags: ungueltige Daten kommen nie in die Welt. */
import { edgeInBounds, edgeKey, freezeLayout } from './layout-edges';
import {
  FLOOR_MATERIALS, LAYOUT_SIZES, ZONE_KINDS,
  type EdgeAxis, type EdgeKind, type FloorMaterialId, type LayoutEdge, type LayoutState, type LayoutZone, type ZoneKind,
} from './layout-types';

type LayoutParse =
  | { readonly ok: true; readonly layout: LayoutState }
  | { readonly ok: false; readonly issues: readonly string[] };

const MATERIALS: ReadonlySet<string> = new Set(FLOOR_MATERIALS);
const KINDS: ReadonlySet<string> = new Set(ZONE_KINDS);
const AXES: ReadonlySet<string> = new Set(['H', 'V']);
const EDGE_KINDS: ReadonlySet<string> = new Set(['WALL', 'DOOR', 'OPENING']);
const SIZES: readonly number[] = LAYOUT_SIZES;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function parseZone(raw: unknown, size: number, issues: string[]): LayoutZone | null {
  if (!isObject(raw)) {
    issues.push('Zone ist kein Objekt.');
    return null;
  }
  const kind = raw.kind;
  if (!isText(raw.id) || !isText(raw.name) || typeof kind !== 'string' || !KINDS.has(kind)) {
    issues.push(`Zone unvollstaendig oder unbekannt: ${String(raw.id)}.`);
    return null;
  }
  const { x, y, w, h, color } = raw;
  const outside = !isInt(x) || !isInt(y) || !isInt(w) || !isInt(h)
    || w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > size || y + h > size;
  if (outside) {
    issues.push(`Zone ${raw.id} liegt ausserhalb des Rasters.`);
    return null;
  }
  if (!isInt(color) || color < 0) {
    issues.push(`Zone ${raw.id} hat keine gueltige Farbe.`);
    return null;
  }
  return { id: raw.id, name: raw.name, kind: kind as ZoneKind, x, y, w, h, color };
}

function parseEdge(raw: unknown, size: number, issues: string[]): LayoutEdge | null {
  if (!isObject(raw)) {
    issues.push('Kante ist kein Objekt.');
    return null;
  }
  const { axis, kind, x, y, id, zoneId } = raw;
  if (typeof axis !== 'string' || !AXES.has(axis) || typeof kind !== 'string' || !EDGE_KINDS.has(kind)) {
    issues.push('Kante ohne gueltige Achse oder Art.');
    return null;
  }
  if (!isInt(x) || !isInt(y) || !edgeInBounds(axis as EdgeAxis, x, y, size)) {
    issues.push(`Kante ${axis}:${String(x)}:${String(y)} liegt ausserhalb des Rasters.`);
    return null;
  }
  if (id !== null && !isText(id)) {
    issues.push('Kanten-ID ist weder Text noch null.');
    return null;
  }
  if (zoneId !== null && !isText(zoneId)) {
    issues.push('Kanten-Zonenreferenz ist weder Text noch null.');
    return null;
  }
  // Eine Wand mit Tuer-ID waere eine zweite Darstellung derselben Tuer.
  if (kind === 'WALL' && id !== null) {
    issues.push('Wand traegt eine Tuer-ID: widerspruechliche Darstellung.');
    return null;
  }
  if (kind !== 'WALL' && id === null) {
    issues.push('Tuer oder Durchgang ohne stabile ID.');
    return null;
  }
  return { axis: axis as EdgeAxis, x, y, kind: kind as EdgeKind, id, zoneId };
}

function parseFloor(raw: unknown, size: number, issues: string[]): FloorMaterialId[] {
  const floor: FloorMaterialId[] = [];
  if (!Array.isArray(raw) || raw.length !== size * size) {
    issues.push(`Boden braucht genau ${size * size} Tiles.`);
    return floor;
  }
  for (const material of raw) {
    if (typeof material !== 'string' || !MATERIALS.has(material)) {
      issues.push(`Bodenmaterial unbekannt: ${String(material)}.`);
      continue;
    }
    floor.push(material as FloorMaterialId);
  }
  return floor;
}

/** Prueft jede Referenz, jede Kante und jede Flaeche; ein Befund macht das Ganze ungueltig. */
export function parseLayout(raw: unknown): LayoutParse {
  const issues: string[] = [];
  if (!isObject(raw)) return { ok: false, issues: ['Layout ist kein Objekt.'] };
  if (!isInt(raw.size) || !SIZES.includes(raw.size)) {
    return { ok: false, issues: [`Layout-Groesse ungueltig: ${String(raw.size)}.`] };
  }
  const size = raw.size;
  const floor = parseFloor(raw.floor, size, issues);

  const zones: LayoutZone[] = [];
  const zoneIds = new Set<string>();
  if (!Array.isArray(raw.zones) || raw.zones.length === 0) {
    issues.push('Layout braucht mindestens eine Zone.');
  } else {
    for (const entry of raw.zones) {
      const zone = parseZone(entry, size, issues);
      if (!zone) continue;
      if (zoneIds.has(zone.id)) {
        issues.push(`Zonen-ID doppelt: ${zone.id}.`);
        continue;
      }
      zoneIds.add(zone.id);
      zones.push(zone);
    }
  }

  const edges: LayoutEdge[] = [];
  const keys = new Set<string>();
  const doorIds = new Set<string>();
  if (!Array.isArray(raw.edges)) {
    issues.push('Kanten fehlen.');
  } else {
    for (const entry of raw.edges) {
      const edge = parseEdge(entry, size, issues);
      if (!edge) continue;
      const key = edgeKey(edge.axis, edge.x, edge.y);
      if (keys.has(key)) {
        issues.push(`Kante doppelt belegt: ${key}.`);
        continue;
      }
      keys.add(key);
      edges.push(edge);
      if (edge.id !== null) {
        if (doorIds.has(edge.id)) issues.push(`Tuer-ID doppelt: ${edge.id}.`);
        else doorIds.add(edge.id);
      }
      if (edge.zoneId !== null && !zoneIds.has(edge.zoneId)) {
        issues.push(`Kante ${key} verweist auf unbekannte Zone ${edge.zoneId}.`);
      }
    }
  }
  if (edges.length > 0 && !edges.some((edge) => edge.kind === 'DOOR')) {
    issues.push('Kein Durchgang: das Haus waere geschlossen.');
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, layout: freezeLayout(size, floor, zones, edges) };
}
