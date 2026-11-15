/**
 * @test-target: src/store/new-game.ts
 * @error-code: ERR-4022
 *
 * AC 1+2 von #782: Nach createNewGame existiert ein Starter-Gast und eine
 * Starter-Kiste im Weltzustand. Beide werden von der bestehenden Render-Pipeline
 * (EntitySync fuer Gaeste, FloorCrates fuer Kisten) automatisch sichtbar auf dem
 * Casino-Floor dargestellt.
 */
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../store/new-game';

describe('Startpfad: Gast und Kiste sichtbar (B1)', () => {
  it('createNewGame erzeugt einen Starter-Gast im Weltzustand', () => {
    const { world } = createNewGame('SMALL');

    expect(world.guests).toHaveLength(1);
    const guest = world.guests[0]!;
    expect(guest.id).toBe(1);
    expect(guest.state).toBe('ENTER');
    expect(guest.targetZone).toBe('exchange');
    expect(guest.visitorId).toBeGreaterThanOrEqual(0);
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

  it('Starter-Gast und Starter-Kiste existieren zusammen im Startpfad', () => {
    const { world } = createNewGame('SMALL');

    expect(world.guests).toHaveLength(1);
    expect(world.crates).toHaveLength(1);
  });
});
