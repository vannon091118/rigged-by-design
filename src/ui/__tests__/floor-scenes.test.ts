/**
 * @test-target: src/ui/floor-scenes.ts
 * @error-code: ERR-3001
 *
 * Die Regel ist die eine Freigabe für Maus, Touch, WASD, E und Enter. Der
 * Fremd-Floor bleibt Menü; Wohnung und Stadt teilen dagegen Boden und Türen
 * mit dem eigenen Casino.
 */
import { describe, expect, it } from 'vitest';
import type { GameView } from '../../store/types';
import { floorMovementAllowed, floorTapAllowed } from '../floor-scenes';

describe('Floor-Szenenregel', () => {
  it('gibt den vollen Boden nur im eigenen Casino frei', () => {
    expect(floorMovementAllowed('OWN')).toBe(true);
    expect(floorTapAllowed('OWN', 'guest')).toBe(true);
    expect(floorTapAllowed('OWN', 'furniture')).toBe(true);
    expect(floorTapAllowed('OWN', 'floor')).toBe(true);
  });

  it('teilt Boden und Türen in Wohnung und Stadt; Wohnungsmöbel bleiben eigene Ziele', () => {
    for (const scene of ['APARTMENT', 'CITY'] as const) {
      expect(floorMovementAllowed(scene)).toBe(true);
      expect(floorTapAllowed(scene, 'floor')).toBe(true);
      expect(floorTapAllowed(scene, 'door')).toBe(true);
      expect(floorTapAllowed(scene, 'guest')).toBe(false);
    }
    expect(floorTapAllowed('APARTMENT', 'furniture')).toBe(true);
    expect(floorTapAllowed('CITY', 'furniture')).toBe(false);
  });

  it('hält den Fremd-Floor für alle Bodenpfade geschlossen', () => {
    for (const target of ['floor', 'door', 'guest', 'furniture', 'crate', 'stain', 'mop'] as const) {
      expect(floorTapAllowed('FOREIGN', target)).toBe(false);
    }
    expect(floorMovementAllowed('FOREIGN')).toBe(false);
  });

  it('bewegt den Charakter per WASD in allen begehbaren Szenen', () => {
    const scenes: GameView['scene']['kind'][] = ['OWN', 'APARTMENT', 'CITY'];
    for (const scene of scenes) expect(floorMovementAllowed(scene)).toBe(true);
  });
});
