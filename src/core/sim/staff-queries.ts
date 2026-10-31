/**
 * Die eine Personalabfrage.
 *
 * Alles, was Personalwirkung braucht, liest hier – und hier steht ausschliesslich
 * der Agentenbestand. Ein zweites Ja/Nein neben den Agenten waere eine zweite
 * Wahrheit, die loegt, sobald beide auseinanderlaufen: eingestellt heisst, dass
 * ein Agent existiert, im Dienst heisst, dass er nicht steckt.
 */
import type { Point, StaffAgent, StaffRole, WorldState } from './types';

const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/** Alle Angestellten einer Rolle. */
export function staffAgents(world: WorldState, role: StaffRole): StaffAgent[] {
  return world.agents.filter((agent) => agent.role === role);
}

/** Angestellt: ein Agent dieser Rolle existiert. */
export function hasStaff(world: WorldState, role: StaffRole): boolean {
  return world.agents.some((agent) => agent.role === role);
}

/** Im Dienst: vorhanden und nicht blockiert. Wer steckt, wirkt nicht. */
function isOnDuty(agent: StaffAgent): boolean {
  return agent.blockedReason === '';
}

function onDutyStaff(world: WorldState, role: StaffRole): StaffAgent[] {
  return staffAgents(world, role).filter(isOnDuty);
}

/**
 * Bestand und Einsatz einer Rolle in einem Wert: abwesend (niemand eingestellt),
 * inaktiv (alle stecken), verfügbar (jemand könnte los) oder beschäftigt
 * (jemand arbeitet gerade einer Aufgabe nach).
 */
export function getStaffAvailability(
  world: WorldState, role: StaffRole,
): 'ABWESEND' | 'INAKTIV' | 'VERFUEGBAR' | 'BESCHAEFTIGT' {
  const agents = staffAgents(world, role);
  if (agents.length === 0) return 'ABWESEND';
  const duty = agents.filter(isOnDuty);
  if (duty.length === 0) return 'INAKTIV';
  const busy = duty.some((agent) => agent.task !== 'patrol' && agent.task !== 'idle');
  return busy ? 'BESCHAEFTIGT' : 'VERFUEGBAR';
}

/** Wie viele diensttuende Agenten einer Rolle stehen in der Reichweite? */
export function agentsInRange(
  world: WorldState, point: Point, range: number, role?: StaffRole,
): number {
  return world.agents.filter((agent) => (
    (role === undefined || agent.role === role)
    && isOnDuty(agent)
    && distance(agent.x, agent.y, point.x, point.y) <= range
  )).length;
}

/** Deckt diese Rolle den Punkt? Reichweite ist hier der entscheidende Teil. */
export function getStaffCoverage(
  world: WorldState, role: StaffRole, point: Point, range: number,
): boolean {
  return onDutyStaff(world, role).some(
    (agent) => distance(agent.x, agent.y, point.x, point.y) <= range,
  );
}

/** Ein Guard, der im Dienst ist – ohne ihn gibt es keine Guard-Wirkung. */
export function hasActiveGuard(world: WorldState): boolean {
  return onDutyStaff(world, 'guard').length > 0;
}
