/**
 * @test-target: src/store/new-game.ts
 * @error-code: ERR-4022
 *
 * Aktueller Startpfad: Nach createNewGame existiert die Starter-Kiste, aber
 * noch kein Gast. Der erste Gast entsteht erst aus der Nachfrage, wenn ein
 * spielbares Geraet steht; die Kiste wird auf dem Casino-Floor sichtbar.
 */
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../new-game';

describe('Startpfad: Gast und Kiste sichtbar (B1)', () => {
  it('createNewGame erzeugt noch keinen Gast vor dem Automaten', () => {
    const { world } = createNewGame('SMALL');

    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(1);
  });

  it('createNewGame platziert eine interaktionsfähige Starter-Kiste', () => {
    const { world } = createNewGame('SMALL');

    expect(world.crates).toHaveLength(1);
    const crate = world.crates[0]!;
    expect(crate.id).toBe(1);
    expect(crate.payload.kind).toBe('FURNITURE');
    if (crate.payload.kind === 'FURNITURE') {
      expect(crate.payload.buildId).toBe('SLOT');
    }
    expect(crate.carriedBy).toBeNull();
    expect(crate.x).toBeGreaterThanOrEqual(0);
    expect(crate.y).toBeGreaterThanOrEqual(0);
  });

  it('Starter-Kiste existiert ohne vorzeitigen Gast im Startpfad', () => {
    const { world } = createNewGame('SMALL');

    expect(world.guests).toHaveLength(0);
    expect(world.crates).toHaveLength(1);
  });
});
