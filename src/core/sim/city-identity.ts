/**
 * @module city-identity — Kennung statt Name
 *
 * Jeder Bewohner bekommt eine individuelle Kennung, die auf sein Profil zeigt.
 * Die Sicht und die Traits lesen diese Kennung; ein Gast mit demselben Namen
 * bleibt ein anderer Mensch. Ein Save ohne Kennung wird beim Laden gebunden,
 * nicht neu erfunden.
 *
 * Die Figur zu einer Kennung kommt aus der Besetzung (`city-npc-roster`), damit
 * dieselbe Regel für Rita, Boris, Mira und jeden weiteren Bewohner gilt.
 */
import { ensureCityVisitor } from './city-npcs';
import { rosterDefById } from './city-npc-roster';
import type { WorldState } from './types';

/**
 * Bindet alle Bewohner an ihr Profil. Idempotent: ist die Kennung schon
 * gesetzt, bleibt der Zustand derselbe (kein neues Objekt, kein Save-Drift).
 */
export function bindCityIdentities(world: WorldState): void {
  const life = world.cityLife;
  if (!life) return;
  const seed = life.seed ?? 0;
  let changed = false;
  const residents = life.residents.map((resident) => {
    const def = rosterDefById(resident.npcId, seed);
    if (!def) return resident;
    const visitorId = ensureCityVisitor(world, def).id;
    if (resident.visitorId === visitorId) return resident;
    changed = true;
    return { ...resident, visitorId };
  });
  if (changed) world.cityLife = { ...life, residents };
}
