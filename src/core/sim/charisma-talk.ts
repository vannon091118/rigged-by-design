/** Charisma-Ansprache: Erfolg hebt die Laune, ein Fehlschlag kann zur Prügelei werden. */
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { grantGlobalXp } from './player-rpg';
import { maybeStartBrawl } from './disputes';
import { becomeAngry } from './guest-service';
import type { WorldState } from './types';
import { guestById } from './world';

const TALK_COOLDOWN = 60;
const BACKFIRE_THRESHOLD = 25;
const XP_TALK_SUCCESS = 20;

interface TalkResult {
  readonly success: boolean;
  readonly chance: number;
}

/** Erfolgschance in Prozent-Punkten (0..100): Basis 40, +10 je Charisma-Stufe, Laune zaehlt mit. */
export function talkChance(world: WorldState, guestId: number): number {
  const guest = guestById(world, guestId);
  if (!guest) return 0;
  const base = 40 + world.player.rpg.charismaLevel * 10;
  const moodBonus = Math.round((guest.mood - 50) / 5);
  return Math.max(5, Math.min(95, base + moodBonus));
}

/** Zieht den Ausgang aus einer Verteilung; die angezeigte Chance ist genau diese. */
export function talkToGuest(world: WorldState, prng: Prng, guestId: number): TalkResult | null {
  const guest = guestById(world, guestId);
  if (!guest || (guest.talkReadyTick ?? 0) > world.tick) return null;
  const chance = talkChance(world, guestId);
  const dist = buildDistribution(1, 100);
  const roll = rollNumber(prng, dist);
  const success = roll.value <= chance;
  guest.talkReadyTick = world.tick + TALK_COOLDOWN;
  if (success) {
    guest.mood = Math.min(100, guest.mood + 25);
    guest.patience = Math.min(100, guest.patience + 20);
    guest.addiction = Math.min(100, guest.addiction + 10);
    grantGlobalXp(world.player.rpg, 'TALK_SUCCESS', XP_TALK_SUCCESS);
    world.lastEvent = `${guest.name} lässt sich vom Charme beeindrucken.`;
  } else {
    guest.mood = Math.max(0, guest.mood - 25);
    guest.patience = Math.max(0, guest.patience - 20);
    world.lastEvent = `${guest.name} findet den Spruch daneben.`;
    if (guest.mood < BACKFIRE_THRESHOLD) {
      becomeAngry(world, guest);
      maybeStartBrawl(world, prng, true);
    }
  }
  return { success, chance };
}
