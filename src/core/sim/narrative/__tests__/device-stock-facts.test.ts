/**
 * @test-target: src/core/sim/narrative/device-stock-facts.ts
 * @error-code: ERR-4022
 *
 * Geräte- und Lager-Facts werden nur erzeugt, wenn der betreffende
 * World-Zustand besteht. Kein Zustand, kein Fact; wiederholte Läufe
 * erzeugen keinen doppelten Fact für denselben Zustand.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { createWorld } from '../../templates';
import { processNarrativeBoundaryDetailed } from '../boundary';
import { emitDeviceFaults, emitStockLows } from '../device-stock-facts';
import type { WorldState } from '../../types';

function fixture(): WorldState {
  const world = createWorld('SMALL');
  // Alle Geräte auf intakten Zustand zurücksetzen, damit Tests deterministisch sind.
  for (const item of world.furniture) {
    item.damaged = false;
    item.clogged = false;
    if (item.kind === 'BAR' || item.kind === 'STORAGE') item.stock = 1;
  }
  return world;
}

describe('Device/Stock narrative facts (B1)', () => {
  it('emitDeviceFaults erzeugt keinen Fact für intakte Geräte', () => {
    const world = fixture();
    const emitted = emitDeviceFaults(world);
    expect(emitted).toBe(0);
    expect(world.narrative.pending).toHaveLength(0);
  });

  it('emitDeviceFaults erzeugt DEVICE_FAULT für beschädigte Geräte', () => {
    const world = fixture();
    const broken = world.furniture.find((item) => item.kind === 'SLOT');
    if (!broken) throw new Error('Kein SLOT-Gerät im Fixture');
    broken.damaged = true;

    const emitted = emitDeviceFaults(world);
    expect(emitted).toBe(1);
    expect(world.narrative.pending).toHaveLength(1);
    const fact = world.narrative.pending[0]!;
    expect(fact.kind).toBe('DEVICE_FAULT');
    if (fact.kind !== 'DEVICE_FAULT') throw new Error('Unerwarteter Fact-Kind');
    expect(fact.furnitureId).toBe(broken.id);
    expect(fact.reason).toBe('DAMAGED');
  });

  it('emitDeviceFaults erzeugt DEVICE_FAULT für verstopfte Geräte', () => {
    const world = fixture();
    const clogged = world.furniture.find((item) => item.kind === 'BAR');
    if (!clogged) throw new Error('Keine BAR im Fixture');
    clogged.clogged = true;

    const emitted = emitDeviceFaults(world);
    expect(emitted).toBe(1);
    const fact = world.narrative.pending[0]!;
    expect(fact.kind).toBe('DEVICE_FAULT');
    if (fact.kind !== 'DEVICE_FAULT') throw new Error('Unerwarteter Fact-Kind');
    expect(fact.reason).toBe('CLOGGED');
  });

  it('wiederholte Läufe erzeugen keinen doppelten Fact für denselben Zustand', () => {
    const world = fixture();
    const broken = world.furniture.find((item) => item.kind === 'SLOT');
    if (!broken) throw new Error('Kein SLOT-Gerät im Fixture');
    broken.damaged = true;

    emitDeviceFaults(world);
    const firstCount = world.narrative.pending.length;

    emitDeviceFaults(world);
    expect(world.narrative.pending).toHaveLength(firstCount);
  });

  it('emitStockLows erzeugt keinen Fact für Lager mit Bestand', () => {
    const world = fixture();
    const emitted = emitStockLows(world);
    expect(emitted).toBe(0);
    expect(world.narrative.pending).toHaveLength(0);
  });

  it('emitStockLows erzeugt STOCK_LOW für leere BAR/STORAGE', () => {
    const world = fixture();
    const bar = world.furniture.find((item) => item.kind === 'BAR');
    if (!bar) throw new Error('Keine BAR im Fixture');
    bar.stock = 0;

    const emitted = emitStockLows(world);
    expect(emitted).toBe(1);
    const fact = world.narrative.pending[0]!;
    expect(fact.kind).toBe('STOCK_LOW');
    if (fact.kind !== 'STOCK_LOW') throw new Error('Unerwarteter Fact-Kind');
    expect(fact.furnitureId).toBe(bar.id);
    expect(fact.stock).toBe(0);
  });

  it('Boundary verarbeitet Geräte- und Lager-Facts und erzeugt Journal-Einträge', () => {
    const world = fixture();
    const ledger = new Ledger();
    const broken = world.furniture.find((item) => item.kind === 'SLOT');
    if (!broken) throw new Error('Kein SLOT-Gerät im Fixture');
    broken.damaged = true;
    const bar = world.furniture.find((item) => item.kind === 'BAR');
    if (!bar) throw new Error('Keine BAR im Fixture');
    bar.stock = 0;

    const result = processNarrativeBoundaryDetailed(world, ledger);

    const deviceFaults = result.facts.filter((f) => f.kind === 'DEVICE_FAULT');
    const stockLows = result.facts.filter((f) => f.kind === 'STOCK_LOW');
    expect(deviceFaults.length).toBeGreaterThanOrEqual(1);
    expect(stockLows.length).toBeGreaterThanOrEqual(1);

    // Journal-Einträge als Leser der Facts
    const journalEntries = world.journal.filter(
      (e) => e.subject.includes('Gerät') || e.subject.includes('Bestand'),
    );
    expect(journalEntries.length).toBeGreaterThanOrEqual(2);
  });
});
