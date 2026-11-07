/**
 * @test-target: src/core/sim/disputes.ts
 * @error-code: ERR-2001
 *
 * Ein echter Streit zwischen zwei Gästen ist die Quelle für gerichtete
 * Besucher-zu-Besucher-Kanten. Ein zweiter Aufruf darf keinen zweiten Disput
 * und keine doppelte Kante erzeugen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { maybeStartBrawl, tickDisputes } from '../disputes';
import { processNarrativeBoundary } from '../narrative/boundary';
import { actorRefOfVisitor, relationshipBetween } from '../narrative/relationships';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  const a = spawnGuest(world, prng, ledger);
  const b = spawnGuest(world, prng, ledger);
  if (!a || !b) throw new Error('Testwelt konnte keine zwei Gäste erzeugen.');
  for (const guest of [a, b]) {
    guest.state = 'ANGRY';
    guest.disputeId = null;
    guest.position = { ...a.position };
    guest.path = [];
  }
  return { world, ledger, prng, a, b };
}

describe('Narrative Streitquelle', () => {
  it('erzeugt aus einem echten Disput zwei unterschiedlich gerichtete Kanten', () => {
    const { world, ledger, prng, a, b } = setup();
    maybeStartBrawl(world, prng, true);
    expect(world.disputes).toHaveLength(1);
    processNarrativeBoundary(world, ledger);
    const aRef = actorRefOfVisitor(a.visitorId!);
    const bRef = actorRefOfVisitor(b.visitorId!);
    const aToB = relationshipBetween(world, aRef, bRef);
    const bToA = relationshipBetween(world, bRef, aRef);
    expect(aToB?.trust).toBe(-2);
    expect(aToB?.conflict).toBe(2);
    expect(bToA?.trust).toBe(-3);
    expect(bToA?.conflict).toBe(3);
    expect(aToB).not.toEqual(bToA);
  });

  it('erzeugt ohne wütende Gäste keinen Disput und keine Kante', () => {
    const { world, ledger, prng, a, b } = setup();
    a.state = 'CHOOSE';
    b.state = 'CHOOSE';
    maybeStartBrawl(world, prng, true);
    processNarrativeBoundary(world, ledger);
    expect(world.disputes).toHaveLength(0);
    expect(world.narrative.relationships).toEqual([]);
  });

  it('emittiert beim Eskalieren genau einen zweiten Konflikt-Fact', () => {
    const { world, ledger, prng, a, b } = setup();
    maybeStartBrawl(world, prng, true);
    for (let tick = 0; tick < 4; tick += 1) tickDisputes(world);
    processNarrativeBoundary(world, ledger);
    const facts = world.narrative.recent.filter((fact) => fact.kind === 'VISITOR_CONFLICT');
    expect(facts.map((fact) => fact.kind === 'VISITOR_CONFLICT' ? fact.severity : 0)).toEqual([1, 2]);
    const edge = relationshipBetween(world, actorRefOfVisitor(a.visitorId!), actorRefOfVisitor(b.visitorId!));
    expect(edge?.conflict).toBe(6);
  });

  it('verarbeitet denselben Disput nicht ein zweites Mal', () => {
    const { world, ledger, prng } = setup();
    maybeStartBrawl(world, prng, true);
    maybeStartBrawl(world, prng, true);
    processNarrativeBoundary(world, ledger);
    expect(world.disputes).toHaveLength(1);
    expect(world.narrative.relationships).toHaveLength(2);
    expect(world.narrative.recent.filter((fact) => fact.kind === 'VISITOR_CONFLICT')).toHaveLength(1);
  });
});
