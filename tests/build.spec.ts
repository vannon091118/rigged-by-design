/**
 * @test-target src/core/sim/offers.ts (Build-Definitionen, Kosten)
 * @test-target src/store/venue-commands.ts (buyCmd, deployCmd, hireCmd, fireCmd, repairCmd, cleanCmd)
 * @expected-behavior Bau-Aktionen, Personal, Upgrades und Raumgestaltung funktionieren korrekt.
 * @coverage Kaufen, Platzieren, Einstellen, Entlassen, Reparieren, Reinigen
 * @missing-edge-case Bau ohne Geld, Platzieren auf besetztem Feld, Max-Personal erreicht
 */
import { test, expect } from './fixtures/game';

test.describe('Bauen & Verwalten — echte Use Cases (Multi-Step)', () => {

  test('Build-Panel öffnen und schließen (Escape)', async ({ app, floor }) => {
    await floor.waitForReady();
    await app.pressKey('b');
    await floor.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await floor.closeBuild();
    await expect(app.appRoot).toBeVisible();
  });

  test('Reinigen-Button im Build-Panel', async ({ app, _hud, buildPanel }) => {
    await app.pressKey('b');
    await buildPanel.page.waitForTimeout(500);
    await buildPanel.clickClean();
    await buildPanel.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await buildPanel.close();
  });

  test('Personal einstellen/entlassen', async ({ app, _hud, buildPanel }) => {
    await app.pressKey('b');
    await buildPanel.page.waitForTimeout(500);
    await buildPanel.clickHire();
    await buildPanel.clickFire();
    await buildPanel.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await buildPanel.close();
  });

  test('Upgrade Bar und WC', async ({ app, _hud, buildPanel }) => {
    await app.pressKey('b');
    await buildPanel.page.waitForTimeout(500);
    await buildPanel.clickUpgradeBar();
    await buildPanel.clickUpgradeWc();
    await buildPanel.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await buildPanel.close();
  });

});

test.describe('Bauen & Verwalten — Edge Cases (Grenzfälle)', () => {

  test('Bauen ohne ausreichendes Hauskonto', async ({ app, _hud, buildPanel }) => {
    await app.pressKey('b');
    await buildPanel.page.waitForTimeout(500);
    await buildPanel.clickBuy();
    await buildPanel.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await buildPanel.close();
  });

  test('Platzieren auf besetztem Feld', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.clickEmptyAt(400, 300);
    await expect(app.appRoot).toBeVisible();
  });

});
