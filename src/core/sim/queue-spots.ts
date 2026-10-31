/** Kassenschlange: eindeutige, erreichbare Wartepositionen – auch bei grossem Andrang. */
import { isWalkable } from './pathfinding';
import type { Guest, Point, WorldState } from './types';
import { exchangePoint, guestBlocked, pathTo } from './world';

/**
 * Kandidatenpositionen als Ringe um den Schalter, innen nach aussen. Die Liste
 * haengt nur an statischer Geometrie, deshalb erzeugt jeder Gast derselbe
 * Ergebnis – Rang und Kandidat passen 1:1 zusammen und zwei Wartende koennen
 * nicht dasselbe Ziel haben. Es gibt auch keine feste Schrittgrenze: die Reihe
 * wächst, bis jeder Rang seinen eigenen Platz hat.
 */
function queueCandidates(world: WorldState, point: Point, limit: number): Point[] {
  const blocked = guestBlocked(world);
  const spots: Point[] = [{ x: point.x, y: point.y }];
  const seen = new Set<number>([point.y * world.size + point.x]);
  for (let ring = 1; spots.length < limit && ring <= world.size; ring += 1) {
    for (let dy = -ring; dy <= ring && spots.length < limit; dy += 1) {
      const dx = ring - Math.abs(dy);
      // Zuerst nach links: die Schlange legt sich um den Schalter, nicht davor.
      for (const step of dx === 0 ? [0] : [-dx, dx]) {
        if (spots.length >= limit) break;
        const x = point.x + step;
        const y = point.y + dy;
        if (x < 0 || y < 0 || x >= world.size || y >= world.size) continue;
        const key = y * world.size + x;
        if (seen.has(key) || !isWalkable(world.size, blocked, x, y)) continue;
        seen.add(key);
        spots.push({ x, y });
      }
    }
  }
  return spots;
}

/**
 * Platz des Gastes in der Warteschlange. Rang 0 steht am Bedienpunkt, jeder
 * naechste Rang einen Platz weiter im Ring. Faehlt der Rang an begehbarem
 * Boden (die Schlange ist groesser als der Grundriss), bleibt zumindest der
 * tiefste erreichbare Platz stehen – nie aber der Bedienpunkt fuer alle.
 */
export function deskQueueSpot(world: WorldState, guest: Guest): Point {
  const point = exchangePoint(world);
  if (!point) return guest.position;
  const spots = queueCandidates(world, point, Math.max(0, guest.queueIndex) + 1);
  return spots[spots.length - 1]!;
}

/** Schickt einen Gast auf seinen Platz in der Kassenschlange; nur bei geaendertem Ziel neu. */
export function sendGuestToQueue(world: WorldState, guest: Guest): void {
  const target = deskQueueSpot(world, guest);
  const last = guest.path[guest.path.length - 1];
  if (last && last.x === target.x && last.y === target.y) return;
  guest.path = pathTo(world, guest.position, target);
  guest.pathIndex = 0;
}
