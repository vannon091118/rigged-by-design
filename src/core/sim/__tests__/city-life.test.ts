/**
 * @test-target: src/core/sim/city-life.ts
 * @error-code: ERR-2001
 *
 * Die benannten Stadt-NPCs muessen im echten `tickWorld` leben: Standort und
 * Intent folgen der Tagesroutine, Hunger/Durst/Muedigkeit veraendern sich und
 * ein dringendes Beduerfnis ueberstimmt den Plan. Der Save-Roundtrip beweist,
 * dass dieser Zustand kein UI-Cache ist.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_NPCS, ensureCityVisitor } from '../city-npcs';
import { cityLifeView,
  ensureCityLife,
  tickCityLife,
} from '../city-life';
import { chooseCityIntent, type CityDecisionInput } from '../city-life-score';
import type { NpcIntentKind, NpcNeeds } from '../npc-types';
import type { CityResidentState } from '../city-life-types';
import type { CityLifeState } from '../city-life-types';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';

function start(): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const rita = CITY_NPCS.find((entry) => entry.id === 'rita')!;
  ensureCityVisitor(world, rita);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
}

function resident(life: CityLifeState, id: string) {
  return life.residents.find((entry) => entry.npcId === id)!;
}

describe('Stadtleben (Ereignisketten)', () => {
  it('laesst Rita, Boris und Mira ueber einen vollen Tag Routine und Beduerfnisse wechseln', () => {
    const { world, ledger, prng } = start();
    const initial = ensureCityLife(world);
    const before = resident(initial, 'rita');

    const samples = new Map<number, CityLifeState>();
    for (let i = 0; i < 600; i += 1) {
      tickWorld(world, ledger, prng);
      if (world.tick === 225 || world.tick === 475 || world.tick === 575 || world.tick === 600) {
        samples.set(world.tick, world.cityLife);
      }
    }

    // Jeder arbeitet in seiner Schicht: Boris 7-20, Mira 9-17, Rita 16-24.
    const borisWork = resident(samples.get(225)!, 'boris');
    expect(borisWork.intent).toBe('WORK');
    expect(borisWork.location).toBe('MARKT');
    expect(borisWork.needs.hunger).not.toBe(before.needs.hunger);

    // Ritas Schicht beginnt um 16:00; um 19:00 steht der Plan auf Arbeit,
    // auch wenn der Score im Einzelfall anders entscheidet.
    const ritaWork = resident(samples.get(475)!, 'rita');
    expect(['KIEZ', 'MARKT']).toContain(ritaWork.location);
    const ritaDecision = (samples.get(475)!.lastDecisions ?? []).find((entry) => entry.npcId === 'rita');
    expect(ritaDecision?.hour).toBe(19);
    expect(ritaDecision?.scheduledIntent).toBe('WORK');

    // Mira hat um 19:00 Schichtende und ist auf dem Weg in die Kneipe; der Ort
    // wechselt erst bei Ankunft, nicht mit dem Entschluss.
    const miraPub = resident(samples.get(475)!, 'mira');
    expect(miraPub.intent).toBe('PUB');
    expect(miraPub.travel?.to ?? miraPub.location).toBe('KIEZ');

    const borisSleep = resident(samples.get(575)!, 'boris');
    expect(borisSleep.intent).toBe('SLEEP');
    expect(borisSleep.travel?.to ?? borisSleep.location).toBe('HOME');

    const nextDay = resident(samples.get(600)!, 'boris');
    expect(nextDay.intent).toBe('SLEEP');
    expect(nextDay.travel?.to ?? nextDay.location).toBe('HOME');
    expect(nextDay.lastDay).toBe(2);

    for (const sample of samples.values()) {
      for (const person of sample.residents) {
        for (const stat of [person.needs.hunger, person.needs.thirst, person.needs.fatigue, person.needs.social, person.needs.mood]) {
          expect(stat).toBeGreaterThanOrEqual(0);
          expect(stat).toBeLessThanOrEqual(100);
        }
      }
    }

    const view = cityLifeView(world);
    expect(view).toHaveLength(3);
    expect(view.find((entry) => entry.npcId === 'rita')?.traits.length).toBeGreaterThan(0);
    const ritaView = view.find((entry) => entry.npcId === 'rita')!;
    const labels = { HOME: 'Wohnung', KIEZ: 'Kiez', MARKT: 'Markt', CASINO: 'Casino' } as const;
    expect(ritaView.locationLabel).toBe(labels[ritaView.location]);
  });

  it('ueberstimmt den Tagesplan bei dringendem Durst und bewahrt den Zustand ueber Save/Load', () => {
    const { world, ledger, prng } = start();
    // 19:00: Die Kneipe hat offen, der Durst darf den Plan ueberstimmen.
    world.tick = 475;
    world.day = 1;
    const life = ensureCityLife(world);
    world.cityLife = {
      residents: life.residents.map((person) => person.npcId === 'rita'
        ? { ...person, lastHour: 18, lastDay: 1, needs: { ...person.needs, hunger: 20, thirst: 95, fatigue: 10, social: 30 } }
        : person),
    };
    tickCityLife(world);
    expect(resident(world.cityLife, 'rita').intent).toBe('PUB');
    // Der Entschluss startet den Weg; der Ort folgt der Ankunft.
    expect(resident(world.cityLife, 'rita').travel?.to ?? resident(world.cityLife, 'rita').location).toBe('KIEZ');

    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    const after = resident(loaded.world.cityLife, 'rita');
    expect(after.intent).toBe('PUB');
    expect(after.needs.thirst).toBe(75);
    expect(after.lastHour).toBe(19);
    expect(loaded.world.day).toBe(1);
  });

  it('schickt nachts niemanden zur Arbeit und oeffnet die Kneipe nicht zum Fruehstueck', () => {
    const decide = (hour: number, scheduled: NpcIntentKind, needs: Partial<NpcNeeds>, work = 100): NpcIntentKind => {
      const resident: CityResidentState = {
        npcId: 'rita', visitorId: null, name: 'Rita Kern', role: 'Wirtin', location: 'HOME', intent: scheduled,
        position: { x: 8, y: 12 }, travel: null,
        needs: {
          hunger: 10, thirst: 10, fatigue: 10, social: 10, money: 9000, mood: 80, ...needs,
        },
        attributes: { charisma: 8, intellect: 4 },
        skills: { cooking: 10, work, social: 10 },
        relationships: {}, memories: [], lastHour: hour, lastDay: 1,
      };
      const input: CityDecisionInput = {
        resident, scheduled, workplace: 'KIEZ', hour, day: 1, tick: hour * 25,
        peers: [], traits: [], seed: 424242,
      };
      return chooseCityIntent(input).intent;
    };
    // Selbst mit maximaler Arbeitsfaehigkeit (Skill 100) gewinnt um 03:00 der Schlaf.
    expect(decide(3, 'SLEEP', { fatigue: 70 })).toBe('SLEEP');
    // Sozialbedarf 90 ruft nach der Kneipe, doch um 08:00 ist sie zu: der Weg gewinnt.
    expect(decide(8, 'COMMUTE', { social: 90 }, 10)).toBe('COMMUTE');
    // Nasser Hunger nachts bei vollem Geldbeutel endet an der eigenen Kochnische.
    expect(decide(2, 'SLEEP', { hunger: 95, fatigue: 10 }, 10)).toBe('EAT_HOME');
  });
});
