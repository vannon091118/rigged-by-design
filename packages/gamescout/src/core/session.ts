/** Session state management for GameScout.
 *
 * Holds the canonical session state: CDP connection, tabs, recording,
 * checkpoints, timeline, and last error. Single source of truth shared
 * between Core, MCP server, and Dashboard HTTP server.
 */

import type {
  Checkpoint,
  GameScoutOptions,
  GameTabInfo,
  RecordedAction,
  ReplayResult,
  SessionState,
  SessionStatus,
  TimelineEvent,
} from './types.js';
import { CdpManager } from './cdp.js';

export class Session {
  readonly id: string;
  readonly options: GameScoutOptions;
  readonly cdp: CdpManager;
  readonly checkpoints: Map<string, Checkpoint> = new Map();
  recordedActions: RecordedAction[] = [];
  readonly timeline: TimelineEvent[] = [];
  recording = false;
  lastError: string | null = null;

  constructor(options: GameScoutOptions) {
    this.id = crypto.randomUUID();
    this.options = options;
    this.cdp = new CdpManager(options);
  }

  get status(): SessionStatus {
    return this.cdp.getStatus();
  }

  async connect(): Promise<void> {
    this.lastError = null;
    try {
      await this.cdp.connect();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.recording = false;
    this.recordedActions = [];
    await this.cdp.disconnect();
  }

  async ensureDashboardTab(dashboardUrl: string): Promise<void> {
    await this.cdp.ensureDashboardTab(dashboardUrl);
  }

  getGameTabInfo(): GameTabInfo | null {
    if (!this.cdp.isConnected()) return null;
    try {
      return {
        url: this.cdp.getGamePage().url(),
        title: '',
        viewport: this.cdp.getGamePage().viewportSize() ?? null,
      };
    } catch {
      return null;
    }
  }

  addTimelineEvent(event: Omit<TimelineEvent, 'id' | 'timestamp'>): void {
    const entry: TimelineEvent = {
      id: (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.timeline.push(entry);
    // Keep timeline bounded
    if (this.timeline.length > 500) {
      this.timeline.shift();
    }
  }

  async getSnapshot(): Promise<SessionState> {
    return {
      id: this.id,
      status: this.status,
      cdpEndpoint: this.options.cdpEndpoint,
      gameTab: await this.cdp.getGameTabInfo(),
      dashboardTab: null, // filled by dashboard server if needed
      version: '1.0.0',
      lastError: this.lastError,
      recording: this.recording,
      timeline: [...this.timeline],
    };
  }

  createCheckpoint(
    name: string,
    observation: unknown | null,
    screenshotBase64: string,
    url: string,
    title: string
  ): Checkpoint {
    const id = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
    const checkpoint: Checkpoint = {
      id,
      name: name || `checkpoint-${id}`,
      timestamp: new Date().toISOString(),
      url,
      title,
      screenshotBase64,
      observation,
    };
    this.checkpoints.set(id, checkpoint);
    this.addTimelineEvent({
      type: 'checkpoint',
      description: `Checkpoint "${checkpoint.name}" erstellt`,
      artifactId: id,
    });
    return checkpoint;
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).reverse();
  }

  recordAction(action: RecordedAction): void {
    if (!this.recording) return;
    this.recordedActions.push(action);
    this.addTimelineEvent({
      type: 'action',
      description: `Aktion: ${action.type}`,
      data: action.data,
    });
  }

  startRecording(): void {
    this.recording = true;
    this.recordedActions = [];
    this.addTimelineEvent({ type: 'action', description: 'Recording gestartet' });
  }

  stopRecording(): RecordedAction[] {
    const actions = [...this.recordedActions];
    this.recording = false;
    this.addTimelineEvent({ type: 'action', description: 'Recording gestoppt' });
    return actions;
  }

  setError(message: string): void {
    this.lastError = message;
    this.addTimelineEvent({ type: 'error', description: message });
  }

  clearError(): void {
    this.lastError = null;
  }
}
