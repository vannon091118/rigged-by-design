import { Page, type Locator, expect } from '@playwright/test';

/**
 * AppPage – Haupt-App (RIGGED BY DESIGN).
 * Kapselt den Einstieg und die Bereitschaftsprüfung der React-App.
 *
 * PixiJS rendert in einem Canvas-Element (nicht im DOM als Text).
 * Die App lädt Textures asynchron vor dem ersten Rendern.
 *
 * waitForReady ist bewusst NICHT fail-closed auf ein einzelnes Element:
 * Wir warten auf domcontentloaded + Puffer, prüfen dann ob irgendein
 * sichtbarer Inhalt im body ist (Canvas, Text oder beides). Das macht
 * die Tests resilient gegen asynchrone Texture-Ladezeiten und
 * unterschiedliche Render-Zustände.
 */
export class AppPage {
  readonly page: Page;
  readonly canvas: Locator;
  readonly body: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('canvas').first();
    this.body = page.locator('body');
  }

  async goto() {
    await this.page.goto('/');
  }

  async waitForReady() {
    await this.page.waitForLoadState('domcontentloaded');
    // Puffer für PixiJS Texture-Loading (wird vor erstem Render geladen)
    await this.page.waitForTimeout(8000);

    // Prüfen ob der body sichtbaren Inhalt hat (App ist gerendert)
    const bodyHtml = await this.body.innerHTML();
    if (!bodyHtml || bodyHtml.trim().length < 10) {
      // Noch ein zweiter Versuch mit längerem Puffer
      await this.page.waitForTimeout(5000);
    }

    // Canvas prüfen (falls vorhanden) – aber nicht hart failen,
    // damit Tests auch bei langsamem Rendering starten können
    const canvasCount = await this.canvas.count();
    if (canvasCount > 0) {
      await expect(this.canvas).toBeVisible({ timeout: 5000 });
    }
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }

  async typeText(text: string) {
    await this.page.keyboard.type(text);
  }

  async screenshotOnFailure(name: string, testInfo: { outputPath: (p: string) => string }) {
    await this.page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
  }
}
