/**
 * @test-target: src/store/migrate.ts
 * @error-code: ERR-1002
 *
 * Der Rivalen-Zustand steht im Save und ueberlebt einen Neustart; ein v9-Stand
 * ohne Rivalen wird auf drei neutrale Startzustaende gehoben.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { replaySave, toSavedGame } from '../save';

function snapshot(): Record<string, unknown> {
  const world = createWorld('SMALL');
  const rival = world.rivals[0]!;
  rival.stance = 'HOSTILE';
  rival.capacity = 35;
  rival.evidence.push({
    action: 'SABOTAGE', tick: 400, day: 3, machineId: 101, blocked: true, note: 'Guard war da.',
  });
  return JSON.parse(JSON.stringify(toSavedGame(world, new Ledger(), 7))) as Record<string, unknown>;
}

describe('Rivalen im Save', () => {
  it('schreibt Version 11 und laedt Zustaende unveraendert zurueck', () => {
    const saved = snapshot();
    expect(saved.version).toBe(11);
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    const rival = loaded!.world.rivals[0]!;
    expect(rival.rivalId).toBe('HAFENKLAUSE');
    expect(rival.stance).toBe('HOSTILE');
    expect(rival.capacity).toBe(35);
    expect(rival.evidence[0]?.blocked).toBe(true);
    expect(loaded!.world.rivals).toHaveLength(3);
  });

  it('hebt einen v9-Stand ohne Rivalen auf drei neutrale Zustaende', () => {
    const saved = snapshot();
    saved.version = 9;
    delete saved.rivals;
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.rivals.map((mind) => mind.stance)).toEqual(['NEUTRAL', 'NEUTRAL', 'NEUTRAL']);
    expect(loaded!.world.rivals[0]?.nextActionTick).toBe(150);
  });
});
