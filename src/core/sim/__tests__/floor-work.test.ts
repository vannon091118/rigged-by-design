/** @test-target: src/core/sim/floor-work.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { cleanTile, repair } from '../actions';
import {
  MAINTENANCE_BASE_GAIN, cleaningArea, cleaningReach, floorWorkView, maintenanceGain, workQuality,
  type FloorRole, type FloorWorkRow,
} from '../floor-work';
import { MAINTENANCE_SUBJECT, maintainMachine } from '../machine-hall';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { buyProperty, propertyWorld } from '../property';
import { createWorld } from '../templates';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(200), 'test startgeld', 0);
  ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(200), 'test hauskonto', 0);
  const machines = (() => {
    if (world.player.property === null) buyProperty(world, ledger, 'KNEIPE', 0);
    return propertyWorld(world)!.furniture.filter((item) => item.gameId !== null);
  })();
  return { world, ledger, machines };
}

describe('Arbeitsqualitaet: Rollen und Attribute', () => {
  it('rechnet dieselbe Formel in Sicht und Aktion', () => {
    const { world } = setup();
    expect(workQuality(world.player.rpg, 'charisma')).toBe(50);
    world.player.rpg.techniqueLevel = 4;
    expect(workQuality(world.player.rpg, 'technique')).toBe(70);
    world.player.rpg.techniqueLevel = 40;
    expect(workQuality(world.player.rpg, 'technique')).toBe(100);
  });

  it('laesst die Reinigung ohne Wahrnehmung auf der eigenen Kachel', () => {
    const { world } = setup();
    expect(cleaningReach(world)).toBe(1);
    const area = cleaningArea(world, 0);
    expect(area.length).toBeGreaterThanOrEqual(3);
    expect(new Set(area).size).toBe(area.length);
    expect(area.every((tile) => tile >= 0 && tile < world.size * world.size)).toBe(true);
  });

  it('weitet die Reinigung mit Wahrnehmung und deckelt bei zwei Tiles', () => {
    const { world } = setup();
    const center = Math.floor(world.size / 2) * world.size + Math.floor(world.size / 2);
    const small = cleaningArea(world, center);
    world.player.rpg.perceptionLevel = 4;
    expect(cleaningReach(world)).toBe(2);
    const wide = cleaningArea(world, center);
    expect(wide.length).toBeGreaterThan(small.length);
    world.player.rpg.perceptionLevel = 99;
    expect(cleaningReach(world)).toBe(2);
  });

  it('reinigt mit einer Handlung die Nachbarkacheln und bucht je Kachel', () => {
    const { world, ledger } = setup();
    const center = Math.floor(world.size / 2) * world.size + Math.floor(world.size / 2);
    world.dirty.clear();
    world.dirty.add(center);
    world.player.rpg.perceptionLevel = 0;
    const before = ledger.getBalance(HAUSKONTO);
    cleanTile(world, ledger, center);
    expect(world.dirty.has(center)).toBe(false);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - world.prices.cleaningCost);

    world.dirty.add(center);
    world.dirty.add(center + 1);
    world.player.rpg.perceptionLevel = 4;
    const beforeWide = ledger.getBalance(HAUSKONTO);
    cleanTile(world, ledger, center);
    expect(world.dirty.size).toBe(0);
    expect(ledger.getBalance(HAUSKONTO)).toBe(beforeWide - world.prices.cleaningCost * 2);
  });

  it('hebt den Wartungsgewinn mit Technik und deckelt bei 40', () => {
    const { world, ledger, machines } = setup();
    const machine = machines[0]!;
    expect(maintenanceGain(world)).toBe(MAINTENANCE_BASE_GAIN);
    machine.condition = 50;
    expect(maintainMachine(world, ledger, machine.id)).toBe(70);

    world.player.rpg.techniqueLevel = 5;
    machine.condition = 50;
    expect(maintenanceGain(world)).toBe(30);
    expect(maintainMachine(world, ledger, machine.id)).toBe(80);

    world.player.rpg.techniqueLevel = 50;
    expect(maintenanceGain(world)).toBe(40);
    expect(world.journal.filter((event) => event.subject === MAINTENANCE_SUBJECT)).toHaveLength(2);
  });

  it('laesst die Reparatur selbst unveraendert: ein Ersatzteil, ein Preis, Zustand 100', () => {
    const { world, ledger, machines } = setup();
    const machine = machines[0]!;
    world.parts = 1;
    machine.condition = 20;
    world.player.rpg.techniqueLevel = 7;
    const before = ledger.getBalance(HAUSKONTO);
    repair(world, ledger, machine.id);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - world.prices.repairCost);
    expect(world.parts).toBe(0);
    expect(machine.condition).toBe(100);
  });

  it('liefert fuenf Rollen mit Attribut, Stufe und Wirkung', () => {
    const { world } = setup();
    const view = floorWorkView(world);
    const cleanRole: FloorRole = 'CLEAN';
    const first: FloorWorkRow | undefined = view.rows[0];
    expect(first?.role).toBe('SERVE');
    expect(view.rows.some((row) => row.role === cleanRole)).toBe(true);
    expect(view.rows.map((row) => row.role)).toEqual(['SERVE', 'REPAIR', 'CLEAN', 'CASH', 'SECURITY']);
    expect(view.rows.every((row) => row.effect.length > 0)).toBe(true);
    expect(view.note).toContain('+20');
    world.player.rpg.perceptionLevel = 4;
    world.player.rpg.techniqueLevel = 5;
    const trained = floorWorkView(world);
    expect(trained.note).toContain('Radius 2');
    expect(trained.note).toContain('+30');
  });
});
