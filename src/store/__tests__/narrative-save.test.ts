/** @test-target: src/store/save.ts | @error-code: ERR-1003 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { openHouse } from '../../core/sim/money';
import { createNarrativeState, seedStartPool } from '../../core/sim/narrative/state';
import { scheduleEvent, transitionEvent } from '../../core/sim/narrative/scheduler';
import { tickWorld } from '../../core/sim/tick';
import { demandBreakdown } from '../../core/sim/demand';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';

function fixture() {
  const world = createWorld('MEDIUM');
  ensureStarter(world);
  const ledger = new Ledger();
  seedStartPool(world, openHouse(ledger, 0));
  const prng = new Prng(randomSeed());
  for (let step = 0; step < 60; step += 1) tickWorld(world, ledger, prng);
  return { world, ledger };
}

describe('Save v9 bewahrt die Narrative-Domaene', () => {
  it('erhaelt Facts, Flags und Erinnerungen ueber JSON', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(world.narrative);
    expect(loaded!.world.narrative.flags.startkapital).toBeGreaterThan(0);
    expect(loaded!.world.visitors).toEqual(world.visitors);
  });

  it('erhaelt Event-Instanzen, Cooldowns und Narrativ-RNG ueber JSON', () => {
    const { world, ledger } = fixture();
    const event = scheduleEvent(world, {
      eventId: 'SAVE_EVENT', priority: 10, scope: 'GLOBAL', participants: [],
      sourceFactId: 1, cooldownTicks: 4,
    }, 'ACTIVE', world.tick);
    expect(event).not.toBeNull();
    expect(transitionEvent(world, event!.id, 'RESOLVED', world.tick, 'SAVED')).toBe(true);
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(world.narrative);
  });

  it('laedt v8 ohne Narrative-Feld mit sicheren Defaults', () => {
    const { world, ledger } = fixture();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
    saved.version = 8;
    delete saved.narrative;
    for (const visitor of saved.visitors as Array<Record<string, unknown>>) delete visitor.memories;
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(createNarrativeState());
    expect(loaded!.world.visitors.every((visitor) => (visitor.memories ?? []).length === 0)).toBe(true);
  });

  it('migriert aktive alte Nachfrageevents von v5 bis v9 in den narrativen Zustand', () => {
    const { world, ledger } = fixture();
    for (const version of [5, 6, 7, 8, 9]) {
      for (const kind of ['NEON_NACHT', 'TURNIER_ABEND'] as const) {
        const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
        saved.version = version;
        saved.demandEvent = { kind, untilTick: world.tick + 100 };
        delete (saved.narrative as Record<string, unknown>).demandEvent;
        const loaded = replaySave(saved);
        expect(loaded).not.toBeNull();
        expect(loaded!.world.narrative.demandEvent).toEqual({ kind, untilTick: world.tick + 100 });
        expect(demandBreakdown(loaded!.world).event?.kind).toBe(kind);
        expect(demandBreakdown(loaded!.world).sources.find((source) => source.id === 'EVENT')?.perDay)
          .toBe(kind === 'NEON_NACHT' ? 20 : 16);
        const nextSave = toSavedGame(loaded!.world, loaded!.ledger, 7);
        expect(nextSave.demandEvent).toBeUndefined();
        expect(replaySave(JSON.parse(JSON.stringify(nextSave)))!.world.narrative.demandEvent).toEqual({ kind, untilTick: world.tick + 100 });
      }
    }
  });

  it('erweckt abgelaufene und bereits migrierte Veranstaltungen nicht erneut', () => {
    const { world, ledger } = fixture();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
    saved.demandEvent = { kind: 'NEON_NACHT', untilTick: world.tick + 100 };
    expect(replaySave(saved)!.world.narrative.demandEvent).toBeNull();
    delete (saved.narrative as Record<string, unknown>).demandEvent;
    saved.demandEvent = { kind: 'NEON_NACHT', untilTick: world.tick };
    expect(replaySave(saved)!.world.narrative.demandEvent).toBeNull();
  });

  it('setzt zwei aus demselben Save geladene Welten inklusive Narrative identisch fort', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const left = replaySave(raw)!;
    const right = replaySave(raw)!;
    const leftPrng = new Prng(left.prngState);
    const rightPrng = new Prng(right.prngState);
    for (let step = 0; step < 80; step += 1) {
      tickWorld(left.world, left.ledger, leftPrng);
      tickWorld(right.world, right.ledger, rightPrng);
    }
    expect(left.world.narrative).toEqual(right.world.narrative);
    expect(left.world.visitors).toEqual(right.world.visitors);
    expect(left.world.tick).toBe(right.world.tick);
  });
});
