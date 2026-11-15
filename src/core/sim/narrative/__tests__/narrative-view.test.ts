/**
 * @test-target: src/core/sim/narrative/view.ts
 * @error-code: ERR-2001
 *
 * Das View-Modell leitet Szenen, Choices und Profile rein aus Welt, Ledger und
 * Composer ab; es entscheidet nichts und speichert nichts.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { fromVC } from '../../../economy/vacoin';
import { Prng } from '../../../rng/prng';
import { randomSeed } from '../../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../../store/save';
import { cityOf } from '../../city-model';
import type { CityEncounterRecord, EncounterAction } from '../../city-types';
import { encounterMemory } from '../../city-encounter-dialog';
import { spawnGuest } from '../../spawn';
import { createWorld, ensureStarter } from '../../templates';
import type { WorldState } from '../../types';
import { recordVisitor } from '../../visitors';
import { transitionEvent } from '../event-lifecycle';
import { emitFact } from '../facts';
import { actorRefOfVisitor, shift } from '../relationships';
import { playerContact, relationshipTier, TIER_MEMORY_CLAUSE } from '../relationship-tier';
import { processNarrativeRuntime } from '../runtime';
import { buildNarrativeView } from '../view';

function scene() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Kern', persona: 'STAMMGAST', tick: 0 });
  emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  processNarrativeRuntime(world, ledger);
  return { world, ledger, visitor };
}

describe('Narrative View (NAR-14)', () => {
  it('liefert die aktive Szene mit Text, Teilnehmern und Choices', () => {
    const { world, ledger, visitor } = scene();

    const view = buildNarrativeView(world, ledger);

    expect(view.events).toHaveLength(1);
    const event = view.events[0]!;
    expect(event.eventId).toBe('VISITOR_RETURN');
    expect(event.title.length).toBeGreaterThan(0);
    expect(event.body.length).toBeGreaterThan(0);
    expect(event.fallbackSlots).toEqual([]);
    expect(event.choices.map((choice) => choice.label)).toEqual([
      'Ihn mit einem Nicken an den Tresen holen.', 'Nach seinem letzten Abend fragen.',
    ]);
    expect(event.participants[0]).toMatchObject({ label: 'Rita Kern', visitorId: visitor.id });
    expect(event.choices.map((choice) => choice.choiceId)).toEqual(['WELCOME_BACK', 'ASK_ABOUT_LAST_VISIT']);
    expect(event.expiresInTicks).toBeGreaterThan(0);
  });

  it('sperrt eine abgelaufene Choice mit Grund, statt sie zu verschweigen', () => {
    const { world, ledger } = scene();

    world.tick += 400;
    const event = buildNarrativeView(world, ledger).events[0]!;

    expect(event.expiresInTicks).toBe(0);
    expect(event.choices.every((choice) => !choice.available)).toBe(true);
    expect(event.choices[0]!.reasons).toContain('EVENT_EXPIRED');
  });

  it('nennt den Grund einer gesperrten Choice, wenn eine Voraussetzung fehlt', () => {
    const { world, ledger } = scene();

    const blocked = buildNarrativeView(world, ledger).events[0]!.choices
      .find((choice) => choice.choiceId === 'ASK_ABOUT_LAST_VISIT');

    expect(blocked?.available).toBe(false);
    expect(blocked?.reasons).toContain('REQUIREMENT_NOT_MET');
  });

  it('zeigt Profile nur mit belegten Daten', () => {
    const { world, ledger, visitor } = scene();

    const profile = buildNarrativeView(world, ledger).profiles.find((entry) => entry.visitorId === visitor.id);

    expect(profile?.name).toBe('Rita Kern');
    expect(profile?.stories).toEqual(['VISITOR_RETURN']);
    expect(profile?.memories).toEqual([]);
    expect(profile?.relationships).toEqual([]);
  });

  it('nimmt Gaeste auf dem Floor in die Profile auf', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;

    const profile = buildNarrativeView(world, ledger).profiles
      .find((entry) => entry.visitorId === guest.visitorId);

    expect(profile?.name).toBe(guest.name);
    expect(profile?.memories).toEqual([]);
    expect(profile?.stories).toEqual([]);
  });

  it('fuehrt abgeschlossene Szenen als Historie mit Ausgang', () => {
    const { world, ledger } = scene();
    const event = world.narrative.events[0]!;
    expect(buildNarrativeView(world, ledger).history).toHaveLength(0);

    transitionEvent(world, event.id, 'CANCELLED', 42, 'MISSING_PARTICIPANT');
    const history = buildNarrativeView(world, ledger).history;

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      eventId: 'VISITOR_RETURN', status: 'CANCELLED', tick: 42, resolution: 'MISSING_PARTICIPANT',
    });
    expect(history[0]!.participants).toEqual(['Rita Kern']);
    expect(history[0]!.title.length).toBeGreaterThan(0);
    expect(buildNarrativeView(world, ledger).events).toHaveLength(0);
  });

  it('ist deterministisch: gleiche Welt, gleiches Modell', () => {
    const { world, ledger } = scene();

    expect(buildNarrativeView(world, ledger)).toEqual(buildNarrativeView(world, ledger));
  });
});

describe('Beziehungstier und Kontakt-Registry (Kontakte aus Begegnungen, #802)', () => {
  const worldOf = (): WorldState => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    return world;
  };
  const encounter = (npcId: number, day: number, action: EncounterAction): CityEncounterRecord => ({
    npcId, name: `Figur ${npcId}`, location: 'KIEZ', day, tick: day * 24, action, amount: fromVC(1), trust: 0,
  });
  const withEncounters = (world: WorldState, ...records: CityEncounterRecord[]): WorldState => {
    world.city = { ...cityOf(world), encounters: records };
    return world;
  };

  it('liest ohne Kante FREMDE - ohne Schreiber und ohne Zufall', () => {
    const world = worldOf();
    const first = relationshipTier(world, actorRefOfVisitor(1), 'player');
    const second = relationshipTier(world, actorRefOfVisitor(1), 'player');
    expect(first).toBe('FREMDE');
    expect(second).toBe('FREMDE');
    expect(TIER_MEMORY_CLAUSE.FREMDE).toBe('');
  });

  it('ordnet schwache Kanten KONTAKT und warme Kanten VERTRAUT zu', () => {
    const world = worldOf();
    shift(world, actorRefOfVisitor(1), 'player', { trust: 2, sympathy: 1 }, 5);
    expect(relationshipTier(world, actorRefOfVisitor(1), 'player')).toBe('KONTAKT');
    shift(world, actorRefOfVisitor(1), 'player', { trust: 2 }, 6);
    expect(relationshipTier(world, actorRefOfVisitor(1), 'player')).toBe('VERTRAUT');
  });

  it('gibt aktiver Anspannung Vorrang vor warmen Zahlen', () => {
    const world = worldOf();
    shift(world, actorRefOfVisitor(1), 'player', { trust: 6, sympathy: 4 }, 5);
    expect(relationshipTier(world, actorRefOfVisitor(1), 'player')).toBe('VERTRAUT');
    shift(world, actorRefOfVisitor(1), 'player', { conflict: 3 }, 6);
    expect(relationshipTier(world, actorRefOfVisitor(1), 'player')).toBe('ANSPANNUNG');
  });

  it('zaehlt aufgezeichnete Begegnungen als Kontakte mit aktuellem Tier', () => {
    const world = withEncounters(
      worldOf(),
      encounter(1, 2, 'GEBEN'),
      encounter(1, 5, 'HELFEN'),
      encounter(2, 3, 'ABLEHNEN'),
    );
    expect(playerContact(world, 1)).toMatchObject({ met: 2, lastDay: 5, lastAction: 'HELFEN', tier: 'FREMDE' });
    const nobody = playerContact(world, 9);
    expect(nobody).toMatchObject({ met: 0, lastDay: null, lastAction: null, tier: 'FREMDE' });
  });

  it('antwortet im Dialog tierbewusst aus einer Quelle', () => {
    const world = worldOf();
    expect(encounterMemory(world, 1, 'Ada')).toBe('Ada sieht dich zum ersten Mal.');
    shift(world, actorRefOfVisitor(1), 'player', { trust: 4, sympathy: 2 }, 5);
    withEncounters(world, encounter(1, 4, 'GEBEN'));
    expect(encounterMemory(world, 1, 'Ada')).toBe(
      `Ada erinnert sich an Tag 4: eine Runde ausgegeben.${TIER_MEMORY_CLAUSE.VERTRAUT}`,
    );
    shift(world, actorRefOfVisitor(1), 'player', { conflict: 3 }, 6);
    expect(encounterMemory(world, 1, 'Ada')).toBe(
      `Ada erinnert sich an Tag 4: eine Runde ausgegeben.${TIER_MEMORY_CLAUSE.ANSPANNUNG}`,
    );
  });

  it('bleibt ueber Save/Load stabil, weil das Tier kein zweiter Zustand ist', () => {
    const world = withEncounters(worldOf(), encounter(1, 4, 'HELFEN'));
    shift(world, actorRefOfVisitor(1), 'player', { trust: 4, sympathy: 2 }, 5);
    const before = playerContact(world, 1);
    const loaded = replaySave(toSavedGame(world, new Ledger(), 42))!;
    expect(playerContact(loaded.world, 1)).toEqual(before);
  });
});
