/** Bewohner als Renderdaten: eine Ableitung aus dem Stadtleben, keine Kopie. */
import { cityLifeView } from '../core/sim/city-life';
import type { CitySceneState } from '../core/sim/types';
import type { CityActorView } from './types';

/**
 * Nur in der Stadt entstehen Strassenfiguren; ausserhalb bleibt die Liste leer.
 * Die Kennung ist die NPC-ID, damit der Renderer Figuren ueber Ticks behaelt.
 */
export function cityActorViews(
  city: CitySceneState | null, world: Parameters<typeof cityLifeView>[0],
): readonly CityActorView[] {
  if (!city) return [];
  return cityLifeView(world).map((resident) => ({
    npcId: resident.npcId,
    name: resident.name,
    role: resident.role,
    x: resident.position.x,
    y: resident.position.y,
    traveling: resident.travelTo !== null,
  }));
}
