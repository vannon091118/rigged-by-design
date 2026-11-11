/** CDP connection and tab management.
 *
 * Connects to an existing Chromium instance via CDP, ensures a game tab
 * (Tab 1) and a dashboard tab (Tab 2) exist in the same browser context.
 * All MCP actions target gamePage explicitly.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import type { GameScoutOptions, GameTabInfo, ViewportSize, SessionStatus } from './types.js';

const CDP_DEFAULT_ENDPOINT = 'http://127.0.0.1:9222';
const DASHBOARD_PATH = '/__gamescout__/dashboard';

export class CdpManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private gamePage: Page | null = null;
  private gameTitle = '';
  private dashboardPage: Page | null = null;
  private options: GameScoutOptions;

  constructor(options: GameScoutOptions) {
    this.options = {
      dashboardPort: 0,
      ...options,
      cdpEndpoint: options.cdpEndpoint ?? CDP_DEFAULT_ENDPOINT,
    };
  }

  async connect(): Promise<void> {
    this.browser = await chromium.connectOverCDP(this.options.cdpEndpoint);
    this.browser.on('disconnected', () => {
      this.browser = null;
      this.context = null;
      this.gamePage = null;
      this.dashboardPage = null;
    });

    const contexts = this.browser.contexts();
    this.context = contexts[0] || (await this.browser.newContext());

    await this.ensureGameTab();
  }

  private async ensureGameTab(): Promise<void> {
    if (!this.context) throw new Error('No browser context');

    // Look for an existing game tab (localhost:3000 or configured gameUrl)
    for (const page of this.context.pages()) {
      const url = page.url();
      if (
        url.includes('localhost:3000') ||
        (this.options.gameUrl && url.includes(new URL(this.options.gameUrl).hostname))
      ) {
        this.gamePage = page;
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        this.gameTitle = await page.title().catch(() => '');
        return;
      }
    }

    // No game tab found — create one
    this.gamePage = await this.context.newPage();
    await this.gamePage.goto(this.options.gameUrl ?? 'http://localhost:3000');
    await this.gamePage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    this.gameTitle = await this.gamePage.title().catch(() => '');
  }

  async ensureDashboardTab(dashboardUrl: string): Promise<void> {
    if (!this.context) throw new Error('No browser context');

    // Look for existing dashboard tab
    for (const page of this.context.pages()) {
      if (page.url().includes(dashboardUrl)) {
        this.dashboardPage = page;
        return;
      }
    }

    // Create dashboard tab
    this.dashboardPage = await this.context.newPage();
    await this.dashboardPage.goto(dashboardUrl);
    await this.dashboardPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.context = null;
    this.gamePage = null;
    this.dashboardPage = null;
    this.gameTitle = '';
  }

  getGamePage(): Page {
    if (!this.gamePage) throw new Error('Game tab not available');
    return this.gamePage;
  }

  getDashboardPage(): Page | null {
    return this.dashboardPage;
  }

  getBrowser(): Browser {
    if (!this.browser) throw new Error('Browser not connected');
    return this.browser;
  }

  getContext(): BrowserContext {
    if (!this.context) throw new Error('Browser context not available');
    return this.context;
  }

  async getGameTabInfo(): Promise<GameTabInfo> {
    const page = this.getGamePage();
    const viewport = page.viewportSize();
    return {
      url: page.url(),
      title: await page.title(),
      viewport: viewport ?? null,
    };
  }

  async getViewportSize(): Promise<ViewportSize | null> {
    const page = this.getGamePage();
    return page.viewportSize() ?? null;
  }

  getGameTitle(): string {
    return this.gameTitle;
  }

  isConnected(): boolean {
    return this.browser !== null && this.gamePage !== null && !this.gamePage.isClosed();
  }

  getStatus(): SessionStatus {
    if (!this.browser) return 'disconnected';
    if (!this.gamePage || this.gamePage.isClosed()) return 'error';
    return 'connected';
  }
}

export { CDP_DEFAULT_ENDPOINT, DASHBOARD_PATH };
