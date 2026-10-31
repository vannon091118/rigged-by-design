/**
 * Personal-Migration alter Speicherstaende.
 *
 * Der Guard lebte frueher als Flag neben den Agenten. Die Agenten sind jetzt die
 * einzige Wahrheit: das Flag wird gelesen, aber nie uebernommen, und ein Agent,
 * den das alte Spiel als eingestellt fuehrte, wird nachgetragen, statt still zu
 * verschwinden.
 */
import type { StaffState, WorldState } from '../core/sim/types';
import { spawnPoint } from '../core/sim/world';

interface LegacyStaff extends StaffState {
  readonly guard?: boolean;
}

/** Rollen-Flag ins heutige StaffState uebersetzen; Rueckgabe: war der Guard eingestellt? */
export function restoreStaff(world: WorldState, saved: unknown): boolean {
  const legacy = (saved ?? {}) as LegacyStaff;
  world.staff = {
    cleaner: legacy.cleaner ?? world.staff.cleaner,
    bartender: legacy.bartender ?? world.staff.bartender,
    cashier: legacy.cashier ?? world.staff.cashier,
    porter: legacy.porter ?? world.staff.porter,
  };
  return legacy.guard === true;
}

/** Fehlt der Guard-Agent zu einer alten Einstellung, wird er am Eingang nachgetragen. */
export function repairGuardAgent(world: WorldState, guardWasHired: boolean): void {
  if (!guardWasHired || world.agents.some((agent) => agent.role === 'guard')) return;
  const spawn = spawnPoint(world);
  world.agents.push({
    id: world.nextAgentId, role: 'guard', x: spawn.x, y: spawn.y, path: [], pathIndex: 0,
    carryingCrate: null, workTicks: 0, task: 'patrol', blockedReason: '', targetDisputeId: null,
  });
  world.nextAgentId += 1;
  world.guardsHired = Math.max(world.guardsHired, 1);
}
