/**
 * @test-target: src/core/sim/city-encounter.ts
 * @error-code: ERR-2001
 *
 * Headless-Abnahme des zentralen Begegnungs-Loops:
 * Stadtaktion -> benannter NPC mit Erinnerung -> soziale Handlung (Geld,
 * Energie, Beziehung) -> Wissensweitergabe an einen zweiten NPC (Quelle,
 * Distanz, Verlust) -> Tageswechsel und Rueckkehr -> verzoegerte Folge.
 * An den Schlüsselstellen wird gespeichert und neu geladen; der Vergleich
 * prueft Beziehungen, Erinnerungen, Wissen und die offene Folge.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_ENERGY_PER_DAY, cityOf, restInCity, travel } from '../city';
import { encounterDialog, meetNpc, takeEncounterAction } from '../city-encounter';
import { informantFor } from '../city-npcs';
import { ensureCityPopulation } from '../city-life-state';
import { PORTEMONNAIE } from '../money';
import { relationshipBetween } from '../narrative/relationships';
import { processNarrativeRuntime } from '../narrative/runtime';
import { seedStartPool } from '../narrative/state';
import { createWorld, ensureStarter } from '../templates';

function start(): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  seedStartPool(world, fromVC(150));
  world.day = 1;
  world.tick = 5;
  const ledger = new Ledger({ [PORTEMONNAIE]: fromVC(20) });
  travel(world, 'KIEZ');
  return { world, ledger, prng: new Prng(randomSeed()) };
}

describe('Begegnungs-Loop (Stadt)', () => {
  it('spielt Gespraech, Handlung, Wissen, Tageswechsel und Folge als eine Kette', () => {
    const { world, ledger, prng } = start();
    const met = meetNpc(world, 'KIEZ');
    expect(met.npc.name).toBe('Rita Kern');

    const npcRef = `visitor:${met.visitor.id}` as `visitor:${number}`;
    const dialog = encounterDialog(world, ledger, met.event.id);
    // (a) Benannter NPC mit Rolle und Ort; die Erinnerung ist noch leer.
    expect(dialog.text).toContain('Rita Kern');
    expect(dialog.text).toContain('Wirtin der Kiez-Kneipe');
    expect(dialog.memory).toContain('noch nicht gesehen');
    expect(dialog.choices.map((choice) => choice.choiceId))
      .toEqual(['GIVE_ROUND', 'HELP_CRATE', 'DECLINE_ASK']);

    // (b) Soziale Handlung veraendert Geld, Spielerzustand und Beziehung.
    const walletBefore = ledger.getBalance(PORTEMONNAIE);
    const result = takeEncounterAction(world, ledger, met.event.id, 'GEBEN');
    expect(result.amount).toBe(fromVC(3));
    expect(result.walletAfter).toBe(walletBefore - fromVC(3));
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(walletBefore - fromVC(3));
    expect(result.energyAfter).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(result.trust).toBe(2);
    expect(relationshipBetween(world, npcRef, 'player')?.trust).toBe(2);
    expect(world.narrative.flags.encounter_gift).toBe(1);
    expect(cityOf(world).encounters).toHaveLength(1);

    // (c) Der NPC erlebt es selbst, der zweite NPC hoert es mit Quelle und Verlust.
    const ownEntries = world.narrative.knowledge.filter((entry) => entry.actor === npcRef);
    expect(ownEntries).toHaveLength(1);
    const own = ownEntries[0]!;
    expect(own.distance).toBe(0);
    expect(own.confidence).toBe(1);
    expect(own.sourceKind).toBe('ERLEBT');
    expect(own.sourceActor).toBe(npcRef);
    const informantDef = informantFor(met.npc)!;
    const informant = world.visitors.find((visitor) => visitor.name === informantDef.name)!;
    const informantRef = `visitor:${informant.id}` as `visitor:${number}`;
    const heardEntries = world.narrative.knowledge.filter((entry) => entry.actor === informantRef);
    expect(heardEntries).toHaveLength(1);
    const heard = heardEntries[0]!;
    expect(heard.sourceActor).toBe(npcRef);
    expect(heard.originActor).toBe(npcRef);
    expect(heard.distance).toBe(1);
    expect(heard.confidence).toBeLessThan(own.confidence);
    expect(heard.sourceKind).toBe('GEHOERT');

    // (d) Die Kette wartet auf den Tageswechsel, nicht auf einen Klick.
    processNarrativeRuntime(world, ledger);
    const runs = world.narrative.chains.runs.filter((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC');
    expect(runs).toHaveLength(1);
    const run = runs[0]!;
    expect(run.status).toBe('WAITING');
    expect(run.dueTick).toBe(world.tick + 24);
    expect(world.narrative.events.filter((entry) => entry.eventId.startsWith('CITY_ENCOUNTER_ECHO'))).toHaveLength(0);

    // (e) Save/Load mitten im Ablauf erhaelt alles, was der Loop traegt.
    const before = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(before)!;
    expect(loaded).not.toBeNull();
    const lw = loaded.world;
    expect(lw.city?.encounters).toHaveLength(1);
    expect(lw.city?.encounters?.[0]?.action).toBe('GEBEN');
    expect(lw.city?.location).toBe('KIEZ');
    expect(relationshipBetween(lw, npcRef, 'player')?.trust).toBe(2);
    expect(lw.visitors.find((visitor) => visitor.id === met.visitor.id)?.memories).toHaveLength(1);
    expect(lw.narrative.knowledge.find((entry) => entry.actor === npcRef)?.confidence).toBe(1);
    expect(lw.narrative.knowledge.find((entry) => entry.actor === informantRef)?.distance).toBe(1);
    expect(lw.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')?.dueTick)
      .toBe(run.dueTick);

    // Rueckkehr am naechsten Tag: der echte Tagesabschluss muss die
    // verzoegerte Folge selbst faellig machen. Kein Zuruecksetzen der Uhr.
    restInCity(lw, loaded.ledger, new Prng(loaded.prngState));
    expect(lw.day).toBe(2);
    expect(lw.tick).toBe(600);
    const echo = lw.narrative.events.find((entry) => entry.eventId.startsWith('CITY_ENCOUNTER_ECHO'))!;
    expect(echo.eventId).toBe('CITY_ENCOUNTER_ECHO_WARM');
    const echoDialog = encounterDialog(lw, loaded.ledger, echo.id);
    expect(echoDialog.text).toContain('Rita Kern');
    expect(echoDialog.text).toContain('winkt dich heran');

    // Der Ort erinnert sich jetzt an die erste Begegnung.
    const again = encounterDialog(lw, loaded.ledger, meetNpc(lw, 'KIEZ').event.id);
    expect(again.memory).toContain('Tag 1');
    expect(again.memory).toContain('eine Runde ausgegeben');

    // Auch die Folge selbst ueberlebt einen zweiten Save/Load-Roundtrip.
    const after = replaySave(JSON.parse(JSON.stringify(toSavedGame(lw, loaded.ledger, loaded.prngState))))!;
    expect(after.world.narrative.events.find((entry) => entry.eventId === 'CITY_ENCOUNTER_ECHO_WARM')?.id)
      .toBe(echo.id);
    expect(after.world.city?.encounters).toHaveLength(1);
    expect(relationshipBetween(after.world, npcRef, 'player')?.trust).toBe(2);
  });

  it('spricht auch Figuren jenseits der kuratierten drei an', () => {
    const { world } = start();
    ensureCityPopulation(world, 12);
    const met = meetNpc(world, 'npc_4');
    expect(met.npc.id).toBe('npc_4');
    expect(met.npc.name.length).toBeGreaterThan(0);
    expect(met.npc.role.length).toBeGreaterThan(0);
    expect(met.visitor.residentNpcId).toBe('npc_4');
    expect(met.visitor.name).toBe(met.npc.name);
  });

  it('fuehrt eine Ablehnung in einen anderen sichtbaren Pfad', () => {
    const { world, ledger, prng } = start();
    const met = meetNpc(world, 'KIEZ');
    const walletBefore = ledger.getBalance(PORTEMONNAIE);
    const result = takeEncounterAction(world, ledger, met.event.id, 'ABLEHNEN');
    expect(result.walletAfter).toBe(walletBefore - fromVC(1));
    expect(result.trust).toBe(-1);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY - 1);
    processNarrativeRuntime(world, ledger);
    const run = world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')!;
    expect(run.dueTick).toBe(world.tick + 24);
    // Auch die Ablehnung kehrt ueber den echten Tagesabschluss zurueck.
    restInCity(world, ledger, prng);
    processNarrativeRuntime(world, ledger);
    const echo = world.narrative.events.find((entry) => entry.eventId.startsWith('CITY_ENCOUNTER_ECHO'))!;
    expect(echo.eventId).toBe('CITY_ENCOUNTER_ECHO_COLD');
    const dialog = encounterDialog(world, ledger, echo.id);
    expect(dialog.text).toContain('Der Platz von gestern ist besetzt');
    expect(dialog.text).not.toContain('winkt dich heran');
  });
});
