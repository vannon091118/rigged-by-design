/** RBD Runtime Probe — Welt-Snapshot-Funktionen (DEV-only, READ-ONLY). */

import { worldStore } from '../store/use-world-store';
import type { GameView } from '../store/types';
import type { Overview, PlayerState, NpcState, FurnitureState } from './runtime-probe-types.js';

function safeSnapshot(): GameView | null {
  try {
    return worldStore.getSnapshot();
  } catch {
    return null;
  }
}

export function getOverview(): Overview | null {
  const view = safeSnapshot();
  if (!view) return null;
  return {
    template: view.template,
    tick: view.tick,
    day: view.day,
    dayPhase: String(view.dayPhase),
    notice: view.notice,
    lastEvent: view.lastEvent,
    ledgerOk: view.ledgerOk,
    ledgerEntries: view.ledgerEntries,
    mood: view.mood,
    reputation: view.reputation,
    wallet: String(view.wallet),
    playerCash: String(view.playerCash),
    house: String(view.house),
    guests: view.guests.length,
    furniture: view.furniture.length,
    stains: view.stains.length,
    disputes: view.disputes.length,
  };
}

export function getWorldState(): GameView | null {
  return safeSnapshot();
}

export function getPlayerState(): PlayerState | null {
  const view = safeSnapshot();
  if (!view) return null;
  const p = view.player;
  return {
    position: { x: p.position.x, y: p.position.y },
    carrying: p.carrying,
    wallet: String(view.wallet),
    playerCash: String(view.playerCash),
    look: view.look,
    career: view.career,
    job: view.playerJob,
  };
}

export function getNpcStates(): { guests: NpcState[]; agents: NpcState[] } {
  const view = safeSnapshot();
  const guests: NpcState[] = (view?.guests ?? []).map((g) => ({
    id: g.id,
    kind: 'guest' as const,
    x: g.position.x,
    y: g.position.y,
    mood: typeof g.mood === 'number' ? g.mood : null,
    pathIndex: g.pathIndex ?? 0,
    pathLength: g.path?.length ?? 0,
  }));
  const agents: NpcState[] = (view?.agents ?? []).map((a) => ({
    id: a.id,
    kind: 'agent' as const,
    x: a.x,
    y: a.y,
    mood: null,
    pathIndex: a.pathIndex ?? 0,
    pathLength: a.path?.length ?? 0,
  }));
  return { guests, agents };
}

export function getFurniture(): FurnitureState[] {
  const view = safeSnapshot();
  return (view?.furniture ?? []).map((f) => ({
    id: f.id,
    kind: String(f.kind),
    x: f.x,
    y: f.y,
    occupants: [...(f.occupants ?? [])],
    mods: [...(f.mods ?? [])],
  }));
}

export function getRecentEvents(limit = 50): { journal: unknown[]; archiveCount: number } {
  const view = safeSnapshot();
  const journal = view?.journal ?? [];
  const recent = journal.slice(Math.max(0, journal.length - limit));
  return {
    journal: recent,
    archiveCount: view?.archive?.length ?? 0,
  };
}
