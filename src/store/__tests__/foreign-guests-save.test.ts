/**
 * @test-target: src/store/foreign-floor-commands.ts | @error-code: ERR-3001
 *
 * Die Belegung ist Snapshot-Daten des fremden Floors: sie erscheint im Bild,
 * ueberlebt Save/Load und laesst den eigenen Casinozustand unberuehrt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { activeForeignFloor } from '../../core/sim/active-player';
import { FOREIGN_GUEST_ID_BASE } from '../../core/sim/foreign-floor-guests';
import { createWorld } from '../../core/sim/templates';
import { visitForeignCmd } from '../foreign-floor-commands';
import { replaySave, toSavedGame } from '../save';
import { buildView } from '../snapshot';

function visit(): { world: ReturnType<typeof createWorld>; ledger: Ledger } {
  const world = createWorld('SMALL');
  visitForeignCmd(world, 'HAFENKLAUSE');
  return { world, ledger: new Ledger() };
}

describe('Fremde Belegung im Snapshot und Save', () => {
  it('zeigt die Gaeste und Moebel des fremden Floors, nicht die des eigenen Casinos', () => {
    const { world, ledger } = visit();
    const floor = activeForeignFloor(world)!;
    const ownFurniture = world.furniture.map((item) => item.id);

    const view = buildView(world, ledger, '');

    expect(view.scene.kind).toBe('FOREIGN');
    expect(view.guests.length).toBeGreaterThan(0);
    expect(view.guests.every((guest) => guest.id >= FOREIGN_GUEST_ID_BASE)).toBe(true);
    expect(view.guests.map((guest) => guest.id)).toEqual((floor.guests ?? []).map((guest) => guest.id));
    expect(view.furniture.every((item) => !ownFurniture.includes(item.id))).toBe(true);
    // Der eigene Betrieb behaelt seinen Bestand.
    expect(world.guests).toHaveLength(0);
    expect(world.furniture.map((item) => item.id)).toEqual(ownFurniture);
  });

  it('haelt die Belegung ueber den Save-/Load-Roundtrip', () => {
    const { world, ledger } = visit();
    const before = activeForeignFloor(world)!.guests ?? [];
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 777))) as Record<string, unknown>;

    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    const floor = activeForeignFloor(loaded!.world);
    expect(floor).not.toBeNull();
    expect(floor!.guests ?? []).toHaveLength(before.length);
    expect((floor!.guests ?? []).map((guest) => `${guest.id}:${guest.position.x},${guest.position.y}`))
      .toEqual(before.map((guest) => `${guest.id}:${guest.position.x},${guest.position.y}`));
    // Und die Sicht liest nach dem Laden dieselben Figuren.
    const view = buildView(loaded!.world, new Ledger(), '');
    expect(view.guests.map((guest) => guest.id)).toEqual(before.map((guest) => guest.id));
  });
});
