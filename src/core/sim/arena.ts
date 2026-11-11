/**
 * Eigene Arena als Ausbau der vorhandenen Immobilie: Stufen kommen aus
 * Journal-Belegen, das Geld vom Betriebskonto, der Einlass-Erloes aus dem
 * Kampfabend. Kein neues Save-Feld, keine zweite Event-Liste, keine zweite
 * Kampf-Engine; die Gastronomie bleibt die vorhandene Bar im Haus.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { EXTERNAL, HAUSKONTO, SHOP } from './money';
import { propertyWorld } from './property';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';

const ARENA_SUBJECT = 'ARENA_AUSBAU';
export const ARENA_ADMISSION_SUBJECT = 'ARENA_EINLASS';
const ARENA_STAGES = ['KEINE', 'RING', 'TRIBUENE', 'TECHNIK'] as const;
type ArenaStage = (typeof ARENA_STAGES)[number];

interface ArenaStep {
  readonly stage: Exclude<ArenaStage, 'KEINE'>;
  readonly label: string;
  readonly costVC: number;
  readonly seats: number;
  readonly ticketVC: number;
  readonly work: string;
}

const ARENA_STEPS: readonly ArenaStep[] = [
  { stage: 'RING', label: 'Ring', costVC: 80, seats: 8, ticketVC: 1, work: 'Ringpfosten, Seile und Bodenmatte gesetzt' },
  { stage: 'TRIBUENE', label: 'Tribuene', costVC: 160, seats: 20, ticketVC: 2, work: 'Stufen und Sitzreihen eingezogen' },
  { stage: 'TECHNIK', label: 'Technik', costVC: 260, seats: 32, ticketVC: 3, work: 'Licht, Ton und Regie eingebaut' },
];

export interface ArenaView {
  readonly owned: boolean;
  readonly stage: ArenaStage;
  readonly label: string;
  readonly seats: number;
  readonly ticketVC: number;
  readonly next: ArenaStep | null;
  readonly note: string;
  /** Vorhandene Bar-Zonen der Immobilie; die Gastronomie bleibt ihre Anzeige. */
  readonly barZones: number;
}

/** Die Stufe folgt aus den Ausbaubelegen; ohne Beleg gibt es keine Arena. */
export function arenaStage(world: WorldState): ArenaStage {
  const done = world.archive.filter((entry) => entry.subject === ARENA_SUBJECT).length;
  return ARENA_STAGES[Math.min(ARENA_STAGES.length - 1, done)]!;
}

function nextArenaStep(stage: ArenaStage): ArenaStep | null {
  return ARENA_STEPS[ARENA_STAGES.indexOf(stage)] ?? null;
}

function stepOf(stage: ArenaStage): ArenaStep | null {
  return stage === 'KEINE' ? null : ARENA_STEPS[ARENA_STAGES.indexOf(stage) - 1] ?? null;
}

/** Die eine Sicht: Stufe, Plaetze, Einlasspreis, Bar-Anzeige und naechster Schritt. */
export function arenaView(world: WorldState): ArenaView {
  const stage = arenaStage(world);
  const step = stepOf(stage);
  const next = nextArenaStep(stage);
  const binding = propertyWorld(world);
  const owned = world.player.property !== null;
  const barZones = binding?.zones.filter((zone) => zone.kind === 'BAR').length ?? 0;
  const note = !owned
    ? 'Arena braucht eine eigene Immobilie.'
    : next === null
      ? 'Arena ist vollstaendig ausgebaut.'
      : `${next.work} · ${next.costVC} VC vom Betriebskonto.`;
  return {
    owned,
    stage,
    label: owned ? step?.label ?? 'keine Arena' : 'keine Immobilie',
    seats: step?.seats ?? 0,
    ticketVC: step?.ticketVC ?? 0,
    next,
    note,
    barZones,
  };
}

/** Baut die naechste Stufe vom Betriebskonto; der Beleg traegt die Stufe. */
export function buildArena(world: WorldState, ledger: Ledger): ArenaStage {
  if (world.player.property === null) throw new Error('Arena braucht eine eigene Immobilie.');
  const step = nextArenaStep(arenaStage(world));
  if (!step) throw new Error('Arena ist bereits vollstaendig ausgebaut.');
  const cost = fromVC(step.costVC);
  if (ledger.getBalance(HAUSKONTO) < cost) {
    throw new Error(`Nicht genug Betriebsguthaben: ${step.costVC} VC noetig.`);
  }
  ledger.transfer(HAUSKONTO, SHOP, cost, TX_REASON.ARENA_BUILD, world.tick);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: ARENA_SUBJECT,
    cause: `stufe:${step.stage}|kosten:${step.costVC}|arbeit:${step.work}`,
    effect: `${step.label} gebaut fuer ${step.costVC} VC vom Betriebskonto.`,
    amount: cost,
  });
  world.lastEvent = `${step.label} gebaut: ${step.seats} Plaetze, Einlass ${step.ticketVC} VC.`;
  return step.stage;
}

/** Einlass des Kampfabends: Gaeste zahlen den Preis der aktuellen Stufe. */
export function admitArena(world: WorldState, ledger: Ledger): VaCoinMicro {
  const step = stepOf(arenaStage(world));
  const guests = world.guests.length;
  if (!step || guests === 0) return ZERO_VC;
  const revenue = fromVC(step.ticketVC * guests);
  ledger.transfer(EXTERNAL, HAUSKONTO, revenue, TX_REASON.ARENA_ADMISSION, world.tick);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: ARENA_ADMISSION_SUBJECT,
    cause: `stufe:${step.stage}|gaeste:${guests}|preis:${step.ticketVC}`,
    effect: `Einlass: ${guests} Gaeste zu ${step.ticketVC} VC · ${toVCString(revenue)} aufs Betriebskonto.`,
    amount: revenue,
  });
  return revenue;
}
