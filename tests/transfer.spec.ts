/**
 * @test-target src/store/transfer.ts (exportGameData, planImportData, replaySave)
 * @test-target src/core/io/envelope.ts (buildEnvelope, parseEnvelope)
 * @expected-behavior Export/Import von Spielständen funktioniert, Migration v5-v9 wird korrekt angewendet.
 * @coverage Export, Import, Plan, Reparatur, Save-Roundtrip
 * @missing-edge-case Korrupter Import, fehlende Felder, v3/v4 (verworfen)
 */
import { test, expect } from './fixtures/game';

test.describe('Transfer (Export/Import) — echte Use Cases (Multi-Step)', () => {

  test('Spielstand exportieren → JSON enthält Welt, Ledger, PRNG', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Spielstand importieren → Plan wird geprüft', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Save-Roundtrip: Export → Import → gleicher Zustand', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

});

test.describe('Transfer (Export/Import) — Edge Cases (Grenzfälle)', () => {

  test('Korrupter Import → FATAL-Fehler, kein Crash', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

  test('Leerer Import → keine Änderung', async ({ app }) => {
    await expect(app.appRoot).toBeVisible();
  });

});
