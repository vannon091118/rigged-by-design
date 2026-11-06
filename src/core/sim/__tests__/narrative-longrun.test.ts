/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * NAR-16: Mehr-Tage-Betrieb mit Geschichten, Rivalen und Save/Replay. Der Lauf
 * prueft Grenzen statt Momentaufnahmen: Cooldowns, Event-Instanzen, Memories,
 * Beziehungen, Rivalen-Historie und Save-Bytes bleiben begrenzt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { replaySave, toSavedGame } from '../../../store/save';
import { TICKS_PER_DAY } from '../demand';
import { HAUSKONTO } from '../money';
import { templateFor } from '../narrative/events/definitions';
import { isLiveEventStatus } from '../narrative/event-lifecycle';
import { pushRecent } from '../narrative/facts';
import type { NarrativeFact } from '../narrative/types';
import { hireAgent } from '../staff';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import { randomSeed } from '../../../test/random-seed';
import type { WorldState } from '../types';

/** Budget fuer einen mehrtaegigen Spielstand: gemessen ~137 KiB nach einem Spieltag, ~337 KiB nach zwei. */
const SAVE_BUDGET = 512 * 1024;

function boot(): { world: WorldState; ledger: Ledger; prng: Prng } {
  const world = createWorld('MEDIUM');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(300), 'nar-16', 0);
  for (const role of ['cashier', 'cleaner', 'bartender'] as const) hireAgent(world, ledger, role);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

/** Alle Langzeitgrenzen an einer Stelle: kein Wachstum ohne Deckel. */
function expectBounded(world: WorldState): void {
  const state = world.narrative;
  expect(state.pending.length).toBeLessThanOrEqual(48);
  expect(state.recent.length).toBeLessThanOrEqual(120);
  expect(state.relationships.length).toBeLessThanOrEqual(200);
  expect(state.cooldowns.length).toBeLessThanOrEqual(64);
  expect(state.events.length).toBeLessThanOrEqual(32);
  expect(state.events.filter((event) => isLiveEventStatus(event.status)).length).toBeLessThanOrEqual(8);
  expect(world.journal.length).toBeLessThanOrEqual(240);
  expect(world.archive.length).toBeLessThanOrEqual(2000);
  for (const visitor of world.visitors) expect((visitor.memories ?? []).length).toBeLessThanOrEqual(6);
  for (const mind of world.rivals) {
    expect(mind.history.length).toBeLessThanOrEqual(6);
    expect(mind.evidence.length).toBeLessThanOrEqual(4);
  }
  for (const event of state.events) {
    if (!isLiveEventStatus(event.status)) continue;
    const template = templateFor(event.templateId, event.templateVersion);
    if (template) {
      const known = new Set(template.choices.map((choice) => choice.choiceId));
      for (const choiceId of event.offeredChoiceIds) expect(known.has(choiceId)).toBe(true);
    }
    for (const ref of event.participants) {
      if (!ref.startsWith('visitor:')) continue;
      const id = Number(ref.slice('visitor:'.length));
      expect(world.visitors.some((visitor) => visitor.id === id)).toBe(true);
    }
  }
}

describe('NAR-16 Langzeitintegration', () => {
  it.skipIf(!process.env.RBD_NARRATIVE_LONGRUN)('betreibt zwei Spieltage mit Geschichten und Rivalen ohne Zustandsleck', { timeout: 240_000 }, () => {
    const { world, ledger, prng } = boot();
    for (let day = 1; day <= 2; day += 1) {
      for (let tick = 0; tick < TICKS_PER_DAY; tick += 1) tickWorld(world, ledger, prng);
      expectBounded(world);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
      expect(world.satisfaction).toBeGreaterThanOrEqual(0);
      expect(world.satisfaction).toBeLessThanOrEqual(100);
    }
    expect(world.day).toBeGreaterThan(1);
    expect(world.guestsServed).toBeGreaterThan(10);
    expect(world.visitors.length).toBeGreaterThan(0);
    expect(world.narrative.relationships.length).toBeGreaterThan(0);

    // Rivalen handeln wirklich: Sabotage nach einer verlorenen Begegnung.
    for (const mind of world.rivals) {
      mind.capacity = 80;
      mind.goodwill = -30;
      mind.nextActionTick = 0;
    }
    const grudge: NarrativeFact = {
      id: world.narrative.factSeq++, tick: world.tick, day: world.day, kind: 'RIVAL_ENCOUNTER',
      actorRefs: ['rival:HAFENKLAUSE', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: 5_000 as VaCoinMicro,
    };
    pushRecent(world, [grudge]);
    for (let tick = 0; tick < 5; tick += 1) tickWorld(world, ledger, prng);

    expect(world.rivals.reduce((sum, mind) => sum + mind.history.length, 0)).toBeGreaterThan(0);
    // Facts entstehen nur am Uebergang: hoechstens eine Aktion je Rivale im Fenster.
    const transitionFacts = world.narrative.recent.filter((entry) => entry.kind === 'RIVAL_ACTION'
      && entry.tick > world.tick - 5).length;
    expect(transitionFacts).toBeGreaterThan(0);
    expect(transitionFacts).toBeLessThanOrEqual(world.rivals.length);
    expect(world.journal.some((event) => event.kind === 'RIVAL')).toBe(true);
    expect(world.narrative.relationships.some((edge) => edge.from.startsWith('rival:') && edge.to === 'player')).toBe(true);
    expectBounded(world);

    const bytes = JSON.stringify(toSavedGame(world, ledger, prng.getState())).length;
    expect(bytes).toBeLessThan(SAVE_BUDGET);
  });

  it.skipIf(!process.env.RBD_NARRATIVE_LONGRUN)('liefert nach Save und Replay denselben Verlauf', { timeout: 240_000 }, () => {
    const { world, ledger, prng } = boot();
    for (let tick = 0; tick < TICKS_PER_DAY; tick += 1) tickWorld(world, ledger, prng);
    const savedState = prng.getState();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, savedState))) as unknown;
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    const prngA = new Prng(savedState);
    const prngB = new Prng(savedState);
    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(world, ledger, prngA);
      tickWorld(loaded!.world, loaded!.ledger, prngB);
    }
    expect(loaded!.world.tick).toBe(world.tick);
    expect(loaded!.world.day).toBe(world.day);
    expect(loaded!.world.guestsServed).toBe(world.guestsServed);
    expect(loaded!.world.visitors.length).toBe(world.visitors.length);
    expect(loaded!.world.rivals).toEqual(world.rivals);
    expect(loaded!.ledger.entryCount).toBe(ledger.entryCount);
    expect(loaded!.world.narrative.recent.length).toBe(world.narrative.recent.length);
  });
});
