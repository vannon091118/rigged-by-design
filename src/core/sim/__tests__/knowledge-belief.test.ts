/**
 * @test-target: src/core/sim/city-traits.ts
 * @error-code: ERR-2001
 *
 * Abnahme der Glaubwuerdigkeits-Mechanik:
 * - genau 30 Traits, seedfest und statsabhaengig vergeben,
 * - Entwicklung: Spielerinteraktion praegt doppelt so stark wie NPC-Kontakt,
 * - Boris glaubt Mira mechanisch nicht: Herkunft, Distanz, Laestermaul-
 *   Glaubwuerdigkeit, Misstrauen und Intelligenz ergeben ein begruendetes,
 *   geseedetes Urteil unter der Schwelle,
 * - dieselbe Lage liefert mit demselben Seed dasselbe Urteil,
 * - die Ablehnung und die Trait-Entwicklung ueberleben Save/Load.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_ENERGY_PER_DAY, cityOf, travel } from '../city';
import { meetNpc, takeEncounterAction } from '../city-encounter';
import { ensureCityVisitor, npcByName } from '../city-npcs';
import {
  assignTraits, developTrait, explainTraits, seedTraits, strongTraits, traitIntensityOf, TRAITS,
} from '../city-traits';
import { PORTEMONNAIE } from '../money';
import { explainExchange } from '../narrative/belief';
import { recordFirstHand, reportKnowledge } from '../narrative/knowledge';
import { seedStartPool } from '../narrative/state';
import type { KnowledgeExchange } from '../narrative/knowledge-types';
import type { ActorRef } from '../narrative/types';
import { createWorld, ensureStarter } from '../templates';

type World = ReturnType<typeof createWorld>;
const refOf = (id: number): ActorRef => `visitor:${id}`;

function cityWorld(): World {
  const world = createWorld('SMALL');
  ensureStarter(world);
  seedStartPool(world, fromVC(150));
  world.day = 1;
  world.tick = 5;
  return world;
}

function named(world: World): { rita: ReturnType<typeof ensureCityVisitor>; boris: ReturnType<typeof ensureCityVisitor>; mira: ReturnType<typeof ensureCityVisitor> } {
  return {
    rita: ensureCityVisitor(world, npcByName('Rita Kern')!),
    boris: ensureCityVisitor(world, npcByName('Boris Falk')!),
    mira: ensureCityVisitor(world, npcByName('Mira Sol')!),
  };
}

interface BeliefScenario {
  readonly world: World;
  readonly heard: ReturnType<typeof reportKnowledge>;
  readonly refused: ReturnType<typeof reportKnowledge>;
  readonly exchange: KnowledgeExchange;
  readonly miraId: number;
}

function beliefScenario(seed = randomSeed()): BeliefScenario {
  const world = cityWorld();
  const { rita, boris, mira } = named(world);
  const ritaRef = refOf(rita.id);
  const miraRef = refOf(mira.id);
  const borisRef = refOf(boris.id);
  recordFirstHand(world, { actor: ritaRef, factId: 1, sentiment: 0.9, tick: 5 });
  // Wie im Spiel: ableitbare Seeds, bis eine Fassung ankommt (Verlustrisiko je Stufe).
  let heard: ReturnType<typeof reportKnowledge> = null;
  for (let attempt = 0; attempt < 12 && !heard; attempt += 1) {
    heard = reportKnowledge(world, { from: ritaRef, to: miraRef, tick: 6, seed: seed + attempt });
  }
  const refused = reportKnowledge(world, { from: miraRef, to: borisRef, tick: 7, seed: seed + 101 });
  const exchange = world.narrative.exchanges.find((entry) => entry.from === miraRef && entry.to === borisRef);
  if (!exchange) throw new Error('Keine Austausch-Begruendung fuer Mira -> Boris.');
  return { world, heard, refused, exchange, miraId: mira.id };
}

describe('NPC-Traits und Glaubwuerdigkeit', () => {
  it('fuehrt genau 30 Eigenschaften und vergibt sie seedfest nach Stats', () => {
    expect(TRAITS).toHaveLength(30);
    expect(new Set(TRAITS.map((trait) => trait.id)).size).toBe(30);

    const highCha = { charisma: 10, intellect: 2 };
    const highInt = { charisma: 2, intellect: 10 };
    const seed = randomSeed();
    expect(assignTraits(new Prng(seed), highCha)).toEqual(assignTraits(new Prng(seed), highCha));

    const shareEffect = (stats: { charisma: number; intellect: number }): number => {
      let sum = 0;
      for (let seed = 1; seed <= 120; seed += 1) {
        for (const state of assignTraits(new Prng(seed), stats)) {
          sum += TRAITS.find((trait) => trait.id === state.id)?.effects.share ?? 0;
        }
      }
      return sum;
    };
    // Charisma zieht redselige Eigenschaften, hohe Intelligenz zieht den Gewinnfilter.
    expect(shareEffect(highCha)).toBeGreaterThan(shareEffect(highInt));
    const pickSeed = randomSeed();
    expect(assignTraits(new Prng(pickSeed), highCha, { count: 3 })
      .every((state) => TRAITS.some((trait) => trait.id === state.id))).toBe(true);
  });

  it('entwickelt Eigenschaften: Spielerinteraktion doppelt, stark ab fuenf Punkten', () => {
    const base = seedTraits(['HILFSBEREIT'], { charisma: 8, intellect: 4 });
    expect(traitIntensityOf(base, 'HILFSBEREIT')).toBe(2);

    const twoNpc = developTrait(developTrait(base, 'HILFSBEREIT', 'NPC'), 'HILFSBEREIT', 'NPC');
    const twoPlayer = developTrait(developTrait(base, 'HILFSBEREIT', 'PLAYER'), 'HILFSBEREIT', 'PLAYER');
    expect(twoNpc.find((state) => state.id === 'HILFSBEREIT')?.progress)
      .toBeLessThan(twoPlayer.find((state) => state.id === 'HILFSBEREIT')!.progress);
    expect(traitIntensityOf(twoNpc, 'HILFSBEREIT')).toBe(2);
    expect(traitIntensityOf(twoPlayer, 'HILFSBEREIT')).toBe(3);
    expect(strongTraits(twoPlayer).map((state) => state.id)).toEqual(['HILFSBEREIT']);
    expect(explainTraits(twoPlayer)).toContain('Hilfsbereit 3');
  });

  it('erklaert mechanisch, warum Boris Mira nicht glaubt', () => {
    const scenarioSeed = randomSeed();
    const first = beliefScenario(scenarioSeed);
    expect(first.heard).not.toBeNull();
    expect(first.refused).toBeNull();
    expect(first.exchange.shared).toBe(true);
    expect(first.exchange.accepted).toBe(false);
    expect(first.exchange.score).toBeLessThan(first.exchange.threshold);

    const codes = first.exchange.reasons.map((reason) => reason.code);
    // Kein Faktor zaehlt doppelt: jeder Kode kommt genau einmal vor.
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('KONFIDENZ_HERKUNFT');
    expect(codes).toContain('TRAIT_MISSTRAUEN');
    expect(codes).toContain('INT_PRUEFUNG');
    expect(codes).toContain('TRAIT_GLAUBWUERDIGKEIT');
    expect(explainExchange(first.world, first.exchange)).toContain('Boris Falk glaubt nicht Mira Sol');

    // Gegenprobe: Mira glaubt Rita; nur die zweite Stufe scheitert.
    expect(first.world.narrative.knowledge.some((entry) => entry.actor === refOf(first.miraId))).toBe(true);

    // Kausal und reproduzierbar: gleiche Lage, gleicher Seed, gleiches Urteil.
    const second = beliefScenario(scenarioSeed);
    expect(second.exchange).toEqual(first.exchange);
  });

  it('entwickelt den NPC durch die Spieleraktion und haelt Urteil plus Traits im Save', () => {
    const world = cityWorld();
    travel(world, 'KIEZ');
    const ledger = new Ledger({ [PORTEMONNAIE]: fromVC(20) });
    const met = meetNpc(world, 'KIEZ');
    const before = JSON.stringify(met.visitor.traits);
    const result = takeEncounterAction(world, ledger, met.event.id, 'GEBEN');

    expect(JSON.stringify(met.visitor.traits)).not.toBe(before);
    expect(result.relay).toBeNull();
    expect(result.text).toContain('glaubt nicht');
    const refusals = world.narrative.exchanges.filter((entry) => entry.accepted === false);
    expect(refusals).toHaveLength(1);
    expect(explainExchange(world, refusals[0]!)).toContain('glaubt nicht');

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, 1))))!;
    expect(loaded.world.visitors.find((visitor) => visitor.id === met.visitor.id)?.traits)
      .toEqual(met.visitor.traits);
    expect(loaded.world.narrative.exchanges.some((entry) => entry.accepted === false)).toBe(true);
    expect(cityOf(loaded.world).energy).toBe(CITY_ENERGY_PER_DAY - 1);
  });
});
