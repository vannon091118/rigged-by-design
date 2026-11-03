import { Page, type Locator, expect } from '@playwright/test';

/**
 * DiagnosticsPopupPage – Diagnostik / Ledger-Audit.
 *
 * Führt Ledger-Prüfungen durch und zeigt Integritäts-Ergebnisse.
 */
export class DiagnosticsPopupPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;
  readonly btnAudit: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Diagnostik|Diagnostics|Ledger|Audit/i });
    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
    this.btnAudit = page.getByRole('button', { name: /Audit|Prüfen/i });
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickAudit() {
    await this.btnAudit.click();
  }

  async expectIntegrityOk() {
    await expect(this.root).not.toContainText(/FEHLER|INTEGRITÄT|KORRUPT|FAIL/i);
  }
}
