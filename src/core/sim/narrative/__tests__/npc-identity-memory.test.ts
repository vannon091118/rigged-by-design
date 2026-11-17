/** @test-target: src/core/sim/narrative/memory.ts | src/core/sim/city-life-movement.ts | src/core/sim/city-life.ts | src/core/sim/narrative/disposition.ts | src/core/sim/city-life-memory.ts | @error-code: ERR-3001

NPC-Identitaet (#979): Stadt- und Casino-Begegnungen desselben NPC schreiben ueber
die gebundene visitorId in die kanonische Besuchererinnerung (Visitor.memories).
Die stadtseitige Projektion (CityResidentState.memories) baut keine widerspruechliche
zweite Historie auf; Retention-Grenzen und Save/Load bleiben deterministisch erhalten.
*/
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../../core/economy/ledger';
import { randomSeed } from '../../../../test/random-seed';
import { createWorld } from '../../templates';
import { ensureCityLife } from '../../city-life-state';
import type { Visitor, WorldState } from '../../types';
import type { CityResidentState } from '../../city-life-types';
import { applyMemories } from '../memory';
import { visitorDisposition } from '../disposition';
import { projectNewMemories, tickCityMovement } from '../../city-life-movement';
import { addMemory } from '../../city-life-memory';
import { toSavedGame, replaySave } from '../../../../store/save';

function boundPair(world: WorldState): { readonly resident: CityResidentState; readonly visitor: Visitor } {
  const life = ensureCityLife(world);
  const resident = life.residents[0]!;
  const visitor = world.visitors.find((entry) => entry.id === resident.visitorId)!;
  return { resident, visitor };
}

function visitEndedFact(
  world: WorldState,
  visitorId: number,
  score: number,
  valence: 'GOOD' | 'NEUTRAL' | 'BAD',
  id: number,
  tick: number,
) {
  return {
    kind: 'VISIT_ENDED' as const,
    id,
    tick,
    day: world.day,
    visitorId,
    guestId: visitorId,
    score,
    valence };
}

function socialMemoryEntry(id: number, tick: number, sentiment: number): CityResidentState['memories'][number] {
  return { id, tick, kind: 'SOCIAL', aboutNpcId: null, sentiment, confidence: 1 };
}

