/**
 * @test-target: src/core/sim/journal.ts
 * @error-code: ERR-2001
 *
 * Jede Buchung wird genau einmal kopiert; Welt-Ereignisse tragen Ursache und Folge.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { journalCounts, journalEntries, recordJournal, settleMoneyJournal } from '../journal';
import { orderDrinks } from '../deliveries';
import { HAUSKONTO, PORTEMONNAIE } from '../money';
import { hireAgent } from '../staff';
import { createWorld } from '../templates';

describe('Ereignisprotokoll', () => {
  it('kopiert jede Ledger-Zeile genau einmal und lässt die Ereigniszeile in Ruhe', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const before = world.lastEvent;
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(5), 'startkapital', 0);
    expect(settleMoneyJournal(world, ledger)).toBe(1);
    expect(world.journal).toHaveLength(1);
    expect(world.journal[0]!.kind).toBe('MONEY');
    expect(world.journal[0]!.amount).toBe(fromVC(5));
    expect(world.journal[0]!.subject).toBe('startkapital');
    expect(world.lastEvent).toBe(before);
    expect(settleMoneyJournal(world, ledger)).toBe(0);
    expect(world.journal).toHaveLength(1);
    ledger.transfer(HAUSKONTO, PORTEMONNAIE, fromVC(2), 'abheben', 1);
    expect(settleMoneyJournal(world, ledger)).toBe(1);
    expect(world.journaledSeq).toBe(2);
    expect(world.journal[1]!.refs?.guestId).toBeUndefined();
  });

  it('setzt bei Welt-Ereignissen die sichtbare Zeile und filtert nach Art', () => {
    const world = createWorld('SMALL');
    recordJournal(world, {
      kind: 'GUEST', subject: 'Gast 7', cause: 'Durst', effect: 'Gast 7 geht zur Bar.',
      refs: { guestId: 7 },
    });
    recordJournal(world, {
      kind: 'STAFF', subject: 'Porter', cause: 'Kiste am Eingang', effect: 'Porter trägt Getränke.',
    });
    expect(world.lastEvent).toBe('Porter trägt Getränke.');
    expect(journalEntries(world.journal, 'GUEST')).toHaveLength(1);
    expect(journalEntries(world.journal, 'GUEST')[0]!.refs?.guestId).toBe(7);
    expect(journalCounts(world.journal)).toEqual({ MONEY: 0, GUEST: 1, STAFF: 1, STOCK: 0, RIVAL: 0, SYSTEM: 0 });
  });

  it('protokolliert Personal und Lager mit Akteur-Referenz', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'testkapital', 0);
    hireAgent(world, ledger, 'porter');
    orderDrinks(world, ledger, 6);
    expect(world.journal.some((event) => event.kind === 'STAFF')).toBe(true);
    expect(world.journal.some((event) => event.kind === 'STOCK')).toBe(true);
    expect(world.journal.find((event) => event.kind === 'STAFF')!.refs?.agentId).toBe(world.agents[0]!.id);
  });

  it('behält nur die letzten 240 Ereignisse', () => {
    const world = createWorld('SMALL');
    for (let index = 0; index < 300; index += 1) {
      recordJournal(world, {
        kind: 'SYSTEM', subject: `Ereignis ${index}`, cause: 'Test', effect: `Folge ${index}`,
      });
    }
    expect(world.journal).toHaveLength(240);
    expect(world.journal[0]!.subject).toBe('Ereignis 60');
    expect(world.journal[239]!.subject).toBe('Ereignis 299');
    expect(world.nextJournalId).toBe(301);
  });
});
