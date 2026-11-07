/** @test-target: src/store/save.ts | @error-code: ERR-5001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { openHouse } from '../../core/sim/money';
import { activeDemandEvent } from '../../core/sim/narrative/demand-events';
import { demandDefinition } from '../../core/sim/narrative/events/demand-definitions';
import { createNarrativeState, seedStartPool } from '../../core/sim/narrative/state';
import { scheduleEvent, transitionEvent } from '../../core/sim/narrative/scheduler';
import { tickWorld } from '../../core/sim/tick';
import { demandBreakdown } from '../../core/sim/demand';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';
import { hydrateNarrative, type MigrationReport } from '../migrate-narrative';

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
      eventId: 'SAVE_EVENT', templateId: 'SAVE_TEMPLATE', templateVersion: 2,
      offeredChoiceIds: ['KEEP'], priority: 10, scope: 'GLOBAL', participants: [],
      sourceFactId: 1, cooldownTicks: 4,
    }, 'ACTIVE', world.tick);
    expect(event).not.toBeNull();
    expect(transitionEvent(world, event!.id, 'RESOLVED', world.tick, 'SAVED')).toBe(true);
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(world.narrative);
    expect(loaded!.world.narrative.events.find((entry) => entry.eventId === 'SAVE_EVENT')?.offeredChoiceIds)
      .toEqual(['KEEP']);
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

  it('migriert aktive alte Nachfrageevents von v5 bis v9 in Event-Instanzen', () => {
    const { world, ledger } = fixture();
    for (const version of [5, 6, 7, 8, 9]) {
      for (const kind of ['NEON_NACHT', 'TURNIER_ABEND'] as const) {
        const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
        saved.version = version;
        saved.demandEvent = { kind, untilTick: world.tick + 100 };
        delete (saved.narrative as Record<string, unknown>).demandEvent;
        const loaded = replaySave(saved);
        expect(loaded).not.toBeNull();
        const active = activeDemandEvent(loaded!.world);
        expect(active?.eventId).toBe(kind);
        expect(active?.status).toBe('ACTIVE');
        expect(active?.scope).toBe('GLOBAL');
        expect(active?.expiresTick).toBe(world.tick + 100);
        expect(loaded!.world.narrative).not.toHaveProperty('demandEvent');
        expect(demandBreakdown(loaded!.world).event).toEqual({
          kind, label: demandDefinition(kind).label, ticksLeft: 100,
        });
        expect(demandBreakdown(loaded!.world).sources.find((source) => source.id === 'EVENT')?.perDay)
          .toBe(demandDefinition(kind).perDay);
        const nextSave = toSavedGame(loaded!.world, loaded!.ledger, 7);
        expect(nextSave.demandEvent).toBeUndefined();
        expect(nextSave.narrative).not.toHaveProperty('demandEvent');
        const nextNarrative = nextSave.narrative as unknown as { events: readonly { eventId: string }[] };
        expect(nextNarrative.events.filter((event) => event.eventId === kind)).toHaveLength(1);
        const reloaded = replaySave(JSON.parse(JSON.stringify(nextSave)));
        expect(reloaded).not.toBeNull();
        expect(reloaded!.world.narrative.events.filter((event) => event.eventId === kind
          && (event.status === 'ACTIVE' || event.status === 'OFFERED'))).toHaveLength(1);
        expect(activeDemandEvent(reloaded!.world)?.expiresTick).toBe(world.tick + 100);
      }
    }
  });

  it('erweckt abgelaufene Veranstaltungen nicht erneut', () => {
    const { world, ledger } = fixture();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
    saved.demandEvent = { kind: 'NEON_NACHT', untilTick: world.tick };
    const expired = replaySave(saved);
    expect(expired).not.toBeNull();
    expect(activeDemandEvent(expired!.world)).toBeNull();
    const v9 = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
    (v9.narrative as Record<string, unknown>).demandEvent = { kind: 'TURNIER_ABEND', untilTick: world.tick + 50 };
    const migrated = replaySave(v9);
    expect(migrated).not.toBeNull();
    expect(activeDemandEvent(migrated!.world)?.eventId).toBe('TURNIER_ABEND');
    expect(migrated!.world.narrative).not.toHaveProperty('demandEvent');
  });

  it('meldet in MigrationReport welche Legacy-Quelle uebernommen wurde', () => {
    const freshWorld = createWorld('SMALL');
    const report: MigrationReport = hydrateNarrative(freshWorld, {
      demandEvent: { kind: 'NEON_NACHT', untilTick: freshWorld.tick + 100 },
    });
    expect(report.legacyKind).toBe('NEON_NACHT');
    expect(report.demandStarted).toBe(true);
    expect(report.untilTickClamped).toBe(false);
    expect(report.conflictingLegacy).toBe(false);
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
