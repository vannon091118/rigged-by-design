/** Personal: eingestellte Rollen bekommen einen Körper, der auf dem Floor arbeitet. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { HAUSKONTO, STAFF } from './money';
import type { Prng } from '../rng/prng';
import type { StaffAgent, StaffRole, WorldState } from './types';
import { GUARD_HANDLE_RANGE, nearestDispute } from './disputes';
import { interactionPoint, pathTo, spawnPoint } from './world';
import { cashierTick } from './staff-cashier';
import { porterTick } from './staff-porter';
import { dist, setTask, stepToward } from './staff-step';

export { CASHIER_WAIT } from './staff-cashier';

function wageFor(world: WorldState, role: StaffRole): VaCoinMicro {
  if (role === 'guard') return world.prices.guardWage;
  if (role === 'cashier') return world.prices.cashierWage;
  if (role === 'porter') return world.prices.porterWage;
  return world.prices.staffWage;
}

/** Einstellen kostet einmalig einen Tagessatz und stellt den Agenten an den Eingang. */
export function hireAgent(world: WorldState, ledger: Ledger, role: StaffRole): StaffAgent {
  const existing = world.agents.find((agent) => agent.role === role);
  if (existing) return existing;
  ledger.transfer(HAUSKONTO, STAFF, wageFor(world, role), 'einstellung', world.tick);
  // Der Guard besitzt kein zweites Ja/Nein mehr: sein Agent ist die Anstellung.
  if (role === 'guard') world.guardsHired += 1;
  else world.staff[role] = true;
  const spawn = spawnPoint(world);
  const agent: StaffAgent = {
    id: world.nextAgentId++, role, x: spawn.x, y: spawn.y, path: [], pathIndex: 0,
    carryingCrate: null, workTicks: 0, task: 'idle', blockedReason: '', targetDisputeId: null,
  };
  world.agents.push(agent);
  world.lastEvent = `${role === 'guard' ? 'Guard' : role === 'cleaner' ? 'Reinigungskraft'
    : role === 'bartender' ? 'Barkeeper' : role === 'cashier' ? 'Kassierer' : 'Lagerträger'} eingestellt.`;
  recordJournal(world, {
    kind: 'STAFF', subject: role, cause: 'Einstellung', effect: world.lastEvent, refs: { agentId: agent.id },
  });
  return agent;
}

export function fireAgent(world: WorldState, role: StaffRole): void {
  if (role !== 'guard') world.staff[role] = false;
  world.agents = world.agents.filter((agent) => agent.role !== role);
  for (const crate of world.crates) {
    if (typeof crate.carriedBy === 'number' && !world.agents.some((agent) => agent.id === crate.carriedBy)) {
      crate.carriedBy = null;
    }
  }
  world.lastEvent = 'Personal entlassen.';
  recordJournal(world, { kind: 'STAFF', subject: role, cause: 'Entlassung', effect: world.lastEvent });
}

function guardTick(world: WorldState, agent: StaffAgent, prng: Prng): void {
  // Der naechste Streit, nicht der erste in der Liste – und nur sein Tatort zaehlt.
  const dispute = nearestDispute(world, agent);
  if (dispute) {
    agent.targetDisputeId = dispute.id;
    if (dist(agent.x, agent.y, dispute.x, dispute.y) <= GUARD_HANDLE_RANGE) {
      setTask(agent, 'serve');
      agent.workTicks += 1;
      return;
    }
    setTask(agent, 'toDispute');
    stepToward(world, agent, dispute.x, dispute.y);
    // Ohne Weg ist der Posten nicht besetzt: die Spieleroption bleibt offen.
    if (agent.path.length === 0) setTask(agent, 'toDispute', 'Streit nicht erreichbar');
    return;
  }
  agent.targetDisputeId = null;
  const angry = world.guests.find((guest) => guest.state === 'ANGRY');
  if (angry) { setTask(agent, 'toGuest', 'beruhigt einen Gast'); stepToward(world, agent, angry.position.x, angry.position.y); return; }
  setTask(agent, 'patrol');
  const gaming = world.zones.find((zone) => zone.kind === 'GAMING');
  if (agent.pathIndex >= agent.path.length && prng.nextFloat() < 0.2 && gaming) {
    const tx = gaming.x + 1 + Math.floor(prng.nextFloat() * Math.max(1, gaming.w - 2));
    const ty = gaming.y + 1 + Math.floor(prng.nextFloat() * Math.max(1, gaming.h - 2));
    agent.path = pathTo(world, { x: agent.x, y: agent.y }, { x: tx, y: ty });
    agent.pathIndex = 0;
  }
  if (agent.pathIndex < agent.path.length) {
    const next = agent.path[agent.pathIndex]!;
    agent.pathIndex += 1;
    agent.x = next.x;
    agent.y = next.y;
  }
  agent.workTicks += 1;
}

function cleanerTick(world: WorldState, agent: StaffAgent): void {
  const first = [...world.dirty][0];
  if (first === undefined) { setTask(agent, 'idle', 'nichts zu putzen'); return; }
  const tx = first % world.size;
  const ty = Math.floor(first / world.size);
  setTask(agent, 'cleaning');
  if (dist(agent.x, agent.y, tx, ty) <= 1) {
    // Am Ziel wird die naechste Umgebung mitgenommen, nicht nur eine Kachel.
    for (const tile of [...world.dirty]) {
      const x = tile % world.size;
      const y = Math.floor(tile / world.size);
      if (dist(x, y, tx, ty) <= 1) world.dirty.delete(tile);
    }
    return;
  }
  stepToward(world, agent, tx, ty);
  // Unerreichbarer Dreck wird nicht still geloescht; der Reiniger wird als
  // blockiert gemeldet, damit der Dreck sichtbar bleibt und der Spieler
  // den Zugang schaffen kann (z. B. Wand entfernen).
  if (agent.path.length === 0) setTask(agent, 'idle', 'Dreck nicht erreichbar');
}

function bartenderTick(world: WorldState, agent: StaffAgent): void {
  const bar = world.furniture.find((item) => item.kind === 'BAR');
  if (!bar) { setTask(agent, 'idle', 'keine Bar vorhanden'); return; }
  if (dist(agent.x, agent.y, bar.x, bar.y) <= 3) {
    setTask(agent, 'serve', bar.stock <= 0 ? 'Bar leer' : '');
    agent.workTicks += 1;
    return;
  }
  const spot = interactionPoint(world, bar);
  setTask(agent, 'toBar');
  if (spot) stepToward(world, agent, spot.x, spot.y);
}

/** Jede Rolle arbeitet sichtbar auf dem Floor statt als unsichtbarer Bonus. */
export function tickAgents(world: WorldState, ledger: Ledger, prng: Prng): void {
  for (const agent of world.agents) {
    if (agent.role === 'porter') porterTick(world, ledger, agent);
    else if (agent.role === 'cashier') cashierTick(world, ledger, agent, prng);
    else if (agent.role === 'guard') guardTick(world, agent, prng);
    else if (agent.role === 'cleaner') cleanerTick(world, agent);
    else bartenderTick(world, agent);
  }
}
