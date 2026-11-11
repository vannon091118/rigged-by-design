/** @test-target: src/store/save.ts | @error-code: ERR-1002 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { replaySave, toSavedGame } from '../save';
import { createNewGame } from '../new-game';

function roundTrip(): Record<string, unknown> {
  const start = createNewGame('SMALL');
  return JSON.parse(JSON.stringify(toSavedGame(start.world, start.ledger, 4242))) as Record<string, unknown>;
}

describe('Startzustand im Save', () => {
  it('startet ein neues Spiel mit der Eröffnung und behält sie im Roundtrip', () => {
    const start = createNewGame('SMALL');
    expect(start.world.onboarding?.step).toBe('OPENING');
    expect(start.world.scene.kind).toBe('CITY');
    expect(start.world.furniture.some((item) => item.kind === 'EXCHANGE')).toBe(true);

    const loaded = replaySave(roundTrip());
    expect(loaded).not.toBeNull();
    expect(loaded!.world.onboarding?.step).toBe('OPENING');
    expect(loaded!.ledger.getBalance('HAUSKONTO')).toBe(fromVC(150));
  });

  it('liest alte Saves ohne Onboarding-Feld als abgeschlossen', () => {
    const saved = roundTrip();
    delete saved.onboarding;
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.onboarding?.step).toBe('DONE');
  });
});
