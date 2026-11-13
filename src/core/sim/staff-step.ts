/** Gemeinsame Personal-Navigation: ein Feld pro Tick, alle sechs Ticks ein neuer Weg. */
import type { StaffAgent, WorldState } from './types';
import { pathTo } from './world';

export function setTask(agent: StaffAgent, task: StaffAgent['task'], blockedReason = ''): void {
  agent.task = task;
  agent.blockedReason = blockedReason;
}

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

export function stepToward(world: WorldState, agent: StaffAgent, tx: number, ty: number): boolean {
  agent.workTicks += 1;
  if (agent.x === tx && agent.y === ty) return true;
  if (agent.workTicks % 6 === 1 || agent.pathIndex >= agent.path.length) {
    agent.path = pathTo(world, { x: agent.x, y: agent.y }, { x: tx, y: ty });
    agent.pathIndex = 0;
  }
  if (agent.pathIndex < agent.path.length) {
    const next = agent.path[agent.pathIndex]!;
    agent.pathIndex += 1;
    agent.x = next.x;
    agent.y = next.y;
  }
  return agent.x === tx && agent.y === ty;
}
