/**
 * @test-target: src/store/transfer.ts
 * @error-code: ERR-5001
 *
 * Import/Export: Der eigene Export muss sich wieder importieren lassen. Die
 * Nutzlast traegt die Save-Version des Standes; wer den Import prueft, muss
 * dieselben Versionen kennen wie das Laden im Speicherpfad.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { openHouse } from '../../core/sim/money';
import { createWorld } from '../../core/sim/templates';
import { tickWorld } from '../../core/sim/tick';
import { randomSeed } from '../../test/random-seed';
import { exportGameData, planImportData } from '../transfer';

/** Frischer Stand nach einigen Ticks: genau das, was die UI exportiert. */
function freshExport(ticks: number): string {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  openHouse(ledger, 0);
  const prng = new Prng(randomSeed());
  for (let step = 0; step < ticks; step += 1) tickWorld(world, ledger, prng);
  expect(ledger.verifyLedgerIntegrity()).toBe(true);
  return exportGameData(world, ledger, prng.getState());
}

describe('Import/Export Round Trip', () => {
  it('laedt den eigenen Export ohne Blocker wieder', () => {
    const { report, loaded } = planImportData(freshExport(12));
    expect(report.fatal).toBe(0);
    expect(report.ok).toBe(true);
    expect(loaded).not.toBeNull();
  });

  it('kennt die Save-Version, die der aktuelle Stand schreibt', () => {
    const raw = freshExport(3);
    const payload = JSON.parse(raw) as { payload: { version: number } };
    const { report } = planImportData(raw);
    expect(payload.payload.version).toBeGreaterThanOrEqual(5);
    expect(report.issues.filter((entry) => entry.path === 'version')).toHaveLength(0);
  });

  it('behält Welt, Ledger und Zufallsstand ueber den Round Trip', () => {
    const raw = freshExport(20);
    const before = JSON.parse(raw) as { payload: { tick: number; prngState: number; entries: unknown[] } };
    const { loaded } = planImportData(raw);
    expect(loaded).not.toBeNull();
    expect(loaded?.world.tick).toBe(before.payload.tick);
    expect(loaded?.prngState).toBe(before.payload.prngState);
    expect(loaded?.ledger.entryCount).toBe(before.payload.entries.length);
    expect(loaded?.ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
