/**
 * @test-target: src/store/world-store.ts
 * @error-code: ERR-2001
 *
 * Der Rollback greift am echten Store-Pfad, nicht nur an der Transaktion:
 * ein Multi-System-Command (Einstellung = Ledger-Buchung, Welt, Journal) wird
 * nach vollzogener Teilmutation zum Scheitern gebracht. Danach sind Welt,
 * Ledger-Salden und -Zeilen, PRNG, Fact-Queue und Journal unveraendert.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Ledger } from '../../core/economy/ledger';
import type { StaffRole, WorldState } from '../../core/sim/types';

const FAILURE = 'Einstellung gebucht, dann gerissen.';
const mutation = { entries: 0, agents: 0 };

// Die echte Einstellung laeuft, erst danach reisst sie: so entsteht eine
// Teilmutation, die der Store zuruecknehmen muss.
vi.mock('../venue-commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../venue-commands')>();
  return {
    ...actual,
    hireCmd: (world: WorldState, ledger: Ledger, role: StaffRole): string => {
      const entriesBefore = ledger.entryCount;
      const agentsBefore = world.agents.length;
      actual.hireCmd(world, ledger, role);
      mutation.entries = ledger.entryCount - entriesBefore;
      mutation.agents = world.agents.length - agentsBefore;
      throw new Error(FAILURE);
    },
  };
});

/** Der Store ist headless; im node-Lauf gibt es keinen Storage, also eine Attrappe. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

describe('Store-Pfad: gescheiterter Multi-System-Command', () => {
  it('laesst Welt, Ledger, PRNG, Facts und Journal nach dem Rollback unveraendert', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    // Der Store ist ein Modul-Singleton: erst nach dem Speicher-Stub importieren.
    const { worldStore } = await import('../world-store');
    worldStore.newGame('SMALL');

    const exportBefore = worldStore.exportGame();
    const ledgerBefore = worldStore.auditLedger();
    const payloadBefore = JSON.parse(exportBefore).payload as Record<string, unknown>;

    worldStore.hire('guard');

    // Der Command ist mitten in der Wirkung gescheitert: Buchung und Agent standen schon.
    expect(mutation.entries).toBeGreaterThan(0);
    expect(mutation.agents).toBeGreaterThan(0);

    const exportAfter = worldStore.exportGame();
    const payloadAfter = JSON.parse(exportAfter).payload as Record<string, unknown>;
    const ledgerAfter = worldStore.auditLedger();

    expect(exportAfter).toBe(exportBefore);
    expect(ledgerAfter.entries).toBe(ledgerBefore.entries);
    expect(ledgerAfter.circulating).toBe(ledgerBefore.circulating);
    expect(payloadAfter.entries).toEqual(payloadBefore.entries);
    expect(payloadAfter.narrative).toEqual(payloadBefore.narrative);
    expect(payloadAfter.journal).toEqual(payloadBefore.journal);
    expect(payloadAfter.journaledSeq).toBe(payloadBefore.journaledSeq);
    expect(payloadAfter.prngState).toBe(payloadBefore.prngState);
    expect(payloadAfter.staff).toEqual(payloadBefore.staff);
    expect(payloadAfter.agents).toEqual(payloadBefore.agents);
    expect(worldStore.getSnapshot().notice).toContain('gerissen');
  });
});
