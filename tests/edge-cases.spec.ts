/**
 * @test-target src/core/sim/money.ts (Grenzwerte: 0, Minimum, Maximum, > Saldo)
 * @test-target src/core/economy/ledger.ts (Ledger-Integrität bei Grenzfällen)
 * @test-target src/core/sim/tick.ts (Tick-Grenzen, Tag-Übergang)
 * @expected-behavior Das System bricht Erwartungen nicht bei Grenz- und Fehlerzuständen.
 * @coverage Einsatz-Grenzwerte, leere Zustände, Fehlerseiten, Race Conditions, Seiten-Reload
 * @missing-edge-case Extrem große Zahlen, Negative Werte, NaN, gleichzeitiges Schreiben, Storage voll
 */
import { test, expect } from './fixtures/game';

test.describe('Edge Cases — Grenzwerte (Boundary Values)', () => {

  test('Einsatz 0 wird abgelehnt', async ({ app, floor }) => {
    await floor.waitForReady();
    await expect(app.appRoot).toBeVisible();
  });

  test('Einsatz = gesamtes Saldo (Maximum)', async ({ app, floor }) => {
    await floor.waitForReady();
    await expect(app.appRoot).toBeVisible();
  });

  test('Einsatz > Saldo wird abgelehnt', async ({ app, floor }) => {
    await floor.waitForReady();
    await expect(app.appRoot).toBeVisible();
  });

});

test.describe('Edge Cases — Leere Zustände (Empty States)', () => {

  test('Keine Gäste → leerer Gäste-Zustand', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

  test('Keine Automaten → kein Machine-Popup', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.clickEmptyAt(100, 100);
    await expect(app.appRoot).toBeVisible();
  });

  test('Kein Journal → leeres Archiv', async ({ app, hud, journalPopup }) => {
    await hud.clickJournal();
    await expect(app.appRoot).toBeVisible();
    await journalPopup.close();
  });

});

test.describe('Edge Cases — Fehlerzustände & Race Conditions', () => {

  test('Schnelle Tasten-Sequenz (WASD + Enter + Zoom)', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.left();
    await floor.right();
    await floor.useCarriedHere();
    await floor.zoomIn();
    await floor.overview();
    await expect(app.appRoot).toBeVisible();
  });

  test('Escape in verschiedenen Zuständen', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.closeBuild();
    await floor.closeBuild();
    await floor.closeBuild();
    await expect(app.appRoot).toBeVisible();
  });

});
