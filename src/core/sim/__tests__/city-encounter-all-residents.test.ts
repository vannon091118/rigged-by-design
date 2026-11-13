/**
 * @test-target: src/core/sim/city-encounter.ts
 * @error-code: ERR-2001
 *
 * Jeder Bewohner ist ansprechbar: Öffnen, Dialog und soziale Handlung müssen
 * dieselbe Figur über `residentNpcId` → `rosterDefById` auflösen. Kein Name,
 * kein Listenindex und kein Default dürfen eine fehlende Kennung verdecken.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { cityOf, travel } from '../city';
import { encounterDialog, meetNpc, takeEncounterAction } from '../city-encounter';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { rosterDefById, rosterDefs } from '../city-npc-roster';
import { informantFor, locationName, witnessFor } from '../city-npcs';
import { PORTEMONNAIE } from '../money';
import { createWorld, ensureStarter } from '../templates';

/** Alle Bewohner an den Ort des Spielers stellen: Anwesenheit ist die Bedingung. */
function placeAll(world: ReturnType<typeof createWorld>, place: 'HOME' | 'KIEZ' | 'MARKT' | 'CASINO') {
  const life = ensureCityLife(world);
  world.cityLife = {
    ...life,
    residents: life.residents.map((resident) => ({ ...resident, location: place })),
  };
}

function start() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.day = 1;
  world.tick = 5;
  travel(world, 'KIEZ');
  ensureCityPopulation(world, 12);
  const ledger = new Ledger({ [PORTEMONNAIE]: fromVC(40) });
  return { world, ledger };
}

describe('Begegnung mit allen Bewohnern', () => {
  it('loest jeden der zwoelf Bewohner ueber residentNpcId und rosterDefById auf', () => {
    const { world } = start();
    const life = ensureCityLife(world);
    const ids = life.residents.map((resident) => resident.npcId);
    expect(ids).toHaveLength(12);
    expect(ids).toEqual(expect.arrayContaining([
      'rita', 'boris', 'mira',
      'npc_4', 'npc_5', 'npc_6', 'npc_7', 'npc_8', 'npc_9', 'npc_10', 'npc_11', 'npc_12',
    ]));

    for (const id of ids) {
      const expected = rosterDefById(id, life.seed ?? 0);
      expect(expected, `Keine Roster-Definition fuer ${id}`).not.toBeNull();
      const { world: run, ledger } = start();
      placeAll(run, 'KIEZ');
      const met = meetNpc(run, id);
      expect(met.npc, id).toEqual(expected);
      expect(met.visitor.residentNpcId, id).toBe(id);

      const dialog = encounterDialog(run, ledger, met.event.id);
      expect(dialog.speaker, id).toBe(expected!.name);
      expect(dialog.role, id).toBe(expected!.role);
      expect(dialog.place, id).toBe(locationName(expected!.location));
      expect(dialog.text, id).toContain(expected!.name);

      const result = takeEncounterAction(run, ledger, met.event.id, 'HELFEN');
      expect(result.text, id).toContain(expected!.name);
      expect(cityOf(run).encounters?.at(-1)?.name, id).toBe(expected!.name);
    }
  });

  it('findet einen generierten Bewohner an seinem Ort ohne kuratierte Ortsliste', () => {
    const { world } = start();
    ensureCityPopulation(world, 12);
    travel(world, 'CASINO');

    const met = meetNpc(world, 'CASINO');
    expect(met.npc.id).toBe('npc_4');
    expect(met.npc.location).toBe('CASINO');
  });

  it('bleibt fuer neue Besetzungsindizes ansprechbar und findet Peers', () => {
    const { world } = start();
    ensureCityPopulation(world, 20);
    const life = ensureCityLife(world);
    const expected = rosterDefById('npc_20', life.seed ?? 0);
    expect(expected).not.toBeNull();
    placeAll(world, 'KIEZ');

    const met = meetNpc(world, 'npc_20');
    expect(met.npc).toEqual(expected);

    const peers = rosterDefs(life.residents.length, life.seed ?? 0);
    const informant = informantFor(met.npc, peers);
    const witness = witnessFor(met.npc, peers);
    expect(informant?.id).not.toBe('npc_20');
    expect(witness?.id).not.toBe('npc_20');
    expect(witness?.id).not.toBe(informant?.id);
  });

  it('verweigert ein Gespraech mit einem Bewohner, der woanders steht', () => {
    const { world } = start();
    const life = ensureCityLife(world);
    const away = life.residents.find((resident) => resident.location !== 'KIEZ')!;
    expect(away).toBeDefined();
    expect(() => meetNpc(world, away.npcId)).toThrow(/nicht hier/);
  });

  it('macht eine unbekannte Kennung sichtbar statt sie auf einen Default zu biegen', () => {
    const { world } = start();
    expect(rosterDefById('npc_1')).toBeNull();
    expect(() => meetNpc(world, 'npc_1')).toThrow(/nicht in der Besetzung/);
    expect(() => meetNpc(world, 'fremd')).toThrow(/nicht in der Besetzung/);
  });
});
