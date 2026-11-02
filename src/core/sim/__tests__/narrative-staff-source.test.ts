/**
 * @test-target: src/core/sim/desk-service.ts
 * @error-code: ERR-2001
 *
 * Die Kasse ist die reale Besucher-Personal-Begegnung: nur ein anwesender
 * Kassierer erzeugt eine Kante, Selbstbedienung bleibt beziehungslos.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { arriveAtDesk } from '../desk-service';
import { admitFiat, openHouse } from '../money';
import { processNarrativeBoundary } from '../narrative/boundary';
import { actorRefOfStaff, actorRefOfVisitor, relationshipBetween } from '../narrative/relationships';
import { spawnGuest } from '../spawn';
import { hireAgent } from '../staff';
import { createWorld, ensureStarter } from '../templates';
import { exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  openHouse(ledger, 0);
  const prng = new Prng(randomSeed());
  const guest = spawnGuest(world, prng, ledger);
  if (!guest) throw new Error('Testwelt konnte keinen Gast erzeugen.');
  admitFiat(ledger, guest.id, fromVC(5), 0);
  guest.state = 'EXCHANGE';
  guest.queueIndex = 0;
  return { world, ledger, prng, guest };
}

describe('Narrative Kassenquelle', () => {
  it('erzeugt aus einer echten Kassenbedienung eine Besucher-Personal-Kante', () => {
    const { world, ledger, prng, guest } = setup();
    const cashier = hireAgent(world, ledger, 'cashier');
    const point = exchangePoint(world)!;
    cashier.x = point.x;
    cashier.y = point.y;
    expect(arriveAtDesk(world, ledger, prng, guest)).toBe(true);
    processNarrativeBoundary(world, ledger);
    const edge = relationshipBetween(world, actorRefOfVisitor(guest.visitorId!), actorRefOfStaff(cashier.id));
    expect(edge?.trust).toBe(1);
    expect(edge?.sympathy).toBe(1);
    expect(relationshipBetween(world, actorRefOfVisitor(guest.visitorId!), 'player')).toBeNull();
  });

  it('erzeugt ohne anwesendes Personal keine Kante', () => {
    const { world, ledger, prng, guest } = setup();
    const point = exchangePoint(world)!;
    expect(point).not.toBeNull();
    expect(arriveAtDesk(world, ledger, prng, guest)).toBe(true);
    processNarrativeBoundary(world, ledger);
    expect(world.narrative.relationships).toEqual([]);
  });
});
