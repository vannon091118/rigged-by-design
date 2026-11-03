import { Page, type Locator, expect } from '@playwright/test';

/**
 * BuildPanelPage – Bau-Panel (Bauen, Einstellen/Entlassen, Preise, Teppich, Reparatur,
 * Reinigen, Abholen, Entladen, Bestellen, Upgrade, Wand, Neon, Servieren, Schlichten).
 */
export class BuildPanelPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;
  readonly btnBuy: Locator;
  readonly btnHire: Locator;
  readonly btnFire: Locator;
  readonly btnRepair: Locator;
  readonly btnClean: Locator;
  readonly btnPickup: Locator;
  readonly btnUnload: Locator;
  readonly btnOrderDrinks: Locator;
  readonly btnOrderParts: Locator;
  readonly btnUpgradeBar: Locator;
  readonly btnUpgradeWc: Locator;
  readonly btnServeDesk: Locator;
  readonly btnCalm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Bau|Build|Panel|Einstellen|Entlassen|Preise|Teppich|Reparatur|Reinigen|Abholen|Entladen|Bestellen|Upgrade|Wand|Neon|Servieren|Schlichten/i });

    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
    this.btnBuy = page.getByRole('button', { name: /Kaufen|Buy/i });
    this.btnHire = page.getByRole('button', { name: /Einstellen|Hire/i });
    this.btnFire = page.getByRole('button', { name: /Entlassen|Fire/i });
    this.btnRepair = page.getByRole('button', { name: /Reparatur|Repair/i });
    this.btnClean = page.getByRole('button', { name: /Reinigen|Clean/i });
    this.btnPickup = page.getByRole('button', { name: /Abholen|Pickup/i });
    this.btnUnload = page.getByRole('button', { name: /Entladen|Unload/i });
    this.btnOrderDrinks = page.getByRole('button', { name: /Getränke|Drinks/i });
    this.btnOrderParts = page.getByRole('button', { name: /Ersatzteile|Parts/i });
    this.btnUpgradeBar = page.getByRole('button', { name: /Bar.*Upgrade|Bar aufrüsten/i });
    this.btnUpgradeWc = page.getByRole('button', { name: /WC.*Upgrade|WC aufrüsten/i });
    this.btnServeDesk = page.getByRole('button', { name: /Servieren|Serve Desk/i });
    this.btnCalm = page.getByRole('button', { name: /Schlichten|Calm/i });
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickBuy() {
    await this.btnBuy.click();
  }

  async clickHire() {
    await this.btnHire.click();
  }

  async clickFire() {
    await this.btnFire.click();
  }

  async clickRepair() {
    await this.btnRepair.click();
  }

  async clickClean() {
    await this.btnClean.click();
  }

  async clickPickup() {
    await this.btnPickup.click();
  }

  async clickUnload() {
    await this.btnUnload.click();
  }

  async clickOrderDrinks() {
    await this.btnOrderDrinks.click();
  }

  async clickOrderParts() {
    await this.btnOrderParts.click();
  }

  async clickUpgradeBar() {
    await this.btnUpgradeBar.click();
  }

  async clickUpgradeWc() {
    await this.btnUpgradeWc.click();
  }

  async clickServeDesk() {
    await this.btnServeDesk.click();
  }

  async clickCalm() {
    await this.btnCalm.click();
  }
}
