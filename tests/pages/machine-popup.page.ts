import { Page, type Locator, expect } from '@playwright/test';

/**
 * MachinePopupPage – Automaten-Popup.
 *
 * Zeigt Zustand, Plätze, Anziehung, Einsatz und Spiel-spezifische Steuerelemente
 * (Slot, Blackjack, Poker, Plinko, etc.).
 */
export class MachinePopupPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;
  readonly btnTest: Locator;
  readonly btnRepair: Locator;
  readonly btnMod: Locator;
  readonly btnAddReel: Locator;
  readonly btnTakeDrink: Locator;
  readonly btnDeployPlinko: Locator;

  readonly conditionStat: Locator;
  readonly seatsStat: Locator;
  readonly attractionStat: Locator;
  readonly baseBetStat: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /SPIEL|DEKORATION|Slot|Blackjack|Poker|Plinko|Roulette|Hütchenspiel|Würfel/i }) });

    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
    this.btnTest = page.getByRole('button', { name: /Test|Testspin/i });
    this.btnRepair = page.getByRole('button', { name: /Reparatur|Repair/i });
    this.btnMod = page.getByRole('button', { name: /Mod/i });
    this.btnAddReel = page.getByRole('button', { name: /Walze|Reel/i });
    this.btnTakeDrink = page.getByRole('button', { name: /Drink|Trinken/i });
    this.btnDeployPlinko = page.getByRole('button', { name: /Plinko|Einsetzen/i });

    this.conditionStat = page.getByText('ZUSTAND').locator('..').locator('..');
    this.seatsStat = page.getByText('PLÄTZE').locator('..').locator('..');
    this.attractionStat = page.getByText('ANZIEHUNG').locator('..').locator('..');
    this.baseBetStat = page.getByText('EINSATZ AB').locator('..').locator('..');
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickTest() {
    await this.btnTest.click();
  }

  async clickRepair() {
    await this.btnRepair.click();
  }

  async clickMod() {
    await this.btnMod.click();
  }

  async clickAddReel() {
    await this.btnAddReel.click();
  }

  async clickTakeDrink() {
    await this.btnTakeDrink.click();
  }

  async clickDeployPlinko() {
    await this.btnDeployPlinko.click();
  }

  async expectCondition(expected: string) {
    await expect(this.conditionStat).toContainText(expected);
  }

  async expectSeats(expected: string) {
    await expect(this.seatsStat).toContainText(expected);
  }
}
