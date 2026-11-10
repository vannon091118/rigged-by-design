/**
 * @test-target: src/core/sim/amenity-reaction.ts
 * @error-code: ERR-2001
 *
 * Agent 15: Die Bedingung des Geraets, an dem ein Gast gespielt hat, verschiebt
 * die gerichtete Kante Besucher -> Haus. Deterministisch, ueber denselben
 * `shift()`-Writer wie die uebrigen Kantenquellen; Gaeste ohne Profil bleiben
 * ohne Kante.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { amenityGradeOf, applyAmenityReaction, WORN_BELOW } from '../amenity-reaction';
import { actAtTarget } from '../guest-play';
import { guestAccount } from '../money';
import { actorRefOfVisitor, relationshipBetween } from '../narrative/relationships';
import { createWorld } from '../templates';
import type { Furniture, Guest, WorldState } from '../types';
import { recordVisitor } from '../visitors';

const machine = (condition: number, damaged = false): Furniture => ({
  id: 7, kind: 'SLOT', gameId: 'SLOT', x: 2, y: 2, w: 1, h: 1, seats: 1, label: 'Automat',
  price: ZERO_VC, quality: 1, condition, damaged, dirt: 0, stock: 0, clog: 0, clogged: false,
  zoneId: 'A', occupants: [], mods: [], reels: 3, baseBet: ZERO_VC,
});

const playingGuest = (visitorId: number | undefined): Guest => ({
  id: 1, name: 'Toni Test', persona: 'STAMMGAST', mood: 60, patience: 70, addiction: 0,
  sociability: 50, thirst: 20, bladder: 20, disputeId: null, state: 'PLAY', stateTicks: 0,
  position: { x: 1, y: 1 }, path: [], pathIndex: 0, targetFurniture: 0, targetZone: 'A',
  queueIndex: 0, need: 'play', anger: 0, dirtTimer: 0, lastResult: '', spins: 0, visitorId,
});

const edgeOf = (world: WorldState, visitorId: number) =>
  relationshipBetween(world, actorRefOfVisitor(visitorId), 'player');

describe('Ausstattungsreaktion (Agent 15)', () => {
  it('bestaetigt gepflegte Ausstattung als kleine Zuwendung', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Rita Pflege', persona: 'STAMMGAST', tick: 0 });
    expect(applyAmenityReaction(world, playingGuest(visitor.id), machine(90))).toBe('KEPT');
    expect(edgeOf(world, visitor.id)?.trust).toBe(1);
    expect(edgeOf(world, visitor.id)?.sympathy).toBe(1);
    expect(edgeOf(world, visitor.id)?.conflict).toBe(0);
  });

  it('senkt bei abgenutzter Ausstattung die Sympathie, ohne das Vertrauen anzutasten', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Boris Abnutzung', persona: 'BUSINESS', tick: 0 });
    expect(applyAmenityReaction(world, playingGuest(visitor.id), machine(WORN_BELOW - 5))).toBe('WORN');
    expect(edgeOf(world, visitor.id)?.trust).toBe(0);
    expect(edgeOf(world, visitor.id)?.sympathy).toBe(-1);
  });

  it('erzeugt bei kaputter Ausstattung Konflikt und Vertrauensverlust', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Mira Defekt', persona: 'STREET', tick: 0 });
    expect(applyAmenityReaction(world, playingGuest(visitor.id), machine(90, true))).toBe('BROKEN');
    const edge = edgeOf(world, visitor.id);
    expect(edge?.trust).toBe(-1);
    expect(edge?.sympathy).toBe(-2);
    expect(edge?.conflict).toBe(1);
  });

  it('summiert wiederholte Erlebnisse auf derselben Kante', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Kai Zweimal', persona: 'STAMMGAST', tick: 0 });
    applyAmenityReaction(world, playingGuest(visitor.id), machine(90, true));
    applyAmenityReaction(world, playingGuest(visitor.id), machine(90, true));
    const edge = edgeOf(world, visitor.id);
    expect(edge?.trust).toBe(-2);
    expect(edge?.sympathy).toBe(-4);
    expect(edge?.conflict).toBe(2);
  });

  it('laesst Gaeste ohne Profil und unbekannte Visitor-IDs ohne Kante', () => {
    const world = createWorld('SMALL');
    expect(applyAmenityReaction(world, playingGuest(undefined), machine(10, true))).toBeNull();
    expect(applyAmenityReaction(world, playingGuest(99), machine(10, true))).toBeNull();
    expect(world.narrative.relationships).toEqual([]);
  });

  it('leitet die Stufe deterministisch aus Zustand und Schaden ab', () => {
    expect(amenityGradeOf({ condition: WORN_BELOW, damaged: false })).toBe('KEPT');
    expect(amenityGradeOf({ condition: WORN_BELOW - 0.1, damaged: false })).toBe('WORN');
    expect(amenityGradeOf({ condition: 100, damaged: true })).toBe('BROKEN');
  });

  it('reagiert am echten Sitzungsende eines Spiels, nicht nur im Direktaufruf', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const visitor = recordVisitor(world, { name: 'Rita Automat', persona: 'STAMMGAST', tick: 0 });
    const slot = world.furniture.find((entry) => entry.kind === 'SLOT' && entry.gameId === 'SLOT')!;
    slot.condition = WORN_BELOW - 5;
    const guest = playingGuest(visitor.id);
    guest.targetFurniture = slot.id;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(500), 'start', 0);
    const prng = new Prng(randomSeed());
    for (let step = 0; step < 20 && guest.state === 'PLAY'; step += 1) actAtTarget(world, ledger, prng, guest, slot);
    expect(guest.state).not.toBe('PLAY');
    expect(edgeOf(world, visitor.id)?.sympathy).toBe(-1);
    expect(edgeOf(world, visitor.id)?.trust).toBe(0);
  });
});
