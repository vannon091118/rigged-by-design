/**
 * Aktive Betreiberarbeit: der Spieler uebernimmt am eigenen Betrieb die
 * Kernaufgabe seines Bereichs, statt nur Panels zu lesen.
 *
 * Kein zweiter Servicepfad und kein pauschales Geld: die Bar-Schicht laesst den
 * Gast wirklich trinken (`actAtTarget` -> `deliverDrink`), die Tischrunde laesst
 * ihn wirklich spielen (`actAtTarget` -> Spin mit Ledger-Buchung), die Lounge
 * veraendert Laune und Geduld ueber den vorhandenen Gastzustand. Was der Spieler
 * dabei besser kann, kommt aus Fach-Skill und der Jobleistung aus #803; beides
 * ist eine Verstaerkung des echten Ergebnisses, kein zweiter Ertrag.
 *
 * Zustand gibt es nur einen: die Arbeit braucht keinen Zaehler und kein
 * Save-Feld. Der letzte Einsatz steht als Journal-Zeile im vorhandenen Archiv.
 * Wo die Stationen stehen und was gerade fehlt, beantwortet
 * `business-work-stations.ts`.
 */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { driftNeed } from './needs-core';
import { actAtTarget } from './guest-play';
import { recordJournal } from './journal';
import { averagePerformance } from './player-jobs';
import { skillLevel, type PlayerSkillId } from './player-skills';
import { propertyWorld } from './property';
import {
  barStation, gamingStation, guestAt, guestIn, inside, stationReadiness, zoneFor,
} from './business-work-stations';
import type { BusinessWorkTaskId } from './business-work-stations';
import type { Guest, StaffRole, WorldState } from './types';

export type { BusinessWorkTaskId } from './business-work-stations';
export { BUSINESS_WORK_RANGE } from './business-work-stations';

export const BUSINESS_WORK_SUBJECT = 'BETRIEB_ARBEIT';

export interface BusinessWorkTask {
  readonly id: BusinessWorkTaskId;
  readonly label: string;
  readonly area: 'CASINO' | 'BAR' | 'LOUNGE';
  /** Objekt oder Ort, an dem die Handlung ausgefuehrt wird. */
  readonly station: string;
  readonly skill: PlayerSkillId;
  /** Personalrolle, die dieselbe Aufgabe uebernimmt; null = keine Vertretung. */
  readonly staffRole: StaffRole | null;
  readonly ready: boolean;
  readonly reason: string;
  readonly effect: string;
}

export interface BusinessWorkView {
  readonly owned: boolean;
  /** Flaeche des eigenen Betriebs; null ohne Boden. */
  readonly area: string | null;
  /** Der Spieler steht im eigenen Betrieb. */
  readonly onSite: boolean;
  readonly tasks: readonly BusinessWorkTask[];
  /** Letzte eigene Schicht aus dem Archiv, null wenn noch keine. */
  readonly lastShift: string | null;
  readonly note: string;
}

/** Was Skill und Jobleistung aus #803 an Wirkung drauflegen; nie Geld, nur Ergebnis. */
function qualityBonus(world: WorldState, skill: PlayerSkillId): number {
  const level = skillLevel(world.player.skills, skill);
  const job = world.player.job;
  const performance = job === null ? null : averagePerformance(job);
  const performanceBonus = performance === null ? 0 : Math.round((performance - 50) / 10);
  return level + performanceBonus;
}

function lastShift(world: WorldState): string | null {
  return [...world.archive].reverse().find((entry) => entry.subject === BUSINESS_WORK_SUBJECT)?.effect ?? null;
}

