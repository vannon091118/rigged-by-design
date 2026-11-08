/**
 * @test-target: src/core/sim/player.ts
 * @error-code: ERR-2001
 *
 * Döner-/Treat-Synergie am realen Serve-Pfad: an der Bar positiv, am Slot
 * exakt null. Beide Richtungen werden ueber die Config veraendert, nicht
 * ueber eine Fallunterscheidung im Consumer.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import {
  INFLUENCE_CONFIG, treatInfluence,
  type InfluenceConfig, type InfluenceValues,
} from '../influence';
import { serveDrink, takeDrink } from '../player';
import { actorRefOfVisitor, relationshipBetween } from '../narrative/relationships';
import { createWorld } from '../templates';
import { makeGuest } from '../traits';
import { recordVisitor } from '../visitors';
import { interactionPoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

type FactorMap = InfluenceConfig['factors'];

function mutedConfig(): InfluenceConfig {
  const factors = Object.fromEntries(
    Object.entries(INFLUENCE_CONFIG.factors).map(([id, factor]) => [id, {
      ...factor,
      children: factor.children.filter((child) => child.source !== 'satisfaction'),
    }]),
  ) as unknown as FactorMap;
  return {
    ...INFLUENCE_CONFIG,
    factors,
    cross: INFLUENCE_CONFIG.cross.filter((edge) => edge.from !== 'satisfaction'),
  };
}

function slotOpenConfig(): InfluenceConfig {
  const slot = INFLUENCE_CONFIG.contexts.slot!;
  return {
    ...INFLUENCE_CONFIG,
    contexts: {
      ...INFLUENCE_CONFIG.contexts,
      slot: { ...slot, weights: { ...slot.weights, mood: 0.3 } },
    },
  };
}

function run(kind: 'BAR' | 'SLOT', config: InfluenceConfig = INFLUENCE_CONFIG) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const bar = world.furniture.find((item) => item.kind === 'BAR')!;
  bar.stock = 2;
  const target = kind === 'BAR' ? bar : world.furniture.find((item) => item.kind === 'SLOT')!;
  const visitor = recordVisitor(world, { name: `Gast ${kind}`, persona: 'STAMMGAST', tick: 0 });
  const guest = makeGuest({
    id: 1, persona: 'STAMMGAST', prng: new Prng(randomSeed()), spawn: { x: 2, y: 13 },
  });
  guest.visitorId = visitor.id;
  guest.targetFurniture = target.id;
  guest.state = kind === 'BAR' ? 'DRINK' : 'PLAY';
  guest.mood = 50;
  guest.patience = 70;
  guest.thirst = 60;
  world.guests.push(guest);
  world.player.position = { ...interactionPoint(world, bar)! };
  takeDrink(world);
  world.player.position = { ...guest.position };
  serveDrink(world, ledger, guest.id, config);
  return {
    moodGain: guest.mood - 50,
    edge: relationshipBetween(world, actorRefOfVisitor(visitor.id), 'player'),
  };
}

describe('Döner-/Treat-Synergie', () => {
  it('erzeugt an der Bar einen positiven Erinnerungswert und am Slot exakt null', () => {
    const values: InfluenceValues = {
      mood: 50, sociability: 50, thirst: 60, rumor: 0, trust: 0, sympathy: 0, conflict: 0,
      satisfaction: 100,
    };
    expect(treatInfluence('bar', values)).toBeGreaterThan(0);
    expect(treatInfluence('slot', values)).toBe(0);
  });

  it('bucht an der Bar Laune und Beziehung, am Slot nur den Basis-Drink', () => {
    const bar = run('BAR');
    const slot = run('SLOT');
    expect(bar.moodGain).toBeGreaterThan(13);
    expect(slot.moodGain).toBe(13);
    expect(bar.edge?.trust ?? 0).toBeGreaterThan(0);
    expect(slot.edge).toBeNull();
  });

  it('nimmt den Unterschied ausschliesslich aus der Config', () => {
    const muted = run('BAR', mutedConfig());
    expect(muted.moodGain).toBe(13);
    expect(muted.edge).toBeNull();
    const slotOpen = run('SLOT', slotOpenConfig());
    expect(slotOpen.moodGain).toBeGreaterThan(13);
    expect(slotOpen.edge?.trust ?? 0).toBeGreaterThan(0);
  });
});
