/**
 * @test-target: src/store/command-guard.ts
 * @error-code: ERR-2001
 *
 * Ein fehlgeschlagener Command laesst keine Teilmutation stehen: Welt, Ledger,
 * PRNG, Fact-Queue und Journal stehen danach exakt wie vor dem Versuch. Ein
 * Streit erzeugt nur dann einen Konflikt-Fact, wenn der Kampf stattgefunden hat.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { settleMoneyJournal } from '../../core/sim/journal';
import { HAUSKONTO } from '../../core/sim/money';
import { emitCommandRejected } from '../../core/sim/narrative/facts';
import { spawnGuest } from '../../core/sim/spawn';
import { hireAgent } from '../../core/sim/staff';
import { createWorld } from '../../core/sim/templates';
import { captureCommandState } from '../command-guard';
import { fightBrawlCmd } from '../venue-commands';

const SEED = 0x2f6e2b1;

function brawlSetup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(SEED);
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(500), 'start', 0);
  const first = spawnGuest(world, prng, ledger)!;
  const second = spawnGuest(world, prng, ledger)!;
  for (const guest of [first, second]) {
    guest.state = 'ANGRY';
    guest.position = { x: first.position.x, y: first.position.y };
    guest.disputeId = 1;
  }
  world.disputes.push({ id: 1, guestIds: [first.id, second.id], x: first.position.x, y: first.position.y, level: 1, ticks: 0 });
  world.player.position = { x: first.position.x, y: first.position.y };
  return { world, ledger, prng };
}

function conflictFacts(world: ReturnType<typeof brawlSetup>['world']): number {
  return world.narrative.pending.filter((fact) => fact.kind === 'VISITOR_CONFLICT').length;
}

describe('Begrenzte Command-Transaktion', () => {
  it('nimmt eine Teilmutation an Welt, Ledger, PRNG und Facts vollstaendig zurueck', () => {
    const { world, ledger, prng } = brawlSetup();
    settleMoneyJournal(world, ledger);
    const before = {
      tick: world.tick,
      day: world.day,
      lastEvent: world.lastEvent,
      balances: ledger.snapshot(),
      entries: ledger.entryCount,
      factSeq: world.narrative.factSeq,
      pending: world.narrative.pending.length,
      journal: world.journal.length,
      prng: prng.getState(),
    };

    const snapshot = captureCommandState(world, ledger, prng);
    expect(() => {
      world.tick += 7;
      world.day += 1;
      world.lastEvent = 'Teilweise ausgefuehrt';
      ledger.transfer(HAUSKONTO, 'VISITOR_1', fromVC(25), 'einsatz', world.tick);
      prng.nextUint32();
      emitCommandRejected(world, 'fightBrawl', 'Security schon vor Ort');
      throw new Error('GUARD');
    }).toThrow('GUARD');
    const restored = snapshot.restore();

    expect([world.tick, world.day, world.lastEvent]).toEqual([before.tick, before.day, before.lastEvent]);
    expect(restored.snapshot()).toEqual(before.balances);
    expect(restored.entryCount).toBe(before.entries);
    expect(prng.getState()).toBe(before.prng);
    expect(world.narrative.factSeq).toBe(before.factSeq);
    expect(world.narrative.pending).toHaveLength(before.pending);
    expect(world.journal).toHaveLength(before.journal);
  });

  it('laesst einen fehlgeschlagenen Command keine Buchung oder Fact nachreichen', () => {
    const { world, ledger, prng } = brawlSetup();
    settleMoneyJournal(world, ledger);
    const journalBefore = world.journal.length;
    const entriesBefore = ledger.entryCount;
    const pendingBefore = world.narrative.pending.length;

    const snapshot = captureCommandState(world, ledger, prng);
    try {
      ledger.transfer(HAUSKONTO, 'VISITOR_1', fromVC(40), 'verlorener-einsatz', 0);
      emitCommandRejected(world, 'abort', 'Fehler');
      throw new Error('Abbruch');
    } catch {
      const restored = snapshot.restore();
      expect(restored.entryCount).toBe(entriesBefore);
      expect(settleMoneyJournal(world, restored)).toBe(0);
    }

    expect(world.journal).toHaveLength(journalBefore);
    expect(world.narrative.pending).toHaveLength(pendingBefore);
  });
});

describe('Streit-Fact nur nach einem gefuehrten Kampf', () => {
  it('erzeugt keinen Kampf-Fact, wenn der Security den Streit bearbeitet', () => {
    const { world, ledger, prng } = brawlSetup();
    const dispute = world.disputes[0]!;
    const guard = hireAgent(world, ledger, 'guard');
    guard.x = dispute.x;
    guard.y = dispute.y;

    const notice = fightBrawlCmd(world, ledger, prng, 1);

    expect(notice).toContain('Security');
    expect(conflictFacts(world)).toBe(0);
    expect(world.disputes).toHaveLength(1);
  });

  it('erzeugt nach dem Kampf genau einen Konflikt-Fact', () => {
    const { world, ledger, prng } = brawlSetup();

    fightBrawlCmd(world, ledger, prng, 1);

    expect(conflictFacts(world)).toBe(1);
  });
});
