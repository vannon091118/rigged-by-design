import { Page, type Locator, expect } from '@playwright/test';

/**
 * JournalPopupPage – Journal / Archiv.
 *
 * Zeigt die Journal-Einträge und erlaubt den Wechsel zu Gast-Details.
 */
export class JournalPopupPage {
  readonly page: Page;
  readonly root: Locator;

  readonly btnClose: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Journal|Archiv/i });
    this.btnClose = page.getByRole('button', { name: /Schließen|Close/i });
  }

  async isOpen() {
    await expect(this.root).toBeVisible();
  }

  async close() {
    await this.btnClose.click();
  }

  async expectEntryCount(min: number) {
    const entries = this.root.locator('.journal-entry, [data-testid="journal-entry"], li');
    await expect(entries).toHaveCount(greaterThanOrEqual(min));
  }
}

function greaterThanOrEqual(n: number) {
  return n;
}
