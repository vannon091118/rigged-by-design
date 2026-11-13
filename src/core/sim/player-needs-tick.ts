/** Tick-Anbindung der Spielerbeduerfnisse; eigene Datei haelt tick.ts in seiner LOC-Zone. */
import type { WorldState } from './types';
import { recordJournal } from './journal';
import { normalizePlayerNeeds, tickPlayerNeeds, PLAYER_HUNGER_URGENT, PLAYER_THIRST_URGENT } from './player-needs';
import { needAtLeast } from './needs-core';

export function tickPlayerNeedsInWorld(world: WorldState): void {
  const before = normalizePlayerNeeds(world.player.needs);
  const after = tickPlayerNeeds(before);
  world.player.needs = after;
  if (!needAtLeast(before.hunger, PLAYER_HUNGER_URGENT) && needAtLeast(after.hunger, PLAYER_HUNGER_URGENT)) {
    world.lastEvent = 'Der Hunger meldet sich. Iss etwas, bevor die Arbeit darunter leidet.';
    recordJournal(world, { kind: 'SYSTEM', subject: 'Hunger', cause: 'Der Tag zehrt', effect: world.lastEvent });
  } else if (!needAtLeast(before.thirst, PLAYER_THIRST_URGENT) && needAtLeast(after.thirst, PLAYER_THIRST_URGENT)) {
    world.lastEvent = 'Der Durst meldet sich. Trink etwas, bevor die Arbeit darunter leidet.';
    recordJournal(world, { kind: 'SYSTEM', subject: 'Durst', cause: 'Der Tag zehrt', effect: world.lastEvent });
  }
}
