/** Shared types for GameScout Core. Engine-independent. */

export type Point = { x: number; y: number };

export type ViewportSize = { width: number; height: number };

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GameTabInfo {
  url: string;
  title: string;
  viewport: ViewportSize | null;
}

export interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  url: string;
  title: string;
  screenshotBase64: string;
  observation: unknown | null;
}

export interface RecordedAction {
  type: 'click' | 'press_key' | 'navigate';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ReplayResult {
  replayed: number;
  total: number;
  inconclusive: boolean;
  preConditions: { viewport: ViewportSize | null; url: string; title: string };
  postConditions: { viewport: ViewportSize | null; url: string; title: string };
  viewportMatch: boolean;
  urlMatch: boolean;
  pixelDiff: { count: number; percent: number };
  preCheckpointId: string | null;
  replayCheckpointIds: string[];
}

export interface CompareResult {
  compared: true;
  checkpoint1: { id: string; name: string; timestamp: string };
  checkpoint2: { id: string; name: string; timestamp: string };
  imageDimensions: { width: number; height: number };
  pixelDiff: { count: number; percent: number };
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  screenshotIdentical: boolean;
  urlChanged: boolean;
  titleChanged: boolean;
  observationChanged: boolean;
}

export interface TimelineEvent {
  id: string;
  type: 'action' | 'screenshot' | 'checkpoint' | 'annotation' | 'event' | 'error' | 'replay';
  timestamp: string;
  description: string;
  data?: Record<string, unknown>;
  artifactId?: string;
}

export interface EngineAdapter {
  name: string;
  available(): boolean;
  getRenderInfo(): Promise<unknown>;
  getSceneInfo(): Promise<unknown>;
}

export interface GameScoutOptions {
  cdpEndpoint: string;
  dashboardPort?: number;
  gameUrl?: string;
  sessionToken?: string;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  cdpEndpoint: string;
  gameTab: GameTabInfo | null;
  dashboardTab: GameTabInfo | null;
  version: string;
  lastError: string | null;
  recording: boolean;
  timeline: TimelineEvent[];
}
