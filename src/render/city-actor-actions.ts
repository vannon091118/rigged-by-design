/** Aktionen einer sichtbaren Stadtfigur: npcId statt Casino-Guest-ID. */
import type { GameView } from '../store/types';
import type { MenuAction } from './floor-actions';

/**
 * Eine Stadtfigur wird ueber ihre npcId angesprochen. Anwesenheit und
 * Reichweite kommen aus dem vorhandenen Stadt-View; es gibt keinen zweiten
 * Gast-Command und keine neue Stadtwahrheit.
 */
export function buildCityActorActions(view: GameView, npcId: string): MenuAction[] {
  const actor = view.cityActors.find((entry) => entry.npcId === npcId);
  if (!actor) return [];
  const resident = view.city?.residents.find((entry) => entry.npcId === npcId);
  // Der Stadt-View ist die eine Wahrheit fuer Anwesenheit; eine gerenderte
  // Figur auf dem Weg oder an einem anderen Ort ist kein Walk-Up-Ziel.
  const available = resident && view.city
    ? resident.location === view.city.location && !resident.travelTo
    : !actor.traveling;
  const reachable = available
    && Math.abs(view.player.position.x - actor.x) + Math.abs(view.player.position.y - actor.y) <= 2;
  return [{
    id: 'CITY_MEET',
    label: `${actor.name} ansprechen`,
    enabled: reachable,
    npcId: actor.npcId,
    reason: !available ? 'Ist gerade nicht hier.' : reachable ? undefined : 'Geh näher heran.',
  }];
}
