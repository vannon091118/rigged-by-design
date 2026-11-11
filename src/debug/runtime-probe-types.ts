/** RBD Runtime Probe — Typen (DEV-only). */

/** Spielübersicht aus dem World Store. */
export type Overview = {
  template: string;
  tick: number;
  day: number;
  dayPhase: string;
  notice: string;
  lastEvent: string;
  ledgerOk: boolean;
  ledgerEntries: number;
  mood: number;
  reputation: number;
  wallet: string;
  playerCash: string;
  house: string;
  guests: number;
  furniture: number;
  stains: number;
  disputes: number;
};

/** Spieler-Zustand aus dem World Store. */
export type PlayerState = {
  position: { x: number; y: number };
  carrying: string;
  wallet: string;
  playerCash: string;
  look: unknown;
  career: unknown;
  job: unknown;
};

/** NPC-Zustand (Gast oder Agent). */
export type NpcState = {
  id: number;
  kind: 'guest' | 'agent';
  x: number;
  y: number;
  mood: number | null;
  pathIndex: number;
  pathLength: number;
};

/** Möbel-/Interaktionsobjekt-Zustand. */
export type FurnitureState = {
  id: number;
  kind: string;
  x: number;
  y: number;
  occupants: number[];
  mods: string[];
};

/** PixiJS Renderer-Informationen. */
export type RenderInfo = {
  pixiAppFound: boolean;
  rendererType: string | null;
  width: number | null;
  height: number | null;
  resolution: number | null;
  stageChildCount: number | null;
  totalNodes: number | null;
  byType: Record<string, number> | null;
  fps: number | null;
  tickerStarted: boolean | null;
};
