/**
 * @test-target: src/store/foreign-play.ts
 * @error-code: ERR-1002
 *
 * Eine echte Kartenabrechnung im fremden Haus erzeugt eine Rivale-zu-Haus-Kante.
 * Gewinn und Verlust wirken unterschiedlich; ein neutraler Ausgang erzeugt keine Kante.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { PORTEMONNAIE } from '../../core/sim/money';
import { processNarrativeBoundary } from '../../core/sim/narrative/boundary';
import { actorRefOfRival, relationshipBetween } from '../../core/sim/narrative/relationships';
import { createWorld } from '../../core/sim/templates';
import { settleCardOutcome } from '../foreign-play';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', PORTEMONNAIE, fromVC(5), 'test', 0);
  return { world, ledger };
}

describe('Narrative Rivalenquelle', () => {
  it('macht den Rivalen nach einem Hausgewinn misstrauischer', () => {
    const { world, ledger } = setup();
    const outcome = settleCardOutcome(world, ledger, 'HAFENKLAUSE', 0, 0.5, 20_000, 'Sieg');
    expect(outcome.result.payout).toBeGreaterThan(outcome.result.stake);
    processNarrativeBoundary(world, ledger);
    const edge = relationshipBetween(world, actorRefOfRival('HAFENKLAUSE'), 'player');
    expect(edge?.trust).toBe(-1);
    expect(edge?.conflict).toBe(1);
  });

  it('erzeugt nach einem Rivalengewinn eine positive, gerichtete Kante', () => {
    const { world, ledger } = setup();
    const outcome = settleCardOutcome(world, ledger, 'HAFENKLAUSE', 0, 0.5, 0, 'Niederlage');
    expect(outcome.result.payout).toBe(0);
    processNarrativeBoundary(world, ledger);
    const edge = relationshipBetween(world, actorRefOfRival('HAFENKLAUSE'), 'player');
    expect(edge?.trust).toBe(1);
    expect(edge?.sympathy).toBe(1);
  });

  it('erzeugt bei einem neutralen Ausgang keine Kante', () => {
    const { world, ledger } = setup();
    settleCardOutcome(world, ledger, 'HAFENKLAUSE', 0, 0.5, 10_000, 'Einsatz zurück');
    processNarrativeBoundary(world, ledger);
    expect(world.narrative.relationships).toEqual([]);
  });
});
