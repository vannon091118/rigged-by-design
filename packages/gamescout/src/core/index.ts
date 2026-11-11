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
import type { GameScoutOptions, SessionState, Checkpoint } from './types.js';

class GameScoutCore {
  readonly options: GameScoutOptions;
  readonly cdp: CdpManager;
  readonly session: Session;
  readonly actions: ActionController;
  readonly recording: RecordingController;
  readonly checkpoints: CheckpointController;

  constructor(options: GameScoutOptions) {
    this.options = options;
    this.session = new Session(options);
    this.cdp = this.session.cdp;
    this.actions = new ActionController(this.cdp);
    this.recording = new RecordingController(this.cdp);
    this.checkpoints = new CheckpointController();
  }

  async connect(): Promise<void> {
    await this.session.connect();
  }

  async disconnect(): Promise<void> {
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

  isConnected(): boolean {
    return this.cdp.isConnected();
  }

  getVersion(): string {
    return '1.0.0';
  }
}

export { GameScoutCore };
export type { GameScoutOptions, SessionState, Checkpoint };
