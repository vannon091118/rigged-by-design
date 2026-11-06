/**
 * Typisierte Layout-Commands: der Editor beschreibt eine Absicht, das Modul
 * baut daraus ein neues, unveraenderliches Layout. Kein UI-, Renderer- oder
 * Simulationswissen; jede Aenderung laeuft am Ende durch denselben Parser wie
 * ein Save und wird sonst verworfen.
 */
import { LayoutContractError } from './layout';
import { edgeInBounds, freezeLayout } from './layout-edges';
import {
  FLOOR_MATERIALS, type EdgeAxis, type EdgeKind, type FloorMaterialId, type LayoutEdge, type LayoutState,
} from './layout-types';
import { parseLayout } from './layout-validate';

/** Rechteck in Tiles; `w`/`h` zaehlen Tiles, nicht Kanten. */
export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Genau eine Rasterkante, wie im Layout-Vertrag verankert. */
export interface EdgeCell {
  readonly axis: EdgeAxis;
  readonly x: number;
  readonly y: number;
}

/** Was der Editor malen kann: Bodenmaterial oder einen Kantenzustand. */
export type LayoutCommand =
  | { readonly kind: 'FLOOR'; readonly rect: TileRect; readonly material: FloorMaterialId }
  | {
    readonly kind: 'EDGES';
    readonly cells: readonly EdgeCell[];
    readonly edge: EdgeKind | 'NONE';
    /** Nur fuer Tueren/Durchgaenge; ohne Angabe entsteht eine stabile ID aus der Kante. */
    readonly idPrefix?: string;
  };

const MATERIALS: ReadonlySet<string> = new Set(FLOOR_MATERIALS);
const EDGE_KINDS: ReadonlySet<string> = new Set(['WALL', 'DOOR', 'OPENING', 'NONE']);
const AXES: ReadonlySet<string> = new Set(['H', 'V']);
const isInt = (value: number): boolean => Number.isInteger(value);

function validateRect(rect: TileRect, size: number, issues: string[]): void {
  if (![rect.x, rect.y, rect.w, rect.h].every(isInt) || rect.w <= 0 || rect.h <= 0) {
    issues.push('Pinselrechteck braucht ganze Zahlen und eine positive Groesse.');
    return;
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > size || rect.y + rect.h > size) {
    issues.push(`Pinselrechteck liegt ausserhalb des Rasters: ${rect.x},${rect.y} ${rect.w}x${rect.h}.`);
  }
}

function paintFloor(layout: LayoutState, rect: TileRect, material: FloorMaterialId): LayoutState {
  const issues: string[] = [];
  if (!MATERIALS.has(material)) issues.push(`Bodenmaterial unbekannt: ${String(material)}.`);
  validateRect(rect, layout.size, issues);
  if (issues.length > 0) throw new LayoutContractError(issues);
  const floor = [...layout.floor];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) floor[y * layout.size + x] = material;
  }
  return freezeLayout(layout.size, floor, layout.zones, layout.edges);
}

/** Stabile Tür-ID je Kante; vorhandene IDs bleiben beim Uebermalen erhalten. */
function edgeFor(cell: EdgeCell, edge: EdgeKind | 'NONE', idPrefix: string | undefined, previous: LayoutEdge | undefined): LayoutEdge {
  const kind = edge as EdgeKind;
  if (kind === 'WALL') return { ...cell, kind, id: null, zoneId: previous?.zoneId ?? null };
  if (previous && previous.kind === kind) return { ...previous, ...cell };
  return {
    ...cell,
    kind,
    id: `${idPrefix ?? (kind === 'DOOR' ? 'door' : 'opening')}:${cell.axis}:${cell.x}:${cell.y}`,
    zoneId: previous?.zoneId ?? null,
  };
}

function paintEdges(layout: LayoutState, cells: readonly EdgeCell[], edge: EdgeKind | 'NONE', idPrefix?: string): LayoutState {
  const issues: string[] = [];
  if (!EDGE_KINDS.has(edge)) issues.push(`Kantenzustand unbekannt: ${String(edge)}.`);
  for (const cell of cells) {
    if (!AXES.has(cell.axis) || !edgeInBounds(cell.axis, cell.x, cell.y, layout.size)) {
      issues.push(`Kante ausserhalb des Rasters: ${String(cell.axis)}:${cell.x}:${cell.y}.`);
    }
  }
  if (idPrefix !== undefined && !/^[a-z0-9-]+$/.test(idPrefix)) {
    issues.push(`Kanten-ID-Praefix ungueltig: ${idPrefix}.`);
  }
  if (issues.length > 0) throw new LayoutContractError(issues);

  const byKey = new Map<string, LayoutEdge>();
  for (const existing of layout.edges) byKey.set(`${existing.axis}:${existing.x}:${existing.y}`, existing);
  for (const cell of cells) {
    const key = `${cell.axis}:${cell.x}:${cell.y}`;
    if (edge === 'NONE') byKey.delete(key);
    else byKey.set(key, edgeFor(cell, edge, idPrefix, byKey.get(key)));
  }
  return freezeLayout(layout.size, layout.floor, layout.zones, [...byKey.values()]);
}

/**
 * Wendet genau einen Command an. Das Ergebnis ist wieder eingefroren und wird
 * gegen denselben Vertrag geprueft wie ein geladenes Layout; ungueltige
 * Zustaende (z. B. die letzte Tuer zumauern) kommen nie in die Welt.
 */
export function applyLayoutCommand(layout: LayoutState, command: LayoutCommand): LayoutState {
  const next = command.kind === 'FLOOR'
    ? paintFloor(layout, command.rect, command.material)
    : paintEdges(layout, command.cells, command.edge, command.idPrefix);
  const parsed = parseLayout(next);
  if (!parsed.ok) throw new LayoutContractError(parsed.issues);
  return parsed.layout;
}
