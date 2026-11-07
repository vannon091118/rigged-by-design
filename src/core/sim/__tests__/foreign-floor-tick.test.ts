/** @test-target: src/core/sim/foreign-floor-tick.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld } from '../templates';
import { getRival } from '../rivals';
import { acceptJob, requestJobTask } from '../player-jobs';
import { getOrCreateForeignFloor, tickForeignFloor } from '../foreign-floor-tick';

function setup() {
  const world = createWorld('SMALL');
  const prng = new Prng(randomSeed());
  const rival = getRival('HAFENKLAUSE');
  const floor = getOrCreateForeignFloor(world, rival.id, rival.size, [], [], rival.jobStations);
  world.activeForeignFloorId = floor.id;
  acceptJob(world, rival.id, 'CLEANER');
  requestJobTask(world);
  return { world, prng, floor };
}

describe('Foreign Floor Tick: Aufgabenfortschritt', () => {
  it('treibt die Aufgabe auf dem aktiven Floor voran', () => {
    const { world, prng, floor } = setup();
    tickForeignFloor(world, floor, prng);
    expect(world.player.job?.currentTask?.ticksElapsed).toBe(1);
  });

  it('pausiert die Aufgabe auf einem inaktiven Floor', () => {
    const { world, prng, floor } = setup();
    const other = getRival('GOLDENE_HAND');
    const otherFloor = getOrCreateForeignFloor(world, other.id, other.size, [], [], other.jobStations);
    tickForeignFloor(world, otherFloor, prng);
    expect(world.player.job?.currentTask?.ticksElapsed).toBe(0);
    expect(world.activeForeignFloorId).toBe(floor.id);
  });

  it('treibt keine Aufgabe bei einem anderen Arbeitgeber voran', () => {
    const { world, prng } = setup();
    const other = getRival('GOLDENE_HAND');
    const otherFloor = getOrCreateForeignFloor(world, other.id, other.size, [], [], other.jobStations);
    world.activeForeignFloorId = otherFloor.id;
    tickForeignFloor(world, otherFloor, prng);
    expect(world.player.job?.currentTask?.ticksElapsed).toBe(0);
  });

  it('schliesst die Aufgabe nach ihrer Dauer ab', () => {
    const { world, prng, floor } = setup();
    for (let index = 0; index < 30; index += 1) tickForeignFloor(world, floor, prng);
    expect(world.player.job?.currentTask).toBeNull();
    expect(world.player.job?.workDays).toBe(1);
  });
});