/** Die eine Sicht: Aufgabenmatrix, Ort, Bereitschaft und letzte Schicht. */
export function businessActiveWorkView(world: WorldState): BusinessWorkView {
  const binding = propertyWorld(world);
  const onSite = binding !== null && binding.area !== null
    && inside(binding.area, world.player.position.x, world.player.position.y);
  const definitions: readonly Omit<BusinessWorkTask, 'ready' | 'reason'>[] = [
    { id: 'BARKEEP', label: 'Schicht am Tresen', area: 'BAR', station: 'Bar', skill: 'service', staffRole: 'bartender',
      effect: 'Bedient einen wartenden Gast aus dem Bestand: echter Verkauf, mehr Laune und Geduld.' },
    { id: 'CROUPIER', label: 'Tischrunde leiten', area: 'CASINO', station: 'Tisch/Automat', skill: 'cardDealing', staffRole: null,
      effect: 'Laesst einen spielenden Gast eine Runde spielen: echter Einsatz, echte Auszahlung.' },
    { id: 'HOST', label: 'Gaeste betreuen', area: 'LOUNGE', station: 'Lounge', skill: 'service', staffRole: null,
      effect: 'Hebt Laune und Geduld der Gaeste in deiner Lounge; das aendert ihr naechstes Verhalten.' },
  ];
  const tasks = definitions.map((task) => ({ ...task, ...stationReadiness(world, task.id) }));
  const readyCount = tasks.filter((task) => task.ready).length;
  const note = binding === null
    ? 'Noch kein Betrieb: erst eine Immobilie kaufen.'
    : readyCount > 0
      ? `${readyCount} Aufgabe${readyCount === 1 ? '' : 'n'} gerade ausfuehrbar.`
      : 'Keine Aufgabe offen: Personal, Bestand und Gaeste entscheiden, was gerade geht.';
  return { owned: binding !== null, area: binding?.area?.id ?? null, onSite, tasks, lastShift: lastShift(world), note };
}

function applyMood(guest: Guest, mood: number, patience: number): void {
  guest.mood = driftNeed(guest.mood, mood);
  guest.patience = driftNeed(guest.patience, patience);
}

/**
 * Fuehrt genau eine Aufgabe aus. Erst pruefen (Eigentum, Naehe, Bestand, Gast),
 * dann handeln: ein Fehlschlag hinterlaesst weder Buchung noch halbe Wirkung.
 */
export function workBusinessTask(
  world: WorldState, ledger: Ledger, prng: Prng, taskId: BusinessWorkTaskId,
): string {
  const view = businessActiveWorkView(world);
  const task = view.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error(`Unbekannte Betriebsaufgabe: ${taskId}.`);
  if (!task.ready) throw new Error(task.reason);
  const binding = propertyWorld(world)!;
  let notice: string;
  if (taskId === 'BARKEEP') {
    const bar = barStation(world)!;
    const guest = guestAt(world, bar, 'DRINK')!;
    const bonus = qualityBonus(world, 'service');
    actAtTarget(world, ledger, prng, guest, bar);
    applyMood(guest, bonus, Math.ceil(bonus / 2));
    notice = `${guest.name} am Tresen bedient (Service ${bonus}).`;
  } else if (taskId === 'CROUPIER') {
    const machine = gamingStation(world)!;
    const guest = guestAt(world, machine, 'PLAY')!;
    const bonus = qualityBonus(world, 'cardDealing');
    actAtTarget(world, ledger, prng, guest, machine);
    applyMood(guest, bonus, Math.ceil(bonus / 2));
    notice = `Tischrunde fuer ${guest.name} geleitet (Technik ${bonus}).`;
  } else {
    const zone = zoneFor(binding.zones, 'LOUNGE')!;
    const guest = guestIn(zone, binding.guests)!;
    const bonus = qualityBonus(world, 'service');
    applyMood(guest, 4 + bonus * 2, 3 + bonus);
    notice = `${guest.name} in der Lounge betreut (Service ${bonus}).`;
  }
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: BUSINESS_WORK_SUBJECT,
    cause: `${task.label} · ${task.area}`,
    effect: notice,
    refs: {},
  });
  world.lastEvent = notice;
  return notice;
}
