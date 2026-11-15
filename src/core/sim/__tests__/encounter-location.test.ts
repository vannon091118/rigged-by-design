/**
 * @test-target: src/core/sim/social-encounter.ts
 * @error-code: ERR-2001
 *
 * Eine Stadtbegegnung ist ein Treffen am selben Ort in physischer Reichweite,
 * nicht ein Kontakt zwischen zwei beliebigen Bewohnern mit demselben Orts-Tag.
 * Die Tests belegen die gemeinsame Auswahlregel und ihren Einsatz im echten
 * Ankunftspfad von `tickCityMovement`.
 */
import { describe, expect, it } from 'vitest';
import { createCityLifeState } from '../city-life-create';
import { placeEntrance, tickCityMovement } from '../city-life-movement';
import { ensureCityLife } from '../city-life-state';
import {
  selectSocialEncounter,
  SOCIAL_ENCOUNTER_CAPACITY,
  SOCIAL_INTERACTION_RADIUS,
} from '../social-encounter';
import { createWorld, ensureStarter } from '../templates';

const point = (x: number, y: number): { x: number; y: number } => ({ x, y });

const initiator = { npcId: 'a', place: 'KIEZ', position: point(0, 0) };
const near = { npcId: 'b', place: 'KIEZ', position: point(1, 1) };
const far = { npcId: 'c', place: 'KIEZ', position: point(10, 10) };
const elsewhere = { npcId: 'd', place: 'MARKT', position: point(0, 1) };

function movementWorld(
  peerPlace: 'KIEZ' | 'MARKT' = 'KIEZ',
  peerPosition = placeEntrance('KIEZ')!,
) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const life = createCityLifeState(7, 3);
  const [rita, boris] = life.residents;
  const home = placeEntrance('HOME')!;
  const entrance = placeEntrance('KIEZ')!;
  const traveler = {
    ...rita!,
    location: 'HOME' as const,
    position: home,
    intent: 'PUB' as const,
    relationships: {},
    memories: [],
    travel: { to: 'KIEZ' as const, path: [home, entrance], index: 0 },
  };
  const peer = {
    ...boris!,
    location: peerPlace,
    position: peerPosition,
    travel: null,
  };
  world.cityLife = { ...life, residents: [traveler, peer] };
  return { world, traveler, peer };
}

describe('Stadtbegegnung: Ort, Naehe und Kapazitaet', () => {
  it('waehlt nur die naechste Person am selben Ort', () => {
    expect(SOCIAL_INTERACTION_RADIUS).toBe(2.5);
    const selected = selectSocialEncounter(initiator, [far, elsewhere, near]);

    expect(selected?.partnerId).toBe('b');
    expect(selected?.participantIds).toEqual(['a', 'b']);
    expect(selected?.distance).toBeCloseTo(Math.SQRT2);
  });

  it('begrenzt die gleichzeitige Gruppe auf die feste Kapazitaet', () => {
    const crowded = [
      { npcId: 'b', place: 'KIEZ', position: point(1, 0) },
      { npcId: 'c', place: 'KIEZ', position: point(0, 1) },
      { npcId: 'd', place: 'KIEZ', position: point(-1, 0) },
      { npcId: 'e', place: 'KIEZ', position: point(0, -1) },
    ];
    const selected = selectSocialEncounter(initiator, crowded);

    expect(SOCIAL_ENCOUNTER_CAPACITY).toBe(3);
    expect(selected?.partnerId).toBe('b');
    expect(selected?.participantIds).toEqual(['a', 'b', 'c']);
    expect(selected?.participantIds).not.toContain('d');
    expect(selected?.participantIds).not.toContain('e');
  });

  it('verweigert Kontakt ohne nahe Person am selben Ort', () => {
    expect(selectSocialEncounter(initiator, [far])).toBeNull();
    expect(selectSocialEncounter(initiator, [elsewhere])).toBeNull();
  });

  it('bucht den Kontakt bei der Ankunft nur fuer eine nahe Person am selben Ort', () => {
    const { world, traveler, peer } = movementWorld();
    tickCityMovement(world);

    const arrived = ensureCityLife(world).residents.find((entry) => entry.npcId === traveler.npcId)!;
    expect(arrived.location).toBe('KIEZ');
    expect(arrived.relationships[peer.npcId]).toBe(4);
    expect(arrived.memories).toHaveLength(1);
    expect(arrived.memories[0]?.kind).toBe('SOCIAL');
    expect(arrived.memories[0]?.aboutNpcId).toBe(peer.npcId);
  });

  it('bucht keinen Kontakt fuer einen fernen Bewohner am selben Ort', () => {
    const { world, traveler, peer } = movementWorld('KIEZ', point(999, 999));
    tickCityMovement(world);

    const arrived = ensureCityLife(world).residents.find((entry) => entry.npcId === traveler.npcId)!;
    expect(arrived.relationships[peer.npcId] ?? 0).toBe(0);
    expect(arrived.memories).toHaveLength(0);
  });

  it('beendet die Begegnung beim Ortswechsel und bucht nichts nach', () => {
    const { world, traveler, peer } = movementWorld();
    tickCityMovement(world);
    const before = ensureCityLife(world).residents.find((entry) => entry.npcId === traveler.npcId)!;
    expect(before.relationships[peer.npcId]).toBe(4);
    expect(before.memories).toHaveLength(1);

    // Ortswechsel: derselbe Bewohner reist weiter, der Partner bleibt am alten Ort.
    const markt = placeEntrance('MARKT')!;
    world.cityLife = {
      ...ensureCityLife(world),
      residents: [
        { ...before, location: 'KIEZ' as const, travel: { to: 'MARKT' as const, path: [before.position, markt], index: 0 } },
        peer,
      ],
    };
    tickCityMovement(world);

    const after = ensureCityLife(world).residents.find((entry) => entry.npcId === traveler.npcId)!;
    expect(after.location).toBe('MARKT');
    // Die Begegnung am alten Ort wird nicht fortgeschrieben: kein zweites Delta, keine zweite Erinnerung.
    expect(after.relationships[peer.npcId]).toBe(4);
    expect(after.memories).toHaveLength(1);
  });

  it('bucht keinen Kontakt bei gleicher Kachel, aber anderem Ort', () => {
    const entrance = placeEntrance('KIEZ')!;
    const { world, traveler, peer } = movementWorld('MARKT', entrance);
    tickCityMovement(world);

    const arrived = ensureCityLife(world).residents.find((entry) => entry.npcId === traveler.npcId)!;
    expect(arrived.relationships[peer.npcId] ?? 0).toBe(0);
    expect(arrived.memories).toHaveLength(0);
  });
});
