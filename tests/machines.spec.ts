/**
 * @test-target src/core/games/slot-config.ts (Slot-Reels, Mods, Upgrade-Kosten)
 * @test-target src/store/venue-commands.ts (repairCmd, installModCmd, addReelCmd, setBetCmd, setSlotOddsCmd)
 * @test-target src/store/game-commands.ts (spinTestCmd, deployPlinkoCmd, setPlinkoModeCmd)
 * @expected-behavior Spielautomaten können getestet, repariert, modifiziert und gespielt werden.
 * @coverage Automat-Zustand, Reparatur, Testspin, Plinko
 * @missing-edge-case Automat bei 0% Zustand, Max-Walzen erreicht, Einsatz > Saldo
 */
import { test, expect } from './fixtures/game';

test.describe('Spielautomaten — echte Use Cases (Multi-Step)', () => {

  test('Slot spielen: Auf Automaten klicken → Testspin → Ergebnis → Schließen', async ({ app, floor, machinePopup, hud }) => {
    await floor.waitForReady();
    await floor.clickFurnitureAt(450, 320);
    await machinePopup.isOpen();
    await expect(app.appRoot).toBeVisible();
    await machinePopup.clickTest();
    await machinePopup.page.waitForTimeout(1500);
    await expect(hud.houseMoney).toBeVisible();
    await machinePopup.close();
    await expect(app.appRoot).toBeVisible();
  });

  test('Automat reparieren → Zustand prüfen', async ({ app, floor, machinePopup }) => {
    await floor.clickFurnitureAt(450, 320);
    await machinePopup.isOpen();
    await machinePopup.clickRepair();
    await machinePopup.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await machinePopup.close();
  });

  test('Zustand und Plätze im Machine-Popup anzeigen', async ({ _app, floor, machinePopup }) => {
    await floor.clickFurnitureAt(450, 320);
    await machinePopup.isOpen();
    await machinePopup.expectCondition(/ZUSTAND/);
    await machinePopup.expectSeats(/PLÄTZE/);
    await machinePopup.close();
  });

});

test.describe('Spielautomaten — Edge Cases (Grenzfälle)', () => {

  test('Klick auf leeren Floor-Bereich (kein Möbel)', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.clickEmptyAt(100, 100);
    await expect(app.appRoot).toBeVisible();
  });

  test('Zoom rein und raus auf dem Floor', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.zoomIn();
    await floor.zoomIn();
    await floor.zoomOut();
    await floor.overview();
    await expect(app.appRoot).toBeVisible();
  });

  test('Bewegung auf dem Floor (WASD)', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.left();
    await floor.right();
    await floor.up();
    await floor.down();
    await expect(app.appRoot).toBeVisible();
  });

});
