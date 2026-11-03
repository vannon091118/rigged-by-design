import { Page, type Locator, expect } from '@playwright/test';

/**
 * HudPage – Kopfleiste mit Geld, Gästen, Ruf und den globalen Aktions-Buttons.
 *
 * Selektoren basieren auf sichtbarem Text und ARIA-Rollen (stabil gegenüber CSS-Änderungen).
 */
export class HudPage {
  readonly page: Page;

  // Geld-Anzeigen
  readonly houseMoney: Locator;        // HAUSKONTO
  readonly walletMoney: Locator;       // Portemonnaie
  readonly deskMoney: Locator;         // Wechselkasse
  readonly pendingMoney: Locator;      // Offene Gewinne

  // Vitals
  readonly guestsCount: Locator;       // GÄSTE
  readonly reputation: Locator;        // RUF %
  readonly dayDisplay: Locator;        // TAG X

  // Buttons (global)
  readonly btnSmartphone: Locator;
  readonly btnGuests: Locator;
  readonly btnVisit: Locator;
  readonly btnClean: Locator;
  readonly btnOverview: Locator;
  readonly btnJournal: Locator;
  readonly btnDiagnostics: Locator;
  readonly btnLook: Locator;
  readonly btnAssets: Locator;
  readonly btnHelp: Locator;
  readonly btnToggleSound: Locator;

  constructor(page: Page) {
    this.page = page;

    this.houseMoney = page.locator('.hud-money strong').first();
    this.walletMoney = page.getByText('Portemonnaie').locator('..').locator('strong');
    this.deskMoney = page.getByText('Wechselkasse').locator('..').locator('strong');
    this.pendingMoney = page.getByText('OFFENE GEWINNE').locator('..').locator('strong');

    this.guestsCount = page.getByText('GÄSTE').locator('..').locator('strong');
    this.reputation = page.getByText('RUF').locator('..').locator('strong');
    this.dayDisplay = page.getByText(/TAG \d+/);

    this.btnSmartphone = page.getByRole('button', { name: /Smartphone/i });
    this.btnGuests = page.getByRole('button', { name: /Gäste/i });
    this.btnVisit = page.getByRole('button', { name: /Besuchen|Fremdes Haus/i });
    this.btnClean = page.getByRole('button', { name: /Reinigen/i });
    this.btnOverview = page.getByRole('button', { name: /Übersicht/i });
    this.btnJournal = page.getByRole('button', { name: /Journal/i });
    this.btnDiagnostics = page.getByRole('button', { name: /Diagnostik/i });
    this.btnLook = page.getByRole('button', { name: /Aussehen|Look/i });
    this.btnAssets = page.getByRole('button', { name: /Assets|Bibliothek/i });
    this.btnHelp = page.getByRole('button', { name: /Hilfe/i });
    this.btnToggleSound = page.getByRole('button', { name: /Sound|Ton/i });
  }

  async expectHouseMoney(expected: string) {
    await expect(this.houseMoney).toHaveText(expected);
  }

  async expectWalletMoney(expected: string) {
    await expect(this.walletMoney).toHaveText(expected);
  }

  async expectGuestsCount(expected: number) {
    await expect(this.guestsCount).toHaveText(String(expected));
  }

  async expectReputation(expected: string) {
    await expect(this.reputation).toHaveText(expected);
  }

  async clickSmartphone() {
    await this.btnSmartphone.click();
  }

  async clickGuests() {
    await this.btnGuests.click();
  }

  async clickVisit() {
    await this.btnVisit.click();
  }

  async clickClean() {
    await this.btnClean.click();
  }

  async clickOverview() {
    await this.btnOverview.click();
  }

  async clickJournal() {
    await this.btnJournal.click();
  }

  async clickDiagnostics() {
    await this.btnDiagnostics.click();
  }

  async clickLook() {
    await this.btnLook.click();
  }

  async clickAssets() {
    await this.btnAssets.click();
  }

  async clickHelp() {
    await this.btnHelp.click();
  }

  async clickToggleSound() {
    await this.btnToggleSound.click();
  }
}
