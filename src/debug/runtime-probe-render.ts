/** RBD Runtime Probe — Render-Informationen (DEV-only, READ-ONLY). */

import type { RenderInfo } from './runtime-probe-types.js';
import { worldStore } from '../store/use-world-store';

export function getRenderInfo(): RenderInfo {
  const app = (window as Window & { __pixiApp?: unknown }).__pixiApp;
  if (!app) {
    return {
      pixiAppFound: false,
      rendererType: null,
      width: null,
      height: null,
      resolution: null,
      stageChildCount: null,
      totalNodes: null,
      byType: null,
      fps: null,
      tickerStarted: null,
    };
  }
  const a = app as {
    renderer?: { type?: string; width?: number; height?: number; resolution?: number };
    stage?: { children?: unknown[] };
    ticker?: { FPS?: number; started?: boolean };
  };
  return {
    pixiAppFound: true,
    rendererType: a.renderer?.type ?? null,
    width: a.renderer?.width ?? null,
    height: a.renderer?.height ?? null,
    resolution: a.renderer?.resolution ?? null,
    stageChildCount: a.stage?.children?.length ?? null,
    totalNodes: null,
    byType: null,
    fps: a.ticker?.FPS ?? null,
    tickerStarted: a.ticker?.started ?? null,
  };
}

export function compareRenderAndSim(): {
  sim: { tick: number; guests: number; furniture: number };
  render: { stageChildCount: number | null; totalNodes: number | null };
  aligned: boolean;
} | null {

  let view: { tick: number; guests: { length: number }; furniture: { length: number } } | null;
  try {
    view = worldStore.getSnapshot();
  } catch {
    return null;
  }
  const render = getRenderInfo();
  if (!view) return null;
  return {
    sim: { tick: view.tick, guests: view.guests.length, furniture: view.furniture.length },
    render: {
      stageChildCount: render.stageChildCount,
      totalNodes: render.totalNodes,
    },
    aligned: render.pixiAppFound === true,
  };
}
