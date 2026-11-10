/** Tastenpfad: das naechste Ziel in Reichweite, deterministisch nach Rang, Distanz und ID. */
import type { InteractionKind, InteractionTarget } from './interaction';
import type { Furniture, Point, WorldState } from './types';

const KIND_RANK: Record<InteractionKind, number> = { guest: 0, furniture: 1, crate: 2, stain: 3 };

function distanceTo(item: Furniture, from: Point): number {
  const dx = Math.max(item.x - from.x, 0, from.x - (item.x + item.w - 1));
  const dy = Math.max(item.y - from.y, 0, from.y - (item.y + item.h - 1));
  return dx + dy;
}

export function nearestTarget(world: WorldState, from: Point, maxDistance = 4): InteractionTarget | null {
  const found: { target: InteractionTarget; distance: number }[] = [];
  for (const guest of world.guests) {
    found.push({
      target: { kind: 'guest', id: guest.id },
      distance: Math.abs(guest.position.x - from.x) + Math.abs(guest.position.y - from.y),
    });
  }
  for (const item of world.furniture) {
    found.push({ target: { kind: 'furniture', id: item.id }, distance: distanceTo(item, from) });
  }
  for (const crate of world.crates) {
    if (crate.carriedBy !== null) continue;
    found.push({
      target: { kind: 'crate', id: crate.id },
      distance: Math.abs(crate.x - from.x) + Math.abs(crate.y - from.y),
    });
  }
  for (const stain of world.stains) {
    found.push({
      target: { kind: 'stain', id: stain.id },
      distance: Math.abs(stain.x - from.x) + Math.abs(stain.y - from.y),
    });
  }
  found.sort((a, b) => a.distance - b.distance
    || KIND_RANK[a.target.kind] - KIND_RANK[b.target.kind]
    || a.target.id - b.target.id);
  const nearest = found.find((entry) => entry.distance <= maxDistance);
  return nearest?.target ?? null;
}
