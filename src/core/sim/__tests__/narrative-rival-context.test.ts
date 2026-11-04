/**
 * @test-target: src/core/sim/narrative/rival-context.ts | @error-code: ERR-2001
 *
 * Phase 5: Rivalen-Karten leiten sich rein aus Minds, Indizien und
 * counteredUntilTick ab. Keine zweite Wahrheit, keine NAR-14-17-Duplikate;
 * `view.ts` bleibt durch den Helper unter 200 Zeilen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { RIVAL_AI_LIMITS } from '../rival-ai/types';
import { rivalViews } from '../narrative/rival-context';
import { buildNarrativeView } from '../narrative/view';
import { createWorld } from '../templates';
import { RIVAL_IDS } from '../types-model';

function sabotagedWorld() {
  const world = createWorld('SMALL');
  const mind = world.rivals.find((entry) => entry.rivalId === 'HAFENKLAUSE')!;
  mind.stance = 'HOSTILE';
  mind.capacity = 70;
  mind.goodwill = -20;
  mind.counteredUntilTick = world.tick + 900;
  mind.nextActionTick = world.tick + 260;
  mind.evidence.push({
    action: 'SABOTAGE', tick: world.tick, day: world.day,
    machineId: 2, blocked: true, note: 'Guard hat den Saboteur gestoppt.',
  });
  mind.history.push({ action: 'SABOTAGE', tick: world.tick, day: world.day, summary: 'Sabotageversuch.' });
  return { world, mind };
}

describe('Rivalen-Karten (Phase 5)', () => {
  it('liefert je Rivale eine Karte in kanonischer Reihenfolge', () => {
    const world = createWorld('SMALL');
    const views = rivalViews(world);
    expect(views.map((view) => view.rivalId)).toEqual([...RIVAL_IDS]);
    for (const view of views) {
      expect(view.countered).toBe(false);
      expect(view.counteredTicksLeft).toBe(0);
      expect(view.evidence).toEqual([]);
      expect(view.history).toEqual([]);
    }
  });

  it('zeigt Gegenmassnahme, Haltung, Indizien und Historie aus dem Mind', () => {
    const { world, mind } = sabotagedWorld();
    const [first, ...rest] = rivalViews(world);
    const card = [first, ...rest].find((view) => view.rivalId === mind.rivalId)!;
    expect(card.stance).toBe('HOSTILE');
    expect(card.capacity).toBe(70);
    expect(card.goodwill).toBe(-20);
    expect(card.countered).toBe(true);
    expect(card.counteredTicksLeft).toBe(900);
    expect(card.nextActionTick).toBe(world.tick + 260);
    expect(card.evidence).toHaveLength(1);
    expect(card.evidence[0]).toMatchObject({ action: 'SABOTAGE', blocked: true });
    expect(card.history).toHaveLength(1);
    // Kopien statt Referenzen: die Karte schreibt nicht in den Mind zurueck.
    expect(card.evidence[0]).not.toBe(mind.evidence[0]);
    expect(card.evidence[0]).toEqual(mind.evidence[0]);
    // Abgelaufene Gegenmassnahme heisst nicht mehr kontert.
    world.tick += 901;
    expect(rivalViews(world).find((view) => view.rivalId === mind.rivalId)?.countered).toBe(false);
  });

  it('deckelt Anzeige auf die Rivalen-Limits und enthaelt keine zweite Wahrheit', () => {
    const { world, mind } = sabotagedWorld();
    for (let index = 0; index < 10; index += 1) {
      mind.evidence.push({
        action: 'PROBE', tick: index, day: 1, machineId: null, blocked: false, note: `Flut ${index}`,
      });
      mind.history.push({ action: 'PROBE', tick: index, day: 1, summary: `Flut ${index}` });
    }
    const card = rivalViews(world).find((view) => view.rivalId === mind.rivalId)!;
    expect(card.evidence).toHaveLength(RIVAL_AI_LIMITS.evidence);
    expect(card.history).toHaveLength(RIVAL_AI_LIMITS.history);
    expect(Object.keys(card).sort()).toEqual([
      'capacity', 'countered', 'counteredTicksLeft', 'evidence', 'goodwill',
      'history', 'nextActionTick', 'rivalId', 'stance',
    ]);
  });

  it('haengt die Karten unveraendert in die NarrativeView', () => {
    const { world } = sabotagedWorld();
    const view = buildNarrativeView(world, new Ledger());
    expect(view.rivals).toEqual(rivalViews(world));
    expect(view.rivals).toHaveLength(RIVAL_IDS.length);
  });
});
