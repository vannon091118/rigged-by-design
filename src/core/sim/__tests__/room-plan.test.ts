/**
 * @test-target: src/core/sim/room-plan.ts
 * @error-code: ERR-2002
 *
 * Der Raumplan liest die vorhandene Layout-Wahrheit: eine Zone je Raum, ihre
 * Kanten als Zugaenge, die Flaeche je Nutzung als Kapazitaet. Geprueft werden
 * die echten Vorlagen, ein zugemauerter Raum ueber den Command-Pfad und die
 * runde Reise durch Export/Import.
 */
import { describe, expect, it } from 'vitest';
import { applyLayoutCommand, type EdgeCell } from '../layout-commands';
import { layoutFromTemplate } from '../layout-derive';
import { exportLayout, importLayout } from '../layout-json';
import type { LayoutState, LayoutZone } from '../layout-types';
import { roomPlanSummary, roomPlans, type RoomPlan } from '../room-plan';
import { createWorld } from '../templates';

const plan = (plans: readonly RoomPlan[], id: string): RoomPlan => {
  const found = plans.find((room) => room.id === id);
  if (!found) throw new Error(`Raum fehlt: ${id}`);
  return found;
};

/** Alle vier Randkanten einer Zone als Wand; der Command-Pfad entscheidet. */
function walledOff(layout: LayoutState, zone: LayoutZone): LayoutState {
  const cells: EdgeCell[] = [];
  for (let x = zone.x; x < zone.x + zone.w; x += 1) {
    cells.push({ axis: 'H', x, y: zone.y }, { axis: 'H', x, y: zone.y + zone.h });
  }
  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    cells.push({ axis: 'V', x: zone.x, y }, { axis: 'V', x: zone.x + zone.w, y });
  }
  return applyLayoutCommand(layout, { kind: 'EDGES', cells, edge: 'WALL' });
}

describe('Raumplan aus dem Layout', () => {
  it('macht aus jeder Zone genau einen Raum und summiert die Flaeche', () => {
    for (const template of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      const world = createWorld(template);
      const plans = roomPlans(world.layout);
      expect(plans.map((room) => room.id)).toEqual(world.layout.zones.map((zone) => zone.id));
      expect(plans.reduce((sum, room) => sum + room.tiles, 0))
        .toBe(world.layout.zones.reduce((sum, zone) => sum + zone.w * zone.h, 0));
      expect(roomPlans(world.layout)).toEqual(plans);
    }
  });

  it('rechnet die Kapazitaet aus Flaeche und Raumfunktion', () => {
    const plans = roomPlans(layoutFromTemplate('SMALL'));
    expect(plan(plans, 'gaming')).toMatchObject({ kind: 'GAMING', tiles: 195, guestCapacity: 65 });
    expect(plan(plans, 'bar')).toMatchObject({ kind: 'BAR', tiles: 72, guestCapacity: 36 });
    expect(plan(plans, 'toilet')).toMatchObject({ kind: 'TOILET', tiles: 48, guestCapacity: 12 });
    expect(plan(plans, 'storage').guestCapacity).toBe(0);
    expect(roomPlanSummary(plans)).toEqual({
      rooms: 7,
      reachable: 7,
      guestCapacity: 146,
      withoutAccess: [],
    });
  });

  it('zaehlt eine Tuer am Raumrand als Zugang und behaelt die Erreichbarkeit', () => {
    const before = plan(roomPlans(layoutFromTemplate('SMALL')), 'gaming');
    const next = applyLayoutCommand(layoutFromTemplate('SMALL'), {
      kind: 'EDGES',
      cells: [{ axis: 'H', x: 16, y: 10 }],
      edge: 'DOOR',
    });
    const after = plan(roomPlans(next), 'gaming');
    expect(after.accesses).toBe(before.accesses + 1);
    expect(after.reachable).toBe(true);
    expect(after.guestCapacity).toBe(before.guestCapacity);
  });

  it('meldet einen zugemauerten Raum ohne Zugang und laesst die anderen offen', () => {
    const layout = layoutFromTemplate('SMALL');
    const lounge = layout.zones.find((zone) => zone.id === 'lounge');
    if (!lounge) throw new Error('Fixture ohne Lounge.');
    const plans = roomPlans(walledOff(layout, lounge));
    expect(plan(plans, 'lounge').reachable).toBe(false);
    expect(plan(plans, 'gaming').reachable).toBe(true);
    expect(roomPlanSummary(plans).withoutAccess).toEqual(['Lounge']);
  });

  it('liefert nach Export und Import denselben Plan', () => {
    const layout = layoutFromTemplate('SMALL');
    const imported = importLayout(exportLayout(layout));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(roomPlans(imported.layout)).toEqual(roomPlans(layout));
  });
});
