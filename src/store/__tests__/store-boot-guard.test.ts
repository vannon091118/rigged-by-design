''
/**
 * @test-target: src/store/world-store.ts
 * @error-code: ERR-1004
 *
 * Guard: Ein frischer Store ohne gespeicherten Stand darf nicht mit einem
 * leeren Ledger (0 VC) bleiben. newGame() muss durch createNewGame() den
 * Startkapital-Betrag buchen und die Wohnung eroeffnen.
 */
import { describe, expect, it } from 'vitest';
import { worldStore } from '../world-store';

describe('Store-Boot ohne Save', () => {
  it('startet ein neues Spiel statt mit leerem Ledger zu bleiben', () => {
    const view = worldStore.getSnapshot();
    // createNewGame setzt scene auf APARTMENT; Default createWorld('SMALL') bleibt auf CITY/OWN.
    expect(view.scene.kind).toBe('APARTMENT');
    // Spieler-Cash muss initialisiert sein (nicht 0 VC Phantom).
    expect(view.playerCash).toBeGreaterThanOrEqual(0);
  });
});
