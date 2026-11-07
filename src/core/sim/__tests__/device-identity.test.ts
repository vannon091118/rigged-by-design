/**
 * @test-target: src/core/sim/device.ts
 * @error-code: ERR-2001
 *
 * Geräteidentität und Spieltyp sind zwei Fragen. Der Katalog entscheidet,
 * welches Gehäuse ein Spiel bekommt – der Speicherstand darf das nicht
 * umdrehen, und ein Spieltyp ohne Katalogeintrag verschwindet still.
 */
import { describe, expect, it } from 'vitest';
import { gameOf, isCabinet, repairDeviceIdentity } from '../device';
import { BUILD_DEFS } from '../offers';
import type { GameId } from '../types';

const UNKNOWN_GAME = 'VULKAN' as unknown as GameId;

describe('Geräteidentität aus dem Katalog', () => {
  it('heilt jedes baubare Spiel auf die Katalogidentität, egal was gespeichert war', () => {
    let healed = 0;
    for (const def of BUILD_DEFS) {
      if (!def.gameId) continue;
      expect(repairDeviceIdentity({ kind: 'DECOR', gameId: def.gameId }))
        .toEqual({ kind: def.kind, gameId: def.gameId });
      healed += 1;
    }
    expect(healed).toBeGreaterThanOrEqual(7);
  });

  it('lässt das Plinko-Kabinett im Slot-Gehäuse stehen und den Spieltyp unangetastet', () => {
    const device = repairDeviceIdentity({ kind: 'BAR', gameId: 'PLINKO' });
    expect(device).toEqual({ kind: 'SLOT', gameId: 'PLINKO' });
    expect(isCabinet(device)).toBe(true);
    expect(gameOf(device)).toBe('PLINKO');
  });

  it('entfernt einen Spieltyp, den der Katalog nicht kennt, und lässt das Gerät stehen', () => {
    expect(repairDeviceIdentity({ kind: 'SLOT', gameId: UNKNOWN_GAME }))
      .toEqual({ kind: 'SLOT', gameId: undefined });
  });

  it('rührt Servicegeräte ohne Spieltyp nicht an', () => {
    const bar = repairDeviceIdentity({ kind: 'BAR', gameId: undefined });
    expect(bar).toEqual({ kind: 'BAR', gameId: undefined });
    expect(isCabinet(bar)).toBe(false);
    expect(gameOf(bar)).toBeNull();
  });
});
