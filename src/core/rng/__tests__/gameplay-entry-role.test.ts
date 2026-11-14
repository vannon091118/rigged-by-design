/**
 * @test-target: src/core/rng/gameplay-entry-points.ts
 * @error-code: ERR-1003
 *
 * Negative Rollenpruefung an jeder oeffentlichen Gameplay-RNG-Grenze (#625):
 * ein Darstellungsstrom wird abgewiesen, bevor Weltzustand oder Uhr sich
 * bewegen. Die Liste ist versioniert; eine neue Grenze ohne Eintrag faellt
 * hier rot auf.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { playRound } from '../../games/round';
import { advanceToNextDay, tickWorld } from '../../sim/tick';
import { createWorld } from '../../sim/templates';
import type { WorldState } from '../../sim/types';
import {
  GAMEPLAY_RNG_BOUNDARY_MODULES,
  GAMEPLAY_RNG_ENTRY_POINTS,
  GAMEPLAY_RNG_ENTRY_POINTS_VERSION,
} from '../gameplay-entry-points';
import { Prng } from '../prng';
import { presentationRng } from '../streams';

const SEED = 424242;

/** Weltzustand als vergleichbarer Wert; Mengen bleiben Mengen. */
function snapshot(world: WorldState): string {
  return JSON.stringify(world, (_key, value) => (value instanceof Set ? [...value].sort() : value));
}

/** Exportierte Funktionen einer Grenzdatei, die einen `Prng` entgegennehmen. */
function prngExportsIn(modulePath: string): string[] {
  const source = readFileSync(new URL(modulePath.replace(/^src\/core\//, '../../'), import.meta.url), 'utf8');
  const found: string[] = [];
  const declaration = /^export (?:async )?function\s+([A-Za-z0-9_]+)\s*\(/gm;
  for (let match = declaration.exec(source); match; match = declaration.exec(source)) {
    const name = match[1]!;
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    for (; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      else if (source[index] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const params = source.slice(start, index + 1);
    if (/\bPrng\b/.test(params)) found.push(name);
  }
  const constDeclaration = /^export const\s+([A-Za-z0-9_]+)\s*=/gm;
  for (let match = constDeclaration.exec(source); match; match = constDeclaration.exec(source)) {
    const statement = source.slice(match.index, source.indexOf('\n', source.indexOf('=>', match.index) + 2));
    if (/\bPrng\b/.test(statement)) found.push(match[1]!);
  }
  return [...new Set(found)].sort();
}

describe('Gameplay-RNG-Grenzen', () => {
  it('fuehrt jede Grenze genau einmal mit stabiler Kennung', () => {
    expect(GAMEPLAY_RNG_ENTRY_POINTS_VERSION).toBe(1);
    const ids = GAMEPLAY_RNG_ENTRY_POINTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of GAMEPLAY_RNG_ENTRY_POINTS) {
      expect(entry.id, 'id').toMatch(/^[a-z]+\.[A-Za-z0-9]+$/);
      expect(entry.note.length, entry.id).toBeGreaterThan(20);
      expect(entry.module.endsWith('.ts'), entry.id).toBe(true);
    }
  });

  it('deckt jede exportierte Funktion mit Prng in den Grenzmodulen ab', () => {
    for (const modulePath of GAMEPLAY_RNG_BOUNDARY_MODULES) {
      const listed = GAMEPLAY_RNG_ENTRY_POINTS.filter((entry) => entry.module === modulePath)
        .map((entry) => entry.symbol)
        .sort();
      expect(prngExportsIn(modulePath), modulePath).toEqual(listed);
    }
  });

  it('weist den Darstellungsstrom an tickWorld ab, ohne den Weltzustand zu bewegen', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const before = snapshot(world);
    const tickBefore = world.tick;

    expect(() => tickWorld(world, ledger, presentationRng(SEED))).toThrow(/presentation/);

    expect(world.tick).toBe(tickBefore);
    expect(snapshot(world)).toBe(before);
  });

  it('weist den Darstellungsstrom an advanceToNextDay ab, bevor die Uhr wandert', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const before = snapshot(world);
    const tickBefore = world.tick;

    expect(() => advanceToNextDay(world, ledger, presentationRng(SEED))).toThrow(/presentation/);

    expect(world.tick).toBe(tickBefore);
    expect(snapshot(world)).toBe(before);
  });

  it('weist den Darstellungsstrom an playRound ab', () => {
    expect(() => playRound('SLOT', presentationRng(SEED))).toThrow(/presentation/);
  });

  it('laesst den Gameplay-Strom unveraendert durch dieselben Grenzen', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const tickBefore = world.tick;

    tickWorld(world, ledger, new Prng(SEED));
    expect(world.tick).toBe(tickBefore + 1);

    const nextDay = advanceToNextDay(world, ledger, new Prng(SEED));
    expect(nextDay).toBeGreaterThan(0);

    expect(playRound('SLOT', new Prng(SEED)).game).toBe('SLOT');
  });
});
