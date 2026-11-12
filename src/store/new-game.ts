/** Ein neuer Start: Wohnung first, leeres eigenes Casino und eine Starter-Kiste. */
import { Ledger } from '../core/economy/ledger';
import { Prng } from '../core/rng/prng';
import { entropySeed } from '../core/rng/streams';
import { openHouse } from '../core/sim/money';
import { playerApartmentModel } from '../core/sim/player-apartment';
import { seedStartPool } from '../core/sim/narrative/state';
import { createWorld } from '../core/sim/templates';
import type { TemplateId, WorldState } from '../core/sim/types';
import { flushNarrativeCmd } from './narrative-commands';

interface NewGameState {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly notice: string;
}

export function createNewGame(template: TemplateId): NewGameState {
  const world = createWorld(template);
  // Die Kasse ist der erste Kontakt: ohne sie gibt es keinen Gast und keinen Weg.
  world.furniture = world.furniture.filter((item) => item.kind === 'EXCHANGE');
  world.stains = [];
  world.dirty.clear();
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0]!;
  const crateSpot = { x: entrance.x + 2, y: entrance.y + 2 };
  world.crates = [{ id: 1, payload: { kind: 'FURNITURE', buildId: 'SLOT' }, x: crateSpot.x, y: crateSpot.y, carriedBy: null }];
  world.nextCrateId = 2;
  world.sceneReturnPosition = { x: crateSpot.x, y: crateSpot.y };
  // Der Start ist die eigene Wohnung: aufwachen, aufstehen, durch die Haustuer.
  const apartment = playerApartmentModel();
  world.player.position = { ...apartment.bedSpawn };
  world.player.path = [];
  world.player.pathIndex = 0;
  world.scene = { kind: 'APARTMENT' };
  // Start ist die Eroeffnung: erst ihr Ende gibt die Wohnung und danach die Stadt frei.
  world.onboarding = { step: 'OPENING' };
  world.lastEvent = 'Der erste Abend beginnt. Schliess die Eroeffnung, dann stehst du in deiner Wohnung.';
  const ledger = new Ledger();
  seedStartPool(world, openHouse(ledger, 0));
  flushNarrativeCmd(world, ledger);
  return { world, ledger, prng: new Prng(entropySeed()), notice: 'Wohnung first: erst aufwachen, dann durch die Haustuer in den Kiez.' };
}
