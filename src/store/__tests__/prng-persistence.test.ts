/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Der PRNG-Zustand setzt nach dem Laden die Folge exakt fort, ohne Doppelziehung.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { createWorld } from '../../core/sim/templates';
import { loadWorld, saveWorld } from '../save';
import { randomSeed } from '../../test/random-seed';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  const storage: Storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
});

describe('PRNG ueber Speichern und Laden', () => {
  it('setzt die Folge an genau der gespeicherten Stelle fort', () => {
    const seed = randomSeed();
    const live = new Prng(seed);
    for (let index = 0; index < 3; index += 1) live.nextInt(0, 100);
    const saved = live.getState();

    const world = createWorld('SMALL');
    saveWorld(world, new Ledger(), saved);

    const reference = new Prng(seed);
    for (let index = 0; index < 3; index += 1) reference.nextInt(0, 100);
    const expected = [reference.nextInt(0, 100), reference.nextInt(0, 100), reference.nextInt(0, 100)];

    const loaded = loadWorld()!;
    expect(loaded.prngState).toBe(saved);
    const resumed = new Prng(loaded.prngState);
    expect([resumed.nextInt(0, 100), resumed.nextInt(0, 100), resumed.nextInt(0, 100)]).toEqual(expected);
    expect([live.nextInt(0, 100), live.nextInt(0, 100), live.nextInt(0, 100)]).toEqual(expected);
  });

  it('zieht beim Replay selbst nichts aus dem Zufall', () => {
    const prng = new Prng(randomSeed());
    const world = createWorld('SMALL');
    saveWorld(world, new Ledger(), prng.getState());
    const again = loadWorld()!;
    const third = loadWorld()!;
    expect(again.prngState).toBe(prng.getState());
    expect(third.prngState).toBe(prng.getState());
    expect(new Prng(again.prngState).nextUint32()).toBe(new Prng(prng.getState()).nextUint32());
  });
});