describe('NPC-Identitaet: eine kanonische Erinnerung ueber Stadt und Casino (#979)', () => {
  it('schreibt einen Casino-Besuch in das Gast- und das Bewohner-Gedaechtnis unter einer Fact-ID', () => {
    const world = createWorld('SMALL');
    const { resident, visitor } = boundPair(world);
    expect(visitor.residentNpcId).toBe(resident.npcId);

    const fact = visitEndedFact(world, visitor.id, 80, 'GOOD', 11, 1);
    expect(applyMemories(world, [fact])).toBe(1);

    const guestMemories = visitor.memories ?? [];
    expect(guestMemories).toHaveLength(1);
    expect(guestMemories[0]!.factId).toBe(fact.id);
    expect(guestMemories[0]!.valence).toBe('GOOD');

    const life = ensureCityLife(world);
    const current = life.residents.find((entry) => entry.npcId === resident.npcId)!;
    expect(current.memories).toHaveLength(1);
    expect(current.memories[0]!.id).toBe(fact.id);

    // Derselbe Fact wird idempotent nicht zweimal gebucht
    expect(applyMemories(world, [fact])).toBe(0);
    expect((visitor.memories ?? [])).toHaveLength(1);
    expect(current.memories).toHaveLength(1);
  });

  it('waegt eine stadtseitige Erinnerung in der Casino-Disposition mit', () => {
    const world = createWorld('SMALL');
    const { visitor } = boundPair(world);
    const base = visitorDisposition(visitor, world.narrative.relationships);
    visitor.memories = [...(visitor.memories ?? []), { factId: 7, tick: 1, score: 80, valence: 'GOOD' }];
    const withMemory = visitorDisposition(visitor, world.narrative.relationships);
    expect(withMemory.gameBias).toBeGreaterThan(base.gameBias);
  });

  it('projeziert neue Stadterinnerungen einmal ins Gast-Gedaechtnis und dupliziert nicht', () => {
    const world = createWorld('SMALL');
    const { resident, visitor } = boundPair(world);

    const nachStadt: CityResidentState = {
      ...resident,
      memories: [...resident.memories, socialMemoryEntry(101, 1, 1)],
    };
    projectNewMemories(world, resident, nachStadt);
    expect((visitor.memories ?? [])).toHaveLength(1);
    expect(visitor.memories![0]!.factId).toBe(101);
    expect(visitor.memories![0]!.valence).toBe('GOOD');

    // Zweiter Aufruf mit gleichem Stand: keine Duplikate
    projectNewMemories(world, resident, nachStadt);
    expect((visitor.memories ?? [])).toHaveLength(1);

    // Eine weitere neue Erinnerung wird annehmbar
    const nochEin: CityResidentState = {
      ...nachStadt,
      memories: [...nachStadt.memories, socialMemoryEntry(102, 2, -1)],
    };
    projectNewMemories(world, nachStadt, nochEin);
    expect((visitor.memories ?? [])).toHaveLength(2);
    expect(visitor.memories![1]!.factId).toBe(102);
    expect(visitor.memories![1]!.valence).toBe('BAD');
  });

  it('erzwingt die Retention-Grenzen (Gast 6, Bewohner 8)', () => {
    const world = createWorld('SMALL');
    const { visitor } = boundPair(world);
    const life = ensureCityLife(world);
    const resident = life.residents[0]!;

    for (let tick = 1; tick <= 7; tick += 1) {
      expect(applyMemories(world, [visitEndedFact(world, visitor.id, 50, 'NEUTRAL', tick, tick)])).toBe(1);
    }
    expect((visitor.memories ?? [])).toHaveLength(6);
    // Der Stadt-Bewohner waehrt die Gast-Erinnerungen als Projektion (Cap 8)
    const refreshedResident = ensureCityLife(world).residents.find((entry) => entry.npcId === resident.npcId)!;
    expect(refreshedResident.memories).toHaveLength(7);

    let residentMemories = refreshedResident.memories;
    for (let id = 1; id <= 9; id += 1) {
      residentMemories = addMemory(residentMemories, socialMemoryEntry(id, id, 0));
    }
    expect(residentMemories).toHaveLength(8);
    expect(residentMemories[0]!.id).toBe(2);
    expect(residentMemories[7]!.id).toBe(9);
  });

  it('erhaelt Erinnerungen beider Speicher ueber Save/Load', () => {
    const world = createWorld('SMALL');
    const { resident, visitor } = boundPair(world);
    expect(applyMemories(world, [visitEndedFact(world, visitor.id, 90, 'GOOD', 21, 1)])).toBe(1);

    const saved = toSavedGame(world, new Ledger(), randomSeed());
    const loaded = replaySave(saved)!;
    expect(loaded.world.visitors.find((entry) => entry.id === visitor.id)!.memories).toEqual(visitor.memories);
    const loadedResident = loaded.world.cityLife!.residents.find((entry) => entry.npcId === resident.npcId)!;
    const currentResident = ensureCityLife(world).residents.find((entry) => entry.npcId === resident.npcId)!;
    expect(loadedResident.memories).toEqual(currentResident.memories);

    // Zweiter Roundtrip veraendert nichts
    const savedAgain = toSavedGame(loaded.world, loaded.ledger, randomSeed());
    const loadedAgain = replaySave(savedAgain)!;
    expect(loadedAgain.world.cityLife!.residents.find((entry) => entry.npcId === resident.npcId)!.memories).toEqual(
      currentResident.memories,
    );
  });

  it('projeziert neu angelegte Stadterinnerungen ins kanonische Gast-Gedaechtnis', () => {
    const world = createWorld('SMALL');
    ensureCityLife(world);
    const life = world.cityLife!;
    const resident = life.residents[0]!;
    const visitor = world.visitors.find((entry) => entry.id === resident.visitorId)!;
    const kiezPos = { ...resident.position };
    const peer: CityResidentState = { ...life.residents[1]!, location: 'KIEZ', position: kiezPos };
    const traveler: CityResidentState = {
      ...resident,
      intent: 'PUB',
      location: 'KIEZ',
      travel: { to: 'KIEZ', path: [kiezPos, kiezPos], index: 0 },
    };
    world.cityLife = {
      ...life,
      residents: life.residents.map((entry) =>
        entry.npcId === resident.npcId ? traveler : entry.npcId === peer.npcId ? peer : entry,
      ),
    };

    const beforeResident = resident.memories;
    const beforeVisitor = visitor.memories ?? [];

    tickCityMovement(world);

    const after = world.cityLife!.residents.find((entry) => entry.npcId === resident.npcId)!;
    const afterVisitor = world.visitors.find((entry) => entry.id === resident.visitorId)!;
    if (after.memories.length > beforeResident.length) {
      const neu = after.memories.filter((memory) => !beforeResident.some((entry) => entry.id === memory.id));
      for (const memory of neu) {
        expect((afterVisitor.memories ?? []).some((entry) => entry.factId === memory.id)).toBe(true);
      }
    }
    // Gast-Erinnerungen gehen durch den Stadt-Tick nicht verloren
    expect((afterVisitor.memories ?? []).length).toBeGreaterThanOrEqual(beforeVisitor.length);
  });
});
