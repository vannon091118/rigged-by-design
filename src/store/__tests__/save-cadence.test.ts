/**
 * @test-target: src/store/save-cadence.ts
 * @error-code: ERR-4026
 *
 * Issue #988: Der passive Takt speichert nicht mehr bei jedem sechsten Tick,
 * sondern höchstens alle SAVE_EVERY_TICKS (~15 s). Ein Tab-Wechsel in den
 * Hintergrund oder `pagehide` sichert den ausstehenden Stand sofort.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { HAUSKONTO } from '../../core/sim/money';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { TICK_MS } from '../../core/sim/tick-timing';
import { randomSeed } from '../../test/random-seed';
import {
  SAVE_EVERY_TICKS,
  SAVE_INTERVAL_S,
  bindSaveOnHide,
  shouldPersistTick,
  type HideTarget,
} from '../save-cadence';
import { WorldTick } from '../world-tick';

/** Fährt den echten Takt und sammelt die Ticks, an denen er speichern lässt. */
function savesWithin(ticks: number): number[] {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(10_000), 'takt-kapital', 0);
  const prng = new Prng(randomSeed());
  const saves: number[] = [];
  const tick = new WorldTick({
    world: () => world,
    ledger: () => ledger,
    prng: () => prng,
    arriveStreetDoor: () => false,
    leaveApartmentDoor: () => false,
    leaveInteriorDoor: () => false,
    emit: (save) => { if (save) saves.push(world.tick); },
    hasListeners: () => false,
    fault: () => {},
  });
  for (let step = 0; step < ticks; step += 1) tick.run();
  return saves;
}

describe('Save-Kadenz des passiven Takts', () => {
  it('drosselt auf SAVE_EVERY_TICKS und dokumentiert die Grenze in Sekunden', () => {
    expect(SAVE_EVERY_TICKS).toBe(30);
    expect(SAVE_EVERY_TICKS * TICK_MS).toBeGreaterThanOrEqual(15_000);
    expect(SAVE_INTERVAL_S).toBeCloseTo((SAVE_EVERY_TICKS * TICK_MS) / 1000);
    expect(shouldPersistTick(SAVE_EVERY_TICKS - 1)).toBe(false);
    expect(shouldPersistTick(SAVE_EVERY_TICKS)).toBe(true);
    expect(shouldPersistTick(SAVE_EVERY_TICKS * 2)).toBe(true);
  });

  it('speichert bei sechs Ticks nicht mehr und bei 30 Ticks genau einmal', () => {
    expect(savesWithin(6)).toHaveLength(0);
    const saves = savesWithin(SAVE_EVERY_TICKS);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toBeGreaterThanOrEqual(SAVE_EVERY_TICKS);
  });
});

describe('Sicherung beim Verlassen des Tabs', () => {
  it('sichert nur im Hintergrund und bei pagehide', () => {
    const listeners = new Map<string, () => void>();
    let visibility = 'visible';
    let saved = 0;
    const host: HideTarget = {
      get visibilityState() { return visibility; },
      addEventListener: (type, listener) => { listeners.set(type, listener); },
      removeEventListener: (type) => { listeners.delete(type); },
    };
    const unbind = bindSaveOnHide(() => { saved += 1; }, host);
    const fire = (type: string): void => {
      const listener = listeners.get(type);
      expect(listener).toBeDefined();
      listener?.();
    };

    fire('visibilitychange');
    expect(saved).toBe(0);
    visibility = 'hidden';
    fire('visibilitychange');
    expect(saved).toBe(1);
    fire('pagehide');
    expect(saved).toBe(2);

    unbind();
    expect(listeners.size).toBe(0);
  });
});
