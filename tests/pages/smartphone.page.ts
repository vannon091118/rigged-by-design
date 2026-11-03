import { Page, type Locator, expect } from '@playwright/test';

/**
 * SmartphonePage – Smartphone-App (buy, build, clean, serve, travel).
 */
export class SmartphonePage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Smartphone|App|buy|build|clean|serve|travel/i });
    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }
}
