// @loc-exception: Alle Rollen teilen den Agentenstatus und dieselbe Tick-Naht; getrennt waeren Aufgaben und Pfade inkonsistent.
/** Personal: eingestellte Rollen bekommen einen Körper, der auf dem Floor arbeitet. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import { chooseActivity } from './guest-choice';
import { depositCrate, takeCrate } from './deliveries';
import { recordJournal } from './journal';
import { exchangeFiat, HAUSKONTO, pendingAccount, STAFF } from './money';
import type { Prng } from '../rng/prng';
import type { StaffAgent, StaffRole, WorldState } from './types';
import { blockedTiles, nearestWalkable } from './pathfinding';
import { GUARD_HANDLE_RANGE, nearestDispute } from './disputes';
import { exchangePoint, interactionPoint, pathTo, spawnPoint } from './world';

export const CASHIER_WAIT = 12;

function wageFor(world: WorldState, role: StaffRole): VaCoinMicro {
  if (role === 'guard') return world.prices.guardWage;
  if (role === 'cashier') return world.prices.cashierWage;
  if (role === 'porter') return world.prices.porterWage;
  return world.prices.staffWage;
}

const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

/** Status ist Teil des Zustands, nicht eine Schaetzung der UI. */
function setTask(agent: StaffAgent, task: StaffAgent['task'], blockedReason = ''): void {
  agent.task = task;
  agent.blockedReason = blockedReason;
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

/** Ein Feld pro Tick; alle sechs Ticks wird der Weg neu geplant. */
function stepToward(world: WorldState, agent: StaffAgent, tx: number, ty: number): boolean {
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

function porterTick(world: WorldState, ledger: Ledger, agent: StaffAgent): void {
  void ledger;
  const held = agent.carryingCrate !== null
    ? world.crates.find((crate) => crate.id === agent.carryingCrate) ?? null : null;
  if (!held) {
    agent.carryingCrate = null;
    const job = world.crates.find((crate) =>
      crate.carriedBy === null && crate.payload.kind !== 'FURNITURE');
    if (!job) { setTask(agent, 'idle', 'keine Kiste am Eingang'); return; }
    if (dist(agent.x, agent.y, job.x, job.y) <= 1) {
      takeCrate(world, job.id, agent.id);
      agent.carryingCrate = job.id;
      agent.path = [];
      agent.pathIndex = 0;
      setTask(agent, job.payload.kind === 'DRINKS' ? 'toBar' : 'toStorage');
    } else { setTask(agent, 'toCrate'); stepToward(world, agent, job.x, job.y); }
    return;
  }
  if (held.payload.kind === 'DRINKS') {
    const bars = world.furniture.filter((item) => item.kind === 'BAR');
    let target = bars[0];
    for (const bar of bars) {
      if (bar.stock < (target?.stock ?? Number.MAX_SAFE_INTEGER)) target = bar;
    }
    if (!target) { setTask(agent, 'idle', 'keine Bar vorhanden'); return; }
    if (dist(agent.x, agent.y, target.x, target.y) <= 3) {
      try {
        const done = depositCrate(world, held.id, agent.x, agent.y, target.id);
        if (done.emptied) agent.carryingCrate = null;
        setTask(agent, 'toBar');
      } catch { setTask(agent, 'toBar', 'Bar voll'); agent.path = []; agent.pathIndex = 0; }
      return;
    }
    const spot = interactionPoint(world, target);
    setTask(agent, 'toBar');
    if (spot) stepToward(world, agent, spot.x, spot.y);
    return;
  }
  const storage = world.zones.find((zone) => zone.id === 'storage');
  if (storage && agent.x >= storage.x && agent.y >= storage.y
    && agent.x < storage.x + storage.w && agent.y < storage.y + storage.h) {
    try {
      depositCrate(world, held.id, agent.x, agent.y);
      agent.carryingCrate = null;
      setTask(agent, 'toStorage');
    } catch { setTask(agent, 'toStorage', 'Lager voll oder blockiert'); }
    return;
  }
  if (storage) {
    setTask(agent, 'toStorage');
    const spot = nearestWalkable(world.size, blockedTiles(world.size, world.furniture),
      { x: storage.x + Math.floor(storage.w / 2), y: storage.y + Math.floor(storage.h / 2) });
    if (spot) stepToward(world, agent, spot.x, spot.y);
  }
}

function cashierTick(world: WorldState, ledger: Ledger, agent: StaffAgent, prng: Prng): void {
  const point = exchangePoint(world);
  if (!point) { setTask(agent, 'idle', 'keine Wechselkasse'); return; }
  const near = dist(agent.x, agent.y, point.x, point.y) <= 8;
  if (!near) { setTask(agent, 'toGuest', 'geht zur Kasse'); stepToward(world, agent, point.x, point.y); return; }
  setTask(agent, 'cashier');
  for (const guest of world.guests) {
    if (guest.state === 'EXCHANGE' && guest.queueIndex === 0) {
      try {
        exchangeFiat(ledger, guest.id, world.tick);
      } catch {
        guest.patience = Math.max(0, guest.patience - 2);
        continue;
      }
      chooseActivity(world, guest, ledger, prng);
    }
  }
  // Das Kassierer-Boosting folgt derselben Schlange: nur der vorderste
  // Auszahler wird sofort bedient, wer dahinter steht, wartet sichtbar
  // an seinem Fleck, statt mitausgezahlt zu werden.
  const cashouts = world.guests.filter((guest) => guest.state === 'CASHOUT');
  const front = cashouts.length > 0
    ? cashouts.reduce((lead, guest) => (guest.queueIndex < lead.queueIndex ? guest : lead))
    : null;
  if (front && ledger.getBalance(pendingAccount(front.id)) > 0) {
    front.stateTicks = Math.max(front.stateTicks, CASHIER_WAIT);
  }
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
  // Unerreichbarer Dreck darf die Reinigung nicht dauerhaft blockieren.
  if (agent.path.length === 0) world.dirty.delete(first);
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
