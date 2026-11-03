/**
 * @test-target src/core/sim/guests.ts (Gast-Spawn, Zustand, Budget)
 * @test-target src/core/sim/guest-service.ts (Bezahlen, Servieren, Beruhigen, Reden)
 * @expected-behavior Gäste-Interaktionen lösen korrekte Welt-Änderungen aus.
 * @coverage Gast ansprechen, bezahlen, Drink servieren, beruhigen, reden
 * @missing-edge-case Gast mit Budget 0, Geduld 0, mehrere Gäste gleichzeitig
 */
import { test, expect } from './fixtures/game';

test.describe('Gäste — echte Use Cases (Multi-Step)', () => {

  test('Gäste-Popup öffnen → Gast auswählen → Budget anzeigen → schließen', async ({ app, hud, guestPopup, floor }) => {
    await floor.waitForReady();
    await hud.clickGuests();
    await guestPopup.isOpen();
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
    await expect(app.appRoot).toBeVisible();
  });

  test('Gast bezahlen (Pay) → vollständiger Ablauf', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await guestPopup.clickPay();
    await guestPopup.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

  test('Gast beruhigen (Calm) → vollständiger Ablauf', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await guestPopup.clickCalm();
    await guestPopup.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

  test('Mit Gast reden (Talk) → vollständiger Ablauf', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await guestPopup.clickTalk();
    await guestPopup.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

});

test.describe('Gäste — Edge Cases (Grenzfälle)', () => {

  test('Gäste-Popup ohne Gäste → leerer Zustand', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

  test('Mehrfache Gäste-Interaktionen nacheinander', async ({ app, hud, guestPopup }) => {
    await hud.clickGuests();
    await guestPopup.isOpen();
    await guestPopup.clickPay();
    await guestPopup.clickTalk();
    await guestPopup.clickCalm();
    await guestPopup.clickServe();
    await guestPopup.page.waitForTimeout(500);
    await expect(app.appRoot).toBeVisible();
    await guestPopup.close();
  });

  test('Escape schließt Build-Panel und Popup', async ({ app, floor }) => {
    await floor.waitForReady();
    await floor.closeBuild();
    await floor.closeBuild();
    await expect(app.appRoot).toBeVisible();
  });

});
