/**
 * Zentrale Event-Infrastruktur: Veranstaltungen laufen als Phasen ueber die
 * vorhandenen narrativen Event-Instanzen.
 *
 * Es gibt keine zweite Event-Liste und kein neues Save-Feld. Ankuendigung,
 * Einlass, Durchfuehrung, Ergebnis und Archivierung werden aus `startedTick`,
 * `expiresTick`, `step`, `status` und `resolution` der bereits gespeicherten
 * Instanz abgeleitet. Die Phasenwechsel schreiben ausschliesslich ueber die
 * bestehende Lifecycle-API; der Turnierabend bleibt eine echte
 * `NarrativeEventInstance` und damit auch fuer die Nachfrage sichtbar.
 */
import { recordJournal } from './journal';
import { startDemandEvent } from './narrative/demand-events';
import { advanceEventStep, isLiveEventStatus, transitionEvent } from './narrative/event-lifecycle';
import type { NarrativeEventInstance } from './narrative/event-types';
import { demandDefinition, isDemandEventId } from './narrative/events/demand-definitions';
import { roomPlanSummary, roomPlans } from './room-plan';
import type { DemandEventKind, WorldState } from './types';

type VenueEventFormat = 'TURNIER' | 'SONDERABEND';
type VenueEventPhase = 'ANNOUNCED' | 'ADMISSION' | 'RUNNING' | 'RESULT' | 'ARCHIVED';

/** Die vorhandenen Nachfrage-Events sind zugleich die ersten Veranstaltungsformate. */
const FORMAT: Readonly<Record<DemandEventKind, VenueEventFormat>> = {
  TURNIER_ABEND: 'TURNIER',
  NEON_NACHT: 'SONDERABEND',
};

const VENUE_PHASE_LABEL: Readonly<Record<VenueEventPhase, string>> = {
  ANNOUNCED: 'Ankündigung',
  ADMISSION: 'Einlass',
  RUNNING: 'Durchführung',
  RESULT: 'Ergebnis',
  ARCHIVED: 'Archiviert',
};

/** Anteile der Laufzeit; fuer die vorhandenen 150 Ticks sind das 30/30/60/30. */
const ANNOUNCE_SHARE = 0.2;
const ADMISSION_SHARE = 0.4;
const RESULT_SHARE = 0.8;
/** Ein Ergebnis bleibt so lange sichtbar, bevor es als Archiv gilt. */
const RESULT_VISIBLE_TICKS = 30;
const HISTORY_LIMIT = 6;

export interface VenueEventView {
  readonly id: number;
  readonly kind: DemandEventKind;
  readonly label: string;
  readonly format: VenueEventFormat;
  readonly phase: VenueEventPhase;
  readonly phaseLabel: string;
  readonly status: NarrativeEventInstance['status'];
  readonly step: string;
  readonly startedTick: number;
  readonly expiresTick: number;
  readonly ticksLeft: number;
  readonly result: string | null;
}

export interface VenueView {
  readonly current: VenueEventView | null;
  readonly history: readonly VenueEventView[];
  readonly admitted: number;
  readonly capacity: number;
}

function venueEventFormat(kind: DemandEventKind): VenueEventFormat {
  return FORMAT[kind];
}

/**
 * Phasenfenster aus der echten Laufzeit. Terminale Instanzen zeigen ihr
 * Ergebnis kurz und wandern danach ins Archiv; beides bleibt Ableitung.
 */
function venuePhaseOf(event: NarrativeEventInstance, tick: number): VenueEventPhase | null {
  if (!isDemandEventId(event.eventId)) return null;
  if (!isLiveEventStatus(event.status)) {
    return tick - event.updatedTick < RESULT_VISIBLE_TICKS ? 'RESULT' : 'ARCHIVED';
  }
  const duration = Math.max(1, event.expiresTick - event.startedTick);
  const elapsed = Math.max(0, tick - event.startedTick);
  if (elapsed < Math.floor(duration * ANNOUNCE_SHARE)) return 'ANNOUNCED';
  if (elapsed < Math.floor(duration * ADMISSION_SHARE)) return 'ADMISSION';
  if (elapsed < Math.floor(duration * RESULT_SHARE)) return 'RUNNING';
  return 'RESULT';
}

