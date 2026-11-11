/** GameScout Core — main entry point.
 *
 * Composes CDP manager, session, action controller, recording controller,
 * and checkpoint controller into a single facade. Engine-independent:
 * no PixiJS, no React, no RBD assumptions.
 */

import { CdpManager } from './cdp.js';
import { Session } from './session.js';
import { ActionController } from './actions.js';
import { RecordingController } from './recording.js';
import { CheckpointController } from './checkpoint.js';
import { PeerMcpManager } from './peer-mcps.js';
import type { GameScoutOptions, SessionState, Checkpoint } from './types.js';

class GameScoutCore {
  readonly options: GameScoutOptions;
  readonly cdp: CdpManager;
  readonly session: Session;
  readonly actions: ActionController;
  readonly recording: RecordingController;
  readonly checkpoints: CheckpointController;
  readonly peers: PeerMcpManager;

  constructor(options: GameScoutOptions) {
    this.options = options;
    this.session = new Session(options);
    this.cdp = this.session.cdp;
    this.actions = new ActionController(this.cdp);
    this.recording = new RecordingController(this.cdp);
    this.checkpoints = new CheckpointController();
    this.peers = new PeerMcpManager(options.gameUrl);
  }

  async connect(): Promise<void> {
    await this.session.connect();
  }

  async disconnect(): Promise<void> {
    await this.peers.close().catch(() => {});
    await this.session.disconnect();
  }

  async ensureDashboardTab(dashboardUrl: string): Promise<void> {
    await this.session.ensureDashboardTab(dashboardUrl);
  }

  getSnapshot(): SessionState {
    return {
      id: this.session.id,
      status: this.session.status,
      cdpEndpoint: this.options.cdpEndpoint,
      gameTab: this.session.getGameTabInfo(),
      dashboardTab: null,
      version: '1.0.0',
      lastError: this.session.lastError,
      recording: this.session.recording,
      timeline: [...this.session.timeline],
    };
  }

  async getPeerTools(peerName?: 'chrome-devtools' | 'pixijs') {
    return this.peers.listReadOnlyTools(peerName);
  }

  async callPeerTool(
    peerName: 'chrome-devtools' | 'pixijs',
    toolName: string,
    args: Record<string, unknown> = {},
  ) {
    return this.peers.callReadOnlyTool(peerName, toolName, args);
  }

  async getRuntimeProbe(method = 'getOverview', args: unknown[] = []): Promise<unknown> {
    const allowed = new Set([
      'getOverview',
      'getWorldState',
      'getPlayerState',
      'getNpcStates',
      'getFurniture',
      'getRecentEvents',
      'getRenderInfo',
      'compareRenderAndSim',
    ]);
    if (!allowed.has(method)) throw new Error(`Runtime-Probe-Methode '${method}' ist nicht erlaubt.`);
    const page = this.cdp.getGamePage();
    return page.evaluate(
      ({ probeMethod, probeArgs }) => {
        const probe = (window as Window & { __rbdProbe?: Record<string, (...args: unknown[]) => unknown> }).__rbdProbe;
        if (!probe || typeof probe[probeMethod] !== 'function') {
          return { available: false, method: probeMethod, result: null, error: 'window.__rbdProbe ist nicht verfügbar (DEV-only).' };
        }
        try {
          return { available: true, method: probeMethod, result: probe[probeMethod](...probeArgs) };
        } catch (error) {
          return { available: true, method: probeMethod, result: null, error: error instanceof Error ? error.message : String(error) };
        }
      },
      { probeMethod: method, probeArgs: args },
    );
  }

  async getPlayerQaSnapshot(options: { fullPage?: boolean; includeConsole?: boolean; includeNetwork?: boolean } = {}): Promise<Record<string, unknown>> {
    const fullPage = options.fullPage !== false;
    const includeConsole = options.includeConsole !== false;
    const includeNetwork = options.includeNetwork !== false;
    const preview = await this.actions.preview(fullPage);
    const gameTab = this.getSnapshot().gameTab;
    const runtimeProbe = await this.getRuntimeProbe('getOverview');
    const renderComparison = await this.getRuntimeProbe('compareRenderAndSim');
    const peerTools = await this.getPeerTools().catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));

    const snapshot: Record<string, unknown> = {
      capturedWith: 'gamescout-player-qa',
      gameTab,
      screenshotBase64: preview.screenshotBase64,
      screenshotMimeType: 'image/png',
      runtimeProbe,
      renderComparison,
      peerTools,
      consoleMessages: null,
      networkRequests: null,
    };

    if (includeConsole) {
      try {
        const pages = await this.callPeerTool('chrome-devtools', 'list_pages', {});
        const pageId = this.findChromePageId(pages, gameTab?.url);
        snapshot.consoleMessages = await this.callPeerTool(
          'chrome-devtools',
          'list_console_messages',
          pageId === null ? {} : { pageId, pageSize: 100, includeStackTraces: true },
        );
      } catch (error) {
        snapshot.consoleMessages = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    if (includeNetwork) {
      try {
        const pages = await this.callPeerTool('chrome-devtools', 'list_pages', {});
        const pageId = this.findChromePageId(pages, gameTab?.url);
        snapshot.networkRequests = await this.callPeerTool(
          'chrome-devtools',
          'list_network_requests',
          pageId === null ? {} : { pageId, pageSize: 100 },
        );
      } catch (error) {
        snapshot.networkRequests = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    return snapshot;
  }

  private findChromePageId(result: unknown, gameUrl?: string | null): number | null {
    const candidates = this.extractChromePages(result);
    if (candidates.length === 0) return null;
    if (gameUrl) {
      try {
        const host = new URL(gameUrl).hostname;
        const exact = candidates.find((page) => page.url.includes(host) || page.url.includes('localhost:3000'));
        if (exact) return exact.pageId;
      } catch {
        // Fall through to first available page.
      }
    }
    return candidates[0].pageId;
  }

  private extractChromePages(result: unknown): { pageId: number; url: string }[] {
    const text = this.mcpResultText(result);
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as unknown;
      const pages = Array.isArray(parsed) ? parsed : (parsed as { pages?: unknown }).pages;
      if (!Array.isArray(pages)) return [];
      return pages
        .map((page) => {
          if (!page || typeof page !== 'object') return null;
          const record = page as Record<string, unknown>;
          const pageId = typeof record.pageId === 'number' ? record.pageId : typeof record.id === 'number' ? record.id : null;
          const url = typeof record.url === 'string' ? record.url : '';
          return pageId === null ? null : { pageId, url };
        })
        .filter((page): page is { pageId: number; url: string } => page !== null);
    } catch {
      return [];
    }
  }

  private mcpResultText(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null;
    const content = (result as { content?: unknown }).content;
    if (!Array.isArray(content)) return null;
    const textPart = content.find((part) => part && typeof part === 'object' && (part as { type?: unknown }).type === 'text' && typeof (part as { text?: unknown }).text === 'string');
    return textPart ? String((textPart as { text: string }).text) : null;
  }

  isConnected(): boolean {
    return this.cdp.isConnected();
  }

  getVersion(): string {
    return '1.0.0';
  }
}

export { GameScoutCore };
export { PeerMcpManager } from './peer-mcps.js';
export type { PeerMcpName, PeerToolSummary } from './peer-mcps.js';
export type { GameScoutOptions, SessionState, Checkpoint };
