/**
 * @test-target: src/core/sim/narrative/facts.ts
 * @error-code: ERR-2001
 *
 * Der Slot-Drucklader wird erst nach der echten Ledger-Buchung narrativ:
 * ein eigener Fact traegt Maschine, Einsatz und Auszahlung; das Schema
 * verhindert, dass ein unvollstaendiger Discharge in die Queue gelangt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { fromVC } from '../../../economy/vacoin';
import { createSlotMemory } from '../../../games/slot-transparency';
import { isFact } from '../fact-schema';
import { emitSlotDischarge } from '../facts';
import { createWorld } from '../../templates';

describe('SLOT_DISCHARGE-Fact', () => {
  it('validiert Akteur, Maschine, Einsatz und Auszahlung', () => {
    const base = {
      id: 1, kind: 'SLOT_DISCHARGE', tick: 4, day: 1,
      actorRefs: ['visitor:7'], machineId: 3, stake: fromVC(1), payout: fromVC(1),
    };

    expect(isFact(base)).toBe(true);
    expect(isFact({ ...base, actorRefs: [] })).toBe(false);
    expect(isFact({ ...base, actorRefs: ['staff:1'] })).toBe(false);
    expect(isFact({ ...base, machineId: 0 })).toBe(false);
    expect(isFact({ ...base, stake: 0 })).toBe(false);
    expect(isFact({ ...base, payout: -1 })).toBe(false);
  });

  it('emittiert den Fact ohne selbst Geld zu buchen', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100), 'startkapital', 0);
    ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(10), 'testgeld', 0);
    const item = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
    item.baseBet = fromVC(1);
    item.slotMemory = {
      ...createSlotMemory(3), pressureLevel: 7, chargeReady: true, bank: fromVC(10),
    };
    const before = ledger.entryCount;

    const fact = emitSlotDischarge(world, 'player', item.id, fromVC(1), fromVC(1));

    expect(ledger.entryCount).toBe(before);
    expect(fact).toMatchObject({
      kind: 'SLOT_DISCHARGE', actorRefs: ['player'], machineId: item.id,
      stake: fromVC(1), payout: fromVC(1),
    });
  });

});