function eventView(world: WorldState, event: NarrativeEventInstance): VenueEventView | null {
  const phase = venuePhaseOf(event, world.tick);
  if (!phase || !isDemandEventId(event.eventId)) return null;
  const definition = demandDefinition(event.eventId);
  return {
    id: event.id,
    kind: event.eventId,
    label: definition.label,
    format: venueEventFormat(event.eventId),
    phase,
    phaseLabel: VENUE_PHASE_LABEL[phase],
    status: event.status,
    step: event.step,
    startedTick: event.startedTick,
    expiresTick: event.expiresTick,
    ticksLeft: Math.max(0, event.expiresTick - world.tick),
    result: event.resolution,
  };
}

/** Die eine Veranstaltungssicht: laufende Phase plus die juengste Historie. */
export function venueView(world: WorldState): VenueView {
  const capacity = roomPlanSummary(roomPlans(world.layout)).guestCapacity;
  const views = world.narrative.events
    .map((event) => eventView(world, event))
    .filter((view): view is VenueEventView => view !== null);
  const current = views
    .filter((view) => isLiveEventStatus(view.status))
    .sort((left, right) => right.startedTick - left.startedTick || right.id - left.id)[0] ?? null;
  const history = views
    .filter((view) => !isLiveEventStatus(view.status))
    .sort((left, right) => right.id - left.id)
    .slice(0, HISTORY_LIMIT);
  return { current, history, admitted: world.guests.length, capacity };
}

/**
 * Startet eine Veranstaltung ueber den vorhandenen Scheduler und setzt ihren
 * ersten expliziten Schritt. Die Ankuendigung ist ein Journal-Eintrag, keine
 * zweite Nachricht im Event-Zustand.
 */
export function openVenueEvent(
  world: WorldState, kind: DemandEventKind,
): NarrativeEventInstance | null {
  const event = startDemandEvent(world, kind);
  if (!event) return null;
  advanceEventStep(world, event.id, 'ANNOUNCED', world.tick);
  const definition = demandDefinition(kind);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: definition.label,
    cause: 'Veranstaltung angekündigt',
    effect: definition.startMessage,
  });
  // Die erste Welle steht sofort vor der Tuer: jeder Startpfad zieht sie nach,
  // nicht nur der Tages-Tick in `demand`.
  world.nextArrivalTick = Math.min(world.nextArrivalTick, world.tick + 1);
  return world.narrative.events.find((entry) => entry.id === event.id) ?? null;
}

/**
 * Ein Lauf pro Tick: Phasenwechsel und genau eine Auflösung am Fristtick.
 * Die Auflösung nutzt `transitionEvent`; damit gelten dieselben Cooldowns und
 * dieselbe Historie wie fuer jede andere narrative Instanz.
 */
export function tickVenueEvents(world: WorldState): readonly NarrativeEventInstance[] {
  const capacity = roomPlanSummary(roomPlans(world.layout)).guestCapacity;
  const resolved: NarrativeEventInstance[] = [];
  for (const event of [...world.narrative.events]) {
    if (!isLiveEventStatus(event.status) || !isDemandEventId(event.eventId)) continue;
    const phase = venuePhaseOf(event, world.tick);
    if (!phase) continue;
    if (event.step !== phase) advanceEventStep(world, event.id, phase, world.tick);
    if (world.tick < event.expiresTick) continue;
    const definition = demandDefinition(event.eventId);
    const result = `${definition.label}: ${world.guests.length} Gäste im Haus, ${capacity} Plätze geplant.`;
    advanceEventStep(world, event.id, 'RESULT', world.tick);
    if (!transitionEvent(world, event.id, 'RESOLVED', world.tick, result)) continue;
    recordJournal(world, {
      kind: 'SYSTEM',
      subject: definition.label,
      cause: 'Veranstaltung beendet',
      effect: result,
    });
    const next = world.narrative.events.find((entry) => entry.id === event.id);
    if (next) resolved.push(next);
  }
  return resolved;
}
