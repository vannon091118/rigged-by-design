/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Save v11: Layout-Vertrag im Spielstand, Migration aus v5–v10 und
 * fail-closed Verhalten bei ungueltigem Plan.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { buildEnvelope } from '../../core/io/envelope';
import { expandHouse } from '../../core/sim/expansions';
import { layoutFromTemplate, zonesFromLayout } from '../../core/sim/layout-derive';
import { createWorld } from '../../core/sim/templates';
import type { TemplateId } from '../../core/sim/types';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';
import { exportGameData, planImportData } from '../transfer';

const GUEST = {
  id: 1, name: 'Testgast', persona: 'STREET', mood: 50, patience: 60, addiction: 90,
  sociability: 40, state: 'ENTER', stateTicks: 0, position: { x: 1, y: 1 }, path: [], pathIndex: 0,
  targetFurniture: 0, targetZone: 'entrance', queueIndex: 0, need: 'play', anger: 0, dirtTimer: 0,
  lastResult: '', spins: 0,
};

function legacy(version: number, template: TemplateId = 'SMALL') {
  return {
    version, template, carpet: 'VIOLET', furniture: [], guests: [GUEST],
    player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
    dirty: [],
    prices: {
      entryFee: 0, drinkPrice: fromVC(0.4), slotMinBet: fromVC(0.05), staffWage: fromVC(4),
      guardWage: fromVC(6), cleaningCost: fromVC(0.8), repairCost: fromVC(2),
    },
    staff: { guard: false, cleaner: false, bartender: false },
    tick: 12, day: 1, nextGuestId: 2, nextFurnitureId: 100, guardsHired: 0,
    lastEvent: `v${version} stand`,
    entries: [{ tick: 3, from: 'EXTERNAL_WORLD', to: 'VISITOR_1', amount: fromVC(3), reason: 'gast 1 chips' }],
    prngState: 4242,
  };
}

function savedJson(world: ReturnType<typeof createWorld>, ledger: Ledger, state: number): Record<string, unknown> {
  return JSON.parse(JSON.stringify(toSavedGame(world, ledger, state))) as Record<string, unknown>;
}

describe('Save v11 mit Layout-Vertrag', () => {
  it('schreibt Version 11 mit Layout und liest denselben Plan zurueck', () => {
    const world = createWorld('MEDIUM');
    const saved = toSavedGame(world, new Ledger(), randomSeed());
    expect(saved.version).toBe(11);
    const loaded = replaySave(JSON.parse(JSON.stringify(saved)));
    expect(loaded).not.toBeNull();
    expect(loaded!.world.layout).toEqual(world.layout);
    expect(loaded!.world.size).toBe(loaded!.world.layout.size);
    expect(loaded!.world.zones).toEqual(zonesFromLayout(loaded!.world.layout));
  });

  it('behaelt Ledger, PRNG und Narrative ueber den Layout-Roundtrip', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100), 'baukapital', 0);
    const state = randomSeed();
    const loaded = replaySave(savedJson(world, ledger, state))!;
    expect(loaded.prngState).toBe(state);
    expect(loaded.ledger.getBalance('HAUSKONTO')).toBe(fromVC(100));
    expect(loaded.ledger.entryCount).toBe(ledger.entryCount);
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
    expect(loaded.world.narrative.flags).toEqual(world.narrative.flags);
  });

  it('behaelt Ausbauzonen im gespeicherten Layout', () => {
    const world = createWorld('MEDIUM');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(600), 'baukapital', 0);
    expandHouse(world, ledger, 'LARGE', 5);
    const loaded = replaySave(savedJson(world, ledger, randomSeed()))!;
    expect(loaded.world.size).toBe(90);
    expect(loaded.world.layout.zones.map((zone) => zone.id)).toEqual(world.layout.zones.map((zone) => zone.id));
    expect(loaded.world.zones).toEqual(zonesFromLayout(loaded.world.layout));
    expect(loaded.world.layout.zones.some((zone) => zone.kind === 'EXPANSION')).toBe(true);
  });

  it.each([5, 6, 7, 8, 9, 10])('migriert v%i deterministisch aus der Vorlage', (version) => {
    const loaded = replaySave(legacy(version));
    expect(loaded).not.toBeNull();
    expect(loaded!.world.layout).toEqual(layoutFromTemplate('SMALL'));
    expect(loaded!.world.size).toBe(30);
    expect(loaded!.world.zones).toEqual(zonesFromLayout(layoutFromTemplate('SMALL')));
    expect(loaded!.prngState).toBe(4242);
    expect(loaded!.ledger.getBalance('VISITOR_1')).toBe(fromVC(3));
  });

  it('weist v11 mit ungueltigem Layout fail-closed ab', () => {
    const base = savedJson(createWorld('SMALL'), new Ledger(), randomSeed());
    const layout = base.layout as { floor: string[]; edges: Record<string, unknown>[] };
    const wall = layout.edges.find((edge) => edge.kind === 'WALL')!;
    const variants = [
      { ...base, layout: { ...layout, size: 90 } },
      { ...base, layout: { ...layout, floor: layout.floor.slice(1) } },
      { ...base, layout: { ...layout, floor: ['MARMOR', ...layout.floor.slice(1)] } },
      { ...base, layout: { ...layout, edges: [...layout.edges, wall] } },
      { ...base, layout: { ...layout, edges: layout.edges.map((edge) => (edge.kind === 'DOOR' ? { ...edge, zoneId: 'gibtsnicht' } : edge)) } },
      { ...base, layout: { ...layout, edges: layout.edges.map((edge) => (edge.kind === 'WALL' ? edge : { ...edge, kind: 'WALL', id: null })) } },
      { ...base, layout: undefined },
    ];
    for (const variant of variants) expect(replaySave(variant)).toBeNull();
  });

  it('exportiert und importiert den Layout-Vertrag', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const json = exportGameData(world, ledger, randomSeed());
    const planned = planImportData(json);
    expect(planned.report.ok).toBe(true);
    expect(planned.loaded!.world.layout).toEqual(world.layout);
    const envelope = JSON.parse(json) as { payload: Record<string, unknown>; savedAt: string };
    const layout = envelope.payload.layout as { floor: string[] };
    const tampered = buildEnvelope({ ...envelope.payload, layout: { ...layout, floor: layout.floor.slice(1) } }, envelope.savedAt);
    const rejected = planImportData(JSON.stringify(tampered));
    expect(rejected.report.ok).toBe(false);
    expect(rejected.loaded).toBeNull();
  });
});
