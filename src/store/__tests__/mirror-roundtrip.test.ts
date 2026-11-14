/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Der Lager-Spiegel laeuft durch Kauf, Aufnehmen und Aufstellen und muss nach
 * Speichern/Laden mit identischer Dekor- und Interaktionswahrheit dastehen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { createWorld } from '../../core/sim/templates';
import type { Furniture, WorldState } from '../../core/sim/types';
import { buildFurnitureActions } from '../../render/floor-actions';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';
import { buyCmd, deployCmd, pickupCmd } from '../venue-commands';

function placeMirror(world: WorldState, ledger: Ledger): Furniture {
  buyCmd(world, ledger, 'SPIEGEL');
  const crate = world.crates.find((entry) => entry.payload.kind === 'FURNITURE' && entry.payload.buildId === 'SPIEGEL');
  if (!crate) throw new Error('Spiegel-Kiste fehlt nach dem Kauf.');
  // Der Produktionspfad verlangt Reichweite; der Test stellt den Spieler an die Kiste.
  world.player.position = { x: crate.x, y: crate.y };
  pickupCmd(world, crate.id);

  const storage = world.zones.find((zone) => zone.id === 'storage');
  if (!storage) throw new Error('Lager-Zone fehlt im Blueprint.');
  const before = new Set(world.furniture.map((item) => item.id));
  for (let y = storage.y; y < storage.y + storage.h; y += 1) {
    for (let x = storage.x; x < storage.x + storage.w; x += 1) {
      try {
        deployCmd(world, x, y);
        const placed = world.furniture.find((item) => !before.has(item.id));
        if (placed) return placed;
      } catch {
        // Belegte Kacheln und Waende sind erwartbar; die naechste freie zaehlt.
      }
    }
  }
  throw new Error('Kein freies Feld im Lager fuer den Spiegel.');
}

describe('Spiegel im Lager · Save/Load-Roundtrip', () => {
  it('erhaelt Objekt, Position und Spiegel-Aktion ueber Speichern und Laden', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'testkapital', 0);
    const mirror = placeMirror(world, ledger);

    expect(mirror).toMatchObject({ kind: 'DECOR', label: 'Spiegel', w: 1, h: 1, zoneId: 'storage' });
    expect(buildFurnitureActions(world, mirror)[0]).toMatchObject({ id: 'SPIEGEL', label: 'Spiegel', enabled: true });

    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();

    const loadedMirror = loaded!.world.furniture.find((item) => item.id === mirror.id);
    expect(loadedMirror).toEqual(mirror);
    expect(loadedMirror?.x).toBe(mirror.x);
    expect(loadedMirror?.y).toBe(mirror.y);
    expect(buildFurnitureActions(loaded!.world, loadedMirror!)[0]).toEqual(buildFurnitureActions(world, mirror)[0]);
  });

  it('scheitert sichtbar, wenn der Spiegel im gespeicherten Stand fehlt', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'testkapital', 0);
    const mirror = placeMirror(world, ledger);

    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    raw.furniture = raw.furniture.filter((item: Furniture) => item.id !== mirror.id);
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.furniture.some((item) => item.label === 'Spiegel' && item.id === mirror.id)).toBe(false);
  });
});
