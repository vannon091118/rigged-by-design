import { Page, type Locator, expect } from '@playwright/test';

/**
 * GamesPopupPage – Rivalen-Spiele-Popup (Blackjack, Risikokarte, Hütchenspiel, etc.).
 *
 * Enthält Einsätze, Risiko-Karten, Auszahlung, Selbstausschluss.
 */
export class GamesPopupPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;
  readonly btnTakeHome: Locator;
  readonly btnExclusion: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Rivalen|Blackjack|Risiko|Hütchenspiel|Karte|Zusatz-Einsatz|Auszahlung|Selbstausschluss/i });

    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
    this.btnTakeHome = page.getByRole('button', { name: /Nach Hause|Take Home|TakeHome/i });
    this.btnExclusion = page.getByRole('button', { name: /Selbstausschluss|Exclusion/i });
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickTakeHome() {
    await this.btnTakeHome.click();
  }

  async clickExclusion() {
    await this.btnExclusion.click();
  }
}
