/**
 * @test-target: src/core/sim/narrative/disposition.ts | @error-code: ERR-2001
 *
 * E2: Zwei Besucher gleicher Persona, einer mit GOOD-Erinnerung und Sympathie,
 * einer mit BAD-Erinnerung und Konflikt; gleiche Welt, gleicher Seed. Die eine
 * Ableitung `visitorDisposition()` muss messbar verschiedene Gewichte liefern,
 * zu tatsaechlich verschiedener Aktivitaetswahl fuehren und den Unterschied
 * ueber einen Save-Roundtrip erhalten. Harte Regeln (Veto, Geld, Platz) bleiben
 * unberuehrt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { chooseActivity } from '../guest-choice';
import { guestAccount } from '../money';
import {
  NEUTRAL_DISPOSITION, dispositionOfGuest, visitorDisposition,
} from '../narrative/disposition';
import { shift } from '../narrative/relationships';
import { offerScore } from '../offers';
import { createWorld } from '../templates';
import { makeGuest } from '../traits';
import type { Guest, WorldState } from '../types';
import { recordVisitor, returnChance } from '../visitors';

const SEED = 20261104;
const GOOD_MOOD = 45;
const HIGH_MOOD = 55;

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const good = recordVisitor(world, { name: 'Gute Grete', persona: 'STAMMGAST', tick: 0 });
  const bad = recordVisitor(world, { name: 'Böser Bernd', persona: 'STAMMGAST', tick: 0 });
  good.memories = [{ factId: 1, tick: 0, score: 90, valence: 'GOOD' }];
  bad.memories = [{ factId: 2, tick: 0, score: 10, valence: 'BAD' }];
  shift(world, `visitor:${good.id}`, 'player', { sympathy: 6 }, 0);
  shift(world, `visitor:${bad.id}`, 'player', { conflict: 6 }, 0);
  const bar = world.furniture.find((item) => item.kind === 'BAR')!;
  bar.stock = 4;
  const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
  const sofa = world.furniture.find((item) => item.kind === 'DECOR' && item.seats > 0)!;
  return { world, ledger, good, bad, bar, slot, sofa };
}

function guestFor(world: WorldState, ledger: Ledger, id: number, visitorId: number, mood: number, sociability: number): Guest {
  const guest = makeGuest({ id, persona: 'STAMMGAST', prng: new Prng(SEED), spawn: { x: 2, y: 13 } });
  guest.visitorId = visitorId;
  guest.mood = mood;
  guest.patience = 80;
  guest.sociability = sociability;
  guest.addiction = 10;
  guest.thirst = 10;
  guest.bladder = 5;
  guest.need = 'play';
  ledger.transfer('EXTERNAL_WORLD', guestAccount(id), fromVC(5), 'test chips', 0);
  return guest;
}

describe('Besucherdisposition (E2)', () => {
  it('leitet aus Persona, Erinnerung und Kante begrenzte Modifikatoren ab', () => {
    const { world, good, bad } = setup();
    const rels = world.narrative.relationships;
    const high = visitorDisposition(good, rels);
    const low = visitorDisposition(bad, rels);
    expect(high.gameBias).toBeGreaterThan(low.gameBias);
    expect(high.serviceBias).toBeGreaterThan(low.serviceBias);
    expect(high.socialBias).toBeGreaterThan(low.socialBias);
    expect(high.returnBias).toBeGreaterThan(low.returnBias);
    for (const disp of [high, low]) {
      expect(disp.gameBias).toBeGreaterThanOrEqual(-0.2);
      expect(disp.gameBias).toBeLessThanOrEqual(0.2);
      for (const shiftValue of [disp.serviceBias, disp.socialBias]) {
        expect(Number.isInteger(shiftValue)).toBe(true);
        expect(Math.abs(shiftValue)).toBeLessThanOrEqual(8);
      }
      expect(Number.isInteger(disp.returnBias)).toBe(true);
      expect(Math.abs(disp.returnBias)).toBeLessThanOrEqual(10);
    }
    // Volle Kanne zugewandt gegen voll abgewandt: maximale Ausschlaege, gedeckelt.
    expect(high.serviceBias).toBe(8);
    expect(low.serviceBias).toBe(-4);
    expect(dispositionOfGuest(world, { visitorId: undefined } as Guest)).toBe(NEUTRAL_DISPOSITION);
  });

  it('gewichtet die Spielwahl messbar verschieden, ohne das Veto anzutasten', () => {
    const { world, ledger, good, bad, slot } = setup();
    const wallet = fromVC(5);
    const high = guestFor(world, ledger, 1, good.id, GOOD_MOOD, 60);
    const low = guestFor(world, ledger, 2, bad.id, GOOD_MOOD, 60);
    const neutral = guestFor(world, ledger, 3, 9999, GOOD_MOOD, 60);
    const scoreHigh = offerScore(world, high, slot, wallet);
    const scoreLow = offerScore(world, low, slot, wallet);
    const scoreNeutral = offerScore(world, neutral, slot, wallet);
    expect(scoreHigh).toBeGreaterThan(scoreNeutral);
    expect(scoreNeutral).toBeGreaterThan(scoreLow);
    expect(scoreHigh).toBeLessThanOrEqual(Math.round(scoreNeutral * 1.2) + 1);
    expect(scoreLow).toBeGreaterThanOrEqual(Math.round(scoreNeutral * 0.8) - 1);
    // Harte Regel: kaputtes Geraet bleibt Veto, Disposition hin oder her.
    const broken = { ...slot, damaged: true };
    expect(offerScore(world, high, broken, wallet)).toBe(0);
    expect(offerScore(world, low, broken, wallet)).toBe(0);
  });

  it('waehlt bei gleichem Seed tatsaechlich verschiedene Aktivitaeten', () => {
    const drink = setup();
    const highDrink = guestFor(drink.world, drink.ledger, 1, drink.good.id, GOOD_MOOD, 60);
    const lowDrink = guestFor(drink.world, drink.ledger, 2, drink.bad.id, GOOD_MOOD, 60);
    chooseActivity(drink.world, highDrink, drink.ledger, new Prng(SEED));
    chooseActivity(drink.world, lowDrink, drink.ledger, new Prng(SEED));
    expect(highDrink.state).toBe('DRINK');
    expect(highDrink.targetFurniture).toBe(drink.bar.id);
    expect(lowDrink.state).not.toBe('DRINK');

    const sofa = setup();
    const highSofa = guestFor(sofa.world, sofa.ledger, 1, sofa.good.id, HIGH_MOOD, 65);
    const lowSofa = guestFor(sofa.world, sofa.ledger, 2, sofa.bad.id, HIGH_MOOD, 65);
    chooseActivity(sofa.world, highSofa, sofa.ledger, new Prng(SEED));
    chooseActivity(sofa.world, lowSofa, sofa.ledger, new Prng(SEED));
    expect(highSofa.targetFurniture).toBe(sofa.sofa.id);
    expect(lowSofa.targetFurniture).not.toBe(sofa.sofa.id);
  });

  it('verschiebt die Rueckkehr um den Beziehungszuschlag, geklemmt und gedeckelt', () => {
    const { world, good, bad } = setup();
    const rels = world.narrative.relationships;
    const high = returnChance(good, rels);
    const low = returnChance(bad, rels);
    expect(high).toBeGreaterThan(low);
    // 25 Basis + 8 Erinnerung + 6 Kante gegen 25 - 12 - 6.
    expect(high).toBe(39);
    expect(low).toBe(7);
    expect(high).toBeLessThanOrEqual(2 * 25 + 12);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it('erhaelt den Unterschied ueber einen Save-Roundtrip', () => {
    const { world, ledger, good, bad, slot } = setup();
    const wallet = fromVC(5);
    const before = [
      visitorDisposition(good, world.narrative.relationships),
      visitorDisposition(bad, world.narrative.relationships),
    ];
    const restored = structuredClone(world);
    const again = [
      visitorDisposition(
        restored.visitors.find((entry) => entry.id === good.id)!,
        restored.narrative.relationships,
      ),
      visitorDisposition(
        restored.visitors.find((entry) => entry.id === bad.id)!,
        restored.narrative.relationships,
      ),
    ];
    expect(again).toEqual(before);
    const high = guestFor(restored, ledger, 1, good.id, GOOD_MOOD, 60);
    const low = guestFor(restored, ledger, 2, bad.id, GOOD_MOOD, 60);
    const slotAgain = restored.furniture.find((item) => item.gameId === 'SLOT')!;
    expect(offerScore(restored, high, slotAgain, wallet))
      .toBe(offerScore(world, guestFor(world, ledger, 1, good.id, GOOD_MOOD, 60), slot, wallet));
    expect(offerScore(restored, high, slotAgain, wallet))
      .toBeGreaterThan(offerScore(restored, low, slotAgain, wallet));
  });
});
