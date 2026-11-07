/** Geometrie fuer Kollisionen: naechster Punkt, Punkt-in-Polygon, Kanten, Oberflaechengeschwindigkeit. */
import { type Body, type Vec2 } from './body';

export const EPS = 1e-9;

export function closestOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq <= EPS) return a;
  const raw = ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq;
  const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  return { x: a.x + abx * t, y: a.y + aby * t };
}

export function insidePolygon(point: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index]!;
    const b = points[previous]!;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function edgesOf(obstacle: Body, points: readonly Vec2[]): readonly (readonly [Vec2, Vec2])[] {
  if (obstacle.shape.kind === 'segment') return [[points[0]!, points[1]!]];
  if (obstacle.shape.kind === 'polygon') {
    return points.map((entry, index) => [entry, points[(index + 1) % points.length]!] as const);
  }
  return [];
}

/** Geschwindigkeit der Hindernisoberflaeche an einem Punkt, inklusive Rotation. */
export function obstacleVelocity(obstacle: Body, point: Vec2): Vec2 {
  if (obstacle.angularVelocity === 0) return obstacle.velocity;
  const rx = point.x - obstacle.position.x;
  const ry = point.y - obstacle.position.y;
  return {
    x: obstacle.velocity.x - obstacle.angularVelocity * ry,
    y: obstacle.velocity.y + obstacle.angularVelocity * rx,
  };
}
