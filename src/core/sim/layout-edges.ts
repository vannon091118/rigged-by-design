/** Kanten-Algebra des Layout-Vertrags: Anker, Grenzen, Rand und Einfrieren. */
import type { EdgeAxis, LayoutEdge, LayoutState, LayoutZone, FloorMaterialId } from './layout-types';

/** Eine Kante hat genau eine Koordinate; der Schluessel ist damit eindeutig. */
export function edgeKey(axis: EdgeAxis, x: number, y: number): string {
  return `${axis}:${x}:${y}`;
}

/** Rasterkanten liegen auf 0..size; alles ausserhalb existiert nicht. */
export function edgeInBounds(axis: EdgeAxis, x: number, y: number, size: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  return axis === 'H'
    ? x >= 0 && x < size && y >= 0 && y <= size
    : x >= 0 && x <= size && y >= 0 && y < size;
}

/** Randkante: die Aussenkante des Rasters, an der die Huelle liegt. */
export function edgeOnRim(edge: LayoutEdge, size: number): boolean {
  return edge.axis === 'H' ? edge.y === 0 || edge.y === size : edge.x === 0 || edge.x === size;
}

/** Kanonische Reihenfolge: Achse, dann Zeile, dann Spalte. Macht Bytes reproduzierbar. */
function sorted(edges: readonly LayoutEdge[]): LayoutEdge[] {
  return [...edges].sort((left, right) => {
    if (left.axis !== right.axis) return left.axis < right.axis ? -1 : 1;
    return left.y - right.y || left.x - right.x;
  });
}

/** Die einzige Stelle, an der ein Layout unveraenderlich wird. */
export function freezeLayout(
  size: number,
  floor: readonly FloorMaterialId[],
  zones: readonly LayoutZone[],
  edges: readonly LayoutEdge[],
): LayoutState {
  return Object.freeze({
    size,
    floor: Object.freeze([...floor]),
    zones: Object.freeze(zones.map((zone) => Object.freeze({ ...zone }))),
    edges: Object.freeze(sorted(edges).map((edge) => Object.freeze({ ...edge }))),
  });
}
