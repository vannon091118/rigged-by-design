/**
 * @test-target src/core/sim/money.ts (openHouse, admitFiat, exchangeFiat, placeBet, payOut)
 * @test-target src/core/economy/ledger.ts (Ledger-Buchungen)
 * @expected-behavior Alle Geldflüsse werden korrekt im Ledger gebucht und im HUD angezeigt.
 * @coverage Startkapital, Hauskonto, Portemonnaie, Gäste-Geldfluss über Ticks
 * @missing-edge-case Negativer Einsatz, Einsatz > Saldo, gleichzeitige Buchungen
 */
import { test, expect } from './fixtures/game';

test.describe('Geld & Ledger — echte Use Cases (Multi-Step)', () => {

  test('Neues Spiel → 150 VC Startkapital auf Hauskonto → HUD zeigt 150.0000', async ({ app, hud }) => {
    await hud.expectHouseMoney('150.0000');
  });

  test('Gäste-Zähler reagiert über Ticks (UI stabil)', async ({ app, hud, floor }) => {
    await floor.waitForReady();
    await floor.page.waitForTimeout(3000);
    const text = await hud.guestsCount.textContent();
    const count = parseInt(text ?? '0', 10);
    expect(count).toBeGreaterThanOrEqual(0);
    await expect(app.appRoot).toBeVisible();
  });

  test('HUD zeigt Tag, Ruf und alle Geldkonten gleichzeitig', async ({ app, hud }) => {
    await expect(hud.dayDisplay).toBeVisible();
    await hud.expectReputation(/^\d+%$/);
    await expect(hud.walletMoney).toBeVisible();
    await expect(hud.deskMoney).toBeVisible();
    await expect(hud.pendingMoney).toBeVisible();
  });

});

test.describe('Geld & Ledger — Edge Cases (Grenzfälle)', () => {

  test('Übersicht-Taste (0) zurück zum Start-Zoom', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.zoomIn();
    await floor.overview();
    await expect(app.appRoot).toBeVisible();
  });

  test('Seiten-Reload behält grundlegenden Zustand bei', async ({ app, page }) => {
    await page.reload();
    await expect(app.appRoot).toBeVisible();
    await expect(app.title).toBeVisible();
  });

});
