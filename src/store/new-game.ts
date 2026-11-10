/** Ein neuer Start: Stadt first, leeres eigenes Casino und eine Starter-Kiste. */
import { Ledger } from '../core/economy/ledger';
import { Prng } from '../core/rng/prng';
import { entropySeed } from '../core/rng/streams';
import { openHouse } from '../core/sim/money';
import { seedStartPool } from '../core/sim/narrative/state';
import { createWorld } from '../core/sim/templates';
import type { TemplateId, WorldState } from '../core/sim/types';
import { flushNarrativeCmd } from './narrative-commands';

export interface NewGameState {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly notice: string;
}

export function createNewGame(template: TemplateId): NewGameState {
  const world = createWorld(template);
  world.furniture = [];
  world.stains = [];
  world.dirty.clear();
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0]!;
  const crateSpot = { x: entrance.x + 2, y: entrance.y + 2 };
  world.crates = [{ id: 1, payload: { kind: 'FURNITURE', buildId: 'SLOT' }, x: crateSpot.x, y: crateSpot.y, carriedBy: null }];
  world.nextCrateId = 2;
  world.sceneReturnPosition = { x: crateSpot.x, y: crateSpot.y };
  world.player.position = { x: 2, y: 2 };
  world.player.path = [];
  world.player.pathIndex = 0;
  world.scene = { kind: 'CITY' };
  world.onboarding = { step: 'CITY' };
  world.lastEvent = 'Du stehst in der Stadt. Dein Casino wartet auf den ersten Auftrag.';
  const ledger = new Ledger();
  seedStartPool(world, openHouse(ledger, 0));
  flushNarrativeCmd(world, ledger);
  return { world, ledger, prng: new Prng(entropySeed()), notice: 'Stadt first: erst der Weg ins Casino, dann der erste Automat.' };
}
