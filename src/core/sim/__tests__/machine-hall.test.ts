/** @test-target: src/core/sim/machine-hall.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import {
  MACHINE_FIT_CONDITION, MACHINE_WEAR_LIMIT, MAINTENANCE_GAIN, MAINTENANCE_SUBJECT, conditionBand,
  maintainMachine, maintenanceCost, maintenanceDueCost, machineHallView,
  type HallMachine, type MachineConditionBand,
} from '../machine-hall';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { buyProperty, propertyWorld } from '../property';
import { createWorld } from '../templates';

interface Options {
  readonly buy?: boolean;
  readonly houseVC?: number;
}

function setup({ buy = true, houseVC = 200 }: Options = {}) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(200), 'test startgeld', 0);
  if (houseVC > 0) ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(houseVC), 'test hauskonto', 0);
  if (buy) buyProperty(world, ledger, 'KNEIPE', 0);
  const machines = propertyWorld(world)?.furniture.filter((item) => item.gameId !== null) ?? [];
  return { world, ledger, machines };
}

describe('Spielhalle: Bestand und Wartung', () => {
  it('zeigt ohne Eigentum keine Halle und verweigert die Wartung', () => {
    const { world, ledger } = setup({ buy: false });
    const view = machineHallView(world, ledger);
    expect(view.owned).toBe(false);
    expect(view.total).toBe(0);
    expect(view.note).toContain('Kauf zuerst');
    expect(() => maintainMachine(world, ledger, 1)).toThrow(/Ohne Immobilie/);
  });

  it('liest nur Spielautomaten der eigenen Flaeche', () => {
    const { world, ledger, machines } = setup();
    expect(machines.length).toBeGreaterThan(0);
    const view = machineHallView(world, ledger);
    expect(view.owned).toBe(true);
    expect(view.total).toBe(machines.length);
    expect(view.area).toBe(propertyWorld(world)!.area!.id);
    // Deko und Service stehen nicht in der Halle, auch wenn sie im Bereich stehen.
    expect(view.total).toBeLessThanOrEqual(propertyWorld(world)!.furniture.length);
  });

  it('bucht Wartung vom Betriebskonto, ohne ein Ersatzteil zu verbrauchen', () => {
    const { world, ledger, machines } = setup();
    const machine = machines[0]!;
    machine.condition = 60;
    world.parts = 5;
    const cost = maintenanceCost(world);
    const houseBefore = ledger.getBalance(HAUSKONTO);
    const walletBefore = ledger.getBalance(PORTEMONNAIE);
    expect(maintainMachine(world, ledger, machine.id)).toBe(60 + MAINTENANCE_GAIN);
    expect(ledger.getBalance(HAUSKONTO)).toBe(houseBefore - cost);
    // Dieselbe Trennung wie Agent 08: Betrieb zahlt vom Hauskonto, nie vom Portemonnaie.
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(walletBefore);
    expect(world.parts).toBe(5);
    expect(ledger.entries.some((entry) => entry.reason.startsWith('wartung '))).toBe(true);
    expect(world.journal.filter((event) => event.subject === MAINTENANCE_SUBJECT)).toHaveLength(1);
    expect(world.lastEvent).toContain('gewartet');
  });

  it('deckelt den Zustand bei 100 und verweigert Wartung an gesunden Geraeten', () => {
    const { world, ledger, machines } = setup();
    const machine = machines[0]!;
    machine.condition = 90;
    expect(maintainMachine(world, ledger, machine.id)).toBe(100);
    machine.condition = MACHINE_FIT_CONDITION;
    expect(() => maintainMachine(world, ledger, machine.id)).toThrow(/in Ordnung/);
  });

  it('schickt defekte Geraete zur Reparatur statt zur Wartung', () => {
    const { world, ledger, machines } = setup();
    const machine = machines[0]!;
    machine.condition = 30;
    const band: MachineConditionBand = conditionBand(machine);
    expect(band).toBe('BROKEN');
    expect(() => maintainMachine(world, ledger, machine.id)).toThrow(/erst reparieren/);
    machine.damaged = true;
    machine.condition = 80;
    expect(conditionBand(machine)).toBe('BROKEN');
    expect(() => maintainMachine(world, ledger, machine.id)).toThrow(/erst reparieren/);
  });

  it('verweigert Wartung ohne Deckung auf dem Betriebskonto', () => {
    const { world, ledger, machines } = setup({ houseVC: 0 });
    const machine = machines[0]!;
    machine.condition = 50;
    const view = machineHallView(world, ledger);
    expect(view.due[0]?.ready).toBe(false);
    expect(() => maintainMachine(world, ledger, machine.id)).toThrow(/Betriebskonto zu niedrig/);
    expect(world.journal.filter((event) => event.subject === MAINTENANCE_SUBJECT)).toHaveLength(0);
  });

  it('verweigert fremde Geraete und solche ausserhalb der eigenen Flaeche', () => {
    const { world, ledger } = setup();
    expect(() => maintainMachine(world, ledger, 999_999)).toThrow(/Kein Spielautomat/);
  });

  it('listet die unangenehmsten Automaten zuerst und zaehlt die Auslastung', () => {
    const { world, ledger, machines } = setup();
    const [first, second] = machines;
    first!.condition = 70;
    if (second) second!.condition = 50;
    first!.occupants = [1];
    const view = machineHallView(world, ledger);
    expect(view.worn).toBeGreaterThan(0);
    const worst: HallMachine | undefined = view.due[0];
    expect(worst?.cost).toBe(maintenanceCost(world));
    expect(maintenanceDueCost(view)).toBe(view.due.length * view.cost);
    expect(view.due[0]!.condition).toBeLessThanOrEqual(view.due[view.due.length - 1]!.condition);
    expect(view.occupied).toBe(1);
    expect(view.seats).toBeGreaterThanOrEqual(view.occupied);
    expect(MACHINE_WEAR_LIMIT).toBe(85);
  });
});
