import { Page } from '@playwright/test';

/**
 * Store-Helfer für direkten Zugriff auf den WorldStore (falls global exponiert).
 *
 * Ermöglicht es, den Spielzustand direkt zu manipulieren, ohne über die UI zu gehen.
 * Dies ist nützlich für Edge-Case-Tests, die bestimmte Zustände provozieren müssen.
 */
export class StoreHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Prüft, ob der Store global erreichbar ist. */
  async isAvailable(): Promise<boolean> {
    return await page.evaluate(() =>
      Boolean((window as unknown as { __worldStore?: unknown }).__worldStore)
    );
  }

  /** Führt einen Tick manuell aus (wenn store.tickWorld verfügbar). */
  async tick(times = 1): Promise<void> {
    await page.evaluate(({ n }) => {
      const store = (window as unknown as { __worldStore?: { tickWorld?: () => void } }).__worldStore;
      if (store && typeof store.tickWorld === 'function') {
        for (let i = 0; i < n; i++) store.tickWorld();
      }
    }, { n: times });
  }

  /** Setzt einen bestimmten Welt-Zustand direkt (wenn verfügbar). */
  async setWorldState(state: unknown): Promise<void> {
    await page.evaluate(({ s }) => {
      const store = (window as unknown as { __worldStore?: { setState?: (s: unknown) => void } }).__worldStore;
      if (store && typeof store.setState === 'function') {
        store.setState(s);
      }
    }, { s: state });
  }

  /** Holt den aktuellen Snapshot als JSON. */
  async getSnapshot(): Promise<unknown> {
    return await page.evaluate(() => {
      const store = (window as unknown as { __worldStore?: { getSnapshot?: () => unknown } }).__worldStore;
      return store ? store.getSnapshot() : null;
    });
  }
}

export const storeHelper = (page: Page) => new StoreHelper(page);
