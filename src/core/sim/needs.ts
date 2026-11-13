/** Bedürfnisse: ein 180-Punkte-Profil pro Gast, Durst und Blase steuern die Zielwahl. */
import type { Prng } from '../rng/prng';
import { getPersona } from './personas';
import { driftNeed, needAtLeast, satisfyNeed } from './needs-core';
import type { Guest, WorldState } from './types';
import { dirtyTileIndex } from './emotion';

const MAX_PROFILE_POINTS = 180;

/** Verteilt exakt 180 Punkte auf Laune, Geduld und Sucht; jeder Wert bleibt 0..100. */
export function rollProfile(prng: Prng, addictionRate: number, patienceWeight = 1): [number, number, number] {
  const values = [0, 0, 0];
  // Geduld (Persona 68..138) und Suchtneigung ziehen am selben 180-Punkte-Pool; die Summe bleibt konstant.
  const weights = [1, Math.max(0.2, Math.min(2, patienceWeight)), Math.max(0.2, Math.min(2, addictionRate))];
  for (let i = 0; i < MAX_PROFILE_POINTS; i += 1) {
    const open = weights.map((weight, index) => (values[index]! >= 100 ? 0 : weight));
    const total = open[0]! + open[1]! + open[2]!;
    let roll = prng.nextFloat() * total;
    let picked = open.findIndex((weight) => weight > 0);
    for (let index = 0; index < 3; index += 1) {
      if (open[index]! <= 0) continue;
      roll -= open[index]!;
      if (roll <= 0) { picked = index; break; }
    }
    values[picked]! += 1;
  }
  return [values[0]!, values[1]!, values[2]!];
}

/** Körper schlägt Modus: volle Blase und Durst setzen das Bedürfnis, sonst zurück zum Spiel. */
export function refreshNeeds(guest: Guest): void {
  if (needAtLeast(guest.bladder, 70)) guest.need = 'toilet';
  else if (needAtLeast(guest.thirst, 65)) guest.need = 'drink';
  else if (guest.need === 'drink' && !needAtLeast(guest.thirst, 30)) guest.need = 'play';
  else if (guest.need === 'toilet' && !needAtLeast(guest.bladder, 30)) guest.need = 'play';
}

/** Durst und Blase steigen mit der Persona; eine volle Blase endet im Unfall statt im Nichts. */
export function tickNeeds(world: WorldState, guest: Guest): void {
  const drinkRate = getPersona(guest.persona).drinkRate;
  // Durst steigt langsam: ein Drink ist eine Pause am Spiel, kein Dauerzustand.
  guest.thirst = driftNeed(guest.thirst, 0.3, drinkRate * 0.5);
  guest.bladder = driftNeed(guest.bladder, 0.5);
  if (needAtLeast(guest.thirst, 100)) guest.mood = satisfyNeed(guest.mood, 0.3);
  if (needAtLeast(guest.bladder, 100)) {
    guest.bladder = 35;
    guest.mood = satisfyNeed(guest.mood, 8);
    world.dirty.add(dirtyTileIndex(world.size, guest.position.x, guest.position.y));
    world.lastEvent = `${guest.name} hatte einen Unfall.`;
  }
}
