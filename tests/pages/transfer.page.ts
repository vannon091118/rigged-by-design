import { Page, type Locator, expect } from '@playwright/test';

/**
 * TransferPage – Export/Import/Prüfung von Spielständen.
 *
 * Enthält Textarea für Export/Import und Buttons für Plan/Anwenden.
 */
export class TransferPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;
  readonly btnExport: Locator;
  readonly btnImport: Locator;
  readonly btnAudit: Locator;
  readonly exportTextarea: Locator;
  readonly importTextarea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Export|Import|Prüfung|Transfer|Spielstand/i });

    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
    this.btnExport = page.getByRole('button', { name: /Export/i });
    this.btnImport = page.getByRole('button', { name: /Import/i });
    this.btnAudit = page.getByRole('button', { name: /Prüfen|Audit/i });
    this.exportTextarea = page.locator('textarea').first();
    this.importTextarea = page.locator('textarea').last();
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async clickExport() {
    await this.btnExport.click();
  }

  async clickImport() {
    await this.btnImport.click();
  }

  async clickAudit() {
    await this.btnAudit.click();
  }

  async fillImport(text: string) {
    await this.importTextarea.fill(text);
  }

  async getExportText() {
    return this.exportTextarea.inputValue();
  }

  async expectImportOk() {
    await expect(this.root).not.toContainText(/FEHLER|FATAL|BLOCKING|UNGÜLTIG/i);
  }

  async expectImportFatal() {
    await expect(this.root).toContainText(/FEHLER|FATAL|BLOCKING|UNGÜLTIG/i);
  }
}
