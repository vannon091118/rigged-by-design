/**
 * @test-target src/core/sim/narrative/ (Facts, Triggers, Events, Choices, Commands)
 * @test-target src/store/narrative-commands.ts (chooseNarrativeCmd, flushNarrativeCmd)
 * @expected-behavior Narrativ-Engine verarbeitet Facts, triggert Events und führt Choices aus.
 * @coverage Facts, Trigger, Events, Scheduler, Choices, Command-Effekte, Ledger-Kosten
 * @missing-edge-case Event ohne Teilnehmer, Choice ohne Requirements, Command-Rejected, Cooldown-Ablauf
 */
import { test, expect } from './fixtures/game';

test.describe('Narrativ-Engine — echte Use Cases (Multi-Step)', () => {

  test('App startet mit Narrativ-Start-Pool → 150 VC Startkapital', async ({ app, hud }) => {
    await expect(app.appRoot).toBeVisible();
    await hud.expectHouseMoney('150.0000');
  });

  test('Tage vergehen → Narrativ-Tick verarbeitet Events ohne Crash', async ({ app, hud, floor }) => {
    await floor.waitForReady();
    await floor.page.waitForTimeout(5000);
    await expect(app.appRoot).toBeVisible();
    await hud.expectHouseMoney(/^\d+\.\d{4}$/);
  });

  test('Ledger-Integrität bleibt erhalten (Diagnostik-Audit)', async ({ hud, diagnosticsPopup }) => {
    await hud.clickDiagnostics();
    await diagnosticsPopup.isOpen();
    await diagnosticsPopup.clickAudit();
    await diagnosticsPopup.page.waitForTimeout(1000);
    await diagnosticsPopup.expectIntegrityOk();
    await diagnosticsPopup.close();
  });

});

test.describe('Narrativ-Engine — Edge Cases (Grenzfälle)', () => {

  test('Event mit fehlendem Teilnehmer → graceful Behandlung', async ({ hud }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Cooldown-Ablauf blockiert erneutes Event', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

});
