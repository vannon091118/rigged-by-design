/**
 * @test-target: src/core/sim/city-life-override.ts
 * @error-code: ERR-2001
 *
 * Die zwei Grenzen des Stadtleben-Scores: Eine Handlung ist nur möglich, wenn
 * ihr Gebäude geöffnet hat und der Bewohner in seiner Schicht ist, und ein
 * dringendes körperliches Bedürfnis verbietet Arbeit, Einkauf, Freizeit und
 * Besuche. Beides muss als Faktor sichtbar sein, sonst kann keine
 * Gegenfakt-Probe es neutralisieren.
 */
import { describe, expect, it } from 'vitest';
import { isClosedAt, urgentNeedVeto, vetoesIntent } from '../city-life-override';
import { CITY_SLOTS, inShift, slotOf, venueOpenAt, workAllowedAt } from '../city-life-venues';
import { createDefaultNeeds } from '../npc-needs';

const needs = (patch: Partial<ReturnType<typeof createDefaultNeeds>>) => ({
  ...createDefaultNeeds(), ...patch,
});
const rita = { npcId: 'rita', workplace: 'KIEZ' as const };
const boris = { npcId: 'boris', workplace: 'MARKT' as const };
const guest = { npcId: 'fremder', workplace: 'KIEZ' as const };

describe('Stadtleben-Grenzen', () => {
  it('liest Öffnungszeiten und Schichten aus der Stadt, nicht aus einer Tabelle', () => {
    // Kneipe: 16 bis 4 Uhr. Morgens zu, nachmittags und nachts offen.
    expect(venueOpenAt('KIEZ', 8)).toBe(false);
    expect(venueOpenAt('KIEZ', 19)).toBe(true);
    expect(venueOpenAt('KIEZ', 2)).toBe(true);
    // Spaeti: 6 bis 24.
    expect(venueOpenAt('MARKT', 3)).toBe(false);
    expect(venueOpenAt('MARKT', 8)).toBe(true);
    // Wohnung ist kein Gewerbe.
    expect(venueOpenAt('HOME', 3)).toBe(true);

    // Schicht der Wirtin: 16 bis 24, auch wenn die Kneipe bis 4 offen ist.
    expect(slotOf('rita')?.from).toBe(16);
    expect(workAllowedAt('rita', 19)).toBe(true);
    expect(workAllowedAt('rita', 2)).toBe(false);
    expect(workAllowedAt('rita', 15)).toBe(false);
    // Ohne Slot keine Arbeit.
    expect(slotOf('fremder')).toBeNull();
    expect(workAllowedAt('fremder', 12)).toBe(false);
    // Jeder Slot liegt in der Öffnungszeit seines Gebäudes.
    for (const slot of CITY_SLOTS) expect(inShift(slot, slot.from)).toBe(true);
  });

  it('schliesst Arbeit nachts und die Kneipe am Morgen', () => {
    for (const hour of [0, 3, 6, 22]) expect(isClosedAt('WORK', hour, boris)).toBe(true);
    expect(isClosedAt('WORK', 9, boris)).toBe(false);
    expect(isClosedAt('WORK', 21, boris)).toBe(true);
    expect(isClosedAt('WORK', 3, rita)).toBe(true);
    expect(isClosedAt('WORK', 19, rita)).toBe(false);
    expect(isClosedAt('WORK', 12, guest)).toBe(true);
    for (const hour of [6, 8, 12, 15]) expect(isClosedAt('PUB', hour, rita)).toBe(true);
    expect(isClosedAt('PUB', 19, rita)).toBe(false);
    // Essen auswärts braucht ein offenes Lokal: Die Kneipe hat bis 4 offen,
    // der Spaeti ab 6 — um 5 ist beides zu.
    expect(isClosedAt('EAT_OUT', 3, rita)).toBe(false);
    expect(isClosedAt('EAT_OUT', 5, rita)).toBe(true);
    expect(isClosedAt('EAT_OUT', 12, rita)).toBe(false);
    // Schlafen, Essen zu Hause und der Weg sind keine Gewerbe.
    for (const hour of [0, 4, 12, 23]) {
      expect(isClosedAt('SLEEP', hour, rita)).toBe(false);
      expect(isClosedAt('EAT_HOME', hour, rita)).toBe(false);
      expect(isClosedAt('COMMUTE', hour, rita)).toBe(false);
    }
  });

  it('verbietet bei dringendem Beduerfnis nur die ablenkenden Handlungen', () => {
    const tired = urgentNeedVeto(needs({ fatigue: 95 }));
    expect(tired).toEqual({ intent: 'SLEEP', family: 'fatigue' });
    expect(vetoesIntent(tired, 'WORK')).toBe(true);
    expect(vetoesIntent(tired, 'VISIT_FRIEND')).toBe(true);
    expect(vetoesIntent(tired, 'SLEEP')).toBe(false);
    expect(vetoesIntent(tired, 'EAT_HOME')).toBe(false);

    const hungry = urgentNeedVeto(needs({ hunger: 92, fatigue: 10 }));
    expect(hungry?.family).toBe('hunger');
    const thirsty = urgentNeedVeto(needs({ thirst: 92, fatigue: 10, hunger: 10 }));
    expect(thirsty).toEqual({ intent: 'PUB', family: 'thirst' });
    // Sozialbedarf ist eine Bewertung, kein Veto.
    expect(urgentNeedVeto(needs({ social: 95 }))).toBeNull();
    expect(vetoesIntent(null, 'WORK')).toBe(false);
    // Muedigkeit hat Vorrang, wenn beide dringend sind.
    expect(urgentNeedVeto(needs({ fatigue: 95, hunger: 95 }))?.family).toBe('fatigue');
  });
});
