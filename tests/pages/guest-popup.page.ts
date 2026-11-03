import { Page, type Locator, expect } from '@playwright/test';

/**
 * GuestPopupPage – Gäste-Popup (LIVE AM FLOOR).
 *
 * Enthält Budget-Bars, Laune/Geduld/Sucht und die Aktions-Buttons:
 * DRINK GEBEN, BEZAHLEN, BERUHIGEN, REDEEN, PRÜGELEN.
 */
export class GuestPopupPage {
  readonly page: Page;
  readonly root: Locator;

  // Buttons
  readonly btnPay: Locator;
  readonly btnServe: Locator;
  readonly btnCalm: Locator;
  readonly btnTalk: Locator;
  readonly btnFight: Locator;
  readonly btnClose: Locator;

  // Anzeigen
  readonly guestName: Locator;
  readonly guestPersona: Locator;
  readonly guestBudget: Locator;
  readonly moodBar: Locator;
  readonly patienceBar: Locator;
  readonly addictionBar: Locator;

  // Leer-Zustand
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /LIVE AM FLOOR|Gäste/ });

    this.btnPay = page.getByRole('button', { name: /BEZAHLEN|Pay/i });
    this.btnServe = page.getByRole('button', { name: /DRINK GEBEN|Serve/i });
    this.btnCalm = page.getByRole('button', { name: /BERUHIGEN|Calm/i });
    this.btnTalk = page.getByRole('button', { name: /REDEEN|Talk/i });
    this.btnFight = page.getByRole('button', { name: /PRÜGELEN|Fight|Brawl/i });
    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });

    this.guestName = page.getByRole('heading', { name: /Gäste/ }).locator('..').locator('strong').first();
    this.guestBudget = page.getByText('BUDGET').locator('..').locator('strong');
    this.moodBar = page.getByText('LAUNE').locator('..').locator('..');
    this.patienceBar = page.getByText('GEDULD').locator('..').locator('..');
    this.addictionBar = page.getByText('SUCHT').locator('..').locator('..');
    this.emptyState = page.getByText(/Noch niemand da/);
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickPay() {
    await this.btnPay.click();
  }

  async clickServe() {
    await this.btnServe.click();
  }

  async clickCalm() {
    await this.btnCalm.click();
  }

  async clickTalk() {
    await this.btnTalk.click();
  }

  async clickFight() {
    await this.btnFight.click();
  }

  async expectBudget(expected: string) {
    await expect(this.guestBudget).toHaveText(expected);
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible();
  }
}
