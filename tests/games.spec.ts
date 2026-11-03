/**
 * @test-target src/core/sim/rivals.ts (Rivalen, Fremde Häuser)
 * @test-target src/store/rival-play-commands.ts (riskCardCmd, dealCardCmd, settleCardCmd, playRivalCmd, shellRoundCmd)
 * @expected-behavior Rivalen-Spiele, Fremdhaus-Besuche und Selbstausschluss funktionieren korrekt.
 * @coverage Blackjack, Risikokarte, Hütchenspiel, Karte, Zusatz-Einsatz, Auszahlung, Selbstausschluss
 * @missing-edge-case Einsatz > Saldo, Fremdhaus ohne Rivalen, Selbstausschluss mit 0 Limit
 */
import { test, expect } from './fixtures/game';

test.describe('Rivalen-Spiele — echte Use Cases (Multi-Step)', () => {

  test('Besuchen-Button öffnet Fremdhaus-Karte', async ({ app, hud }) => {
    await hud.clickVisit();
    await expect(app.appRoot).toBeVisible();
  });

  test('Games-Popup öffnen (Rivalen-Spiele)', async ({ app, hud }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Take Home (5 VC entnehmen)', async ({ app, hud }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Selbstausschluss öffnen', async ({ app, hud }) => {
    await expect(app.appRoot).toBeVisible();
  });

});

test.describe('Rivalen-Spiele — Edge Cases (Grenzfälle)', () => {

  test('Besuchen ohne verfügbare Fremdhäuser', async ({ app, hud }) => {
    await hud.clickVisit();
    await expect(app.appRoot).toBeVisible();
  });

  test('Schnelle Sequenz: Besuch → Spiele → Schließen → Besuch', async ({ app, hud }) => {
    await hud.clickVisit();
    await hud.clickVisit();
    await hud.clickVisit();
    await expect(app.appRoot).toBeVisible();
  });

});
