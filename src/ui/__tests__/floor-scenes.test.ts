/**
 * @test-target: src/ui/floor-scenes.ts
 * @error-code: ERR-3001
 *
 * Die Regel ist die eine Freigabe für Maus, Touch, WASD, E und Enter. Jeder
 * Floor ist begehbar; der fremde Floor öffnet Boden, eigene Möbel und eigene
 * Gäste, aber keine Kisten, Flecken oder Wischer des eigenen Casinos.
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
    expect(floorTapAllowed('CITY', 'cityActor' as never)).toBe(true);
    expect(floorTapAllowed('APARTMENT', 'cityActor' as never)).toBe(false);
    expect(floorTapAllowed('OWN', 'cityActor' as never)).toBe(false);
  });

  it('macht den fremden Floor begehbar und öffnet dort Boden, Möbel und Gäste', () => {
    expect(floorMovementAllowed('FOREIGN')).toBe(true);
    for (const target of ['floor', 'guest', 'furniture'] as const) {
      expect(floorTapAllowed('FOREIGN', target)).toBe(true);
    }
    // Kisten, Flecken und Wischer gehören dem eigenen Betrieb.
    for (const target of ['door', 'crate', 'stain', 'mop'] as const) {
      expect(floorTapAllowed('FOREIGN', target)).toBe(false);
    }
  });

  it('bewegt den Charakter per WASD in allen begehbaren Szenen', () => {
    const scenes: GameView['scene']['kind'][] = ['OWN', 'APARTMENT', 'CITY', 'FOREIGN'];
    for (const scene of scenes) expect(floorMovementAllowed(scene)).toBe(true);
  });
});
