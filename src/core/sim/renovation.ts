/**
 * Renovierung der eigenen Immobilie: Stufen ohne zweites Save-Feld.
 *
 * Die Stufe steht nicht als Flag in der Welt, sie folgt aus den Renovierungs-
 * belegen im Journal/Archiv - derselbe dauerhafte Pfad, den Spielhistorie und
 * Kampfbilanz schon lesen. Ein Beleg pro Stufe, hoechstens drei; damit ist die
 * Stufe monoton, speicherbar (Journal und Archiv liegen im Save) und kann nach
 * einem Laden nicht zurueckfallen. Die Arbeit selbst veraendert nur, was schon
 * existiert: Ersatzteile aus dem Lager, Geld vom Betriebskonto (HAUSKONTO) und
 * den Zustand der Geraete und Flecken im Bereich der Immobilie.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { HAUSKONTO, SHOP } from './money';
import { propertyArea, propertyWorld } from './property';
import { TX_PREFIX } from './tx-reasons';
import type { WorldState } from './types';

export const RENOVATION_SUBJECT = 'RENOVIERUNG';

export const RENOVATION_STAGES = ['UNRENOVIERT', 'TEILRENOVIERT', 'BETRIEBSBEREIT', 'AUFGEWERTET'] as const;
export type RenovationStage = (typeof RENOVATION_STAGES)[number];

export const RENOVATION_LABELS: Readonly<Record<RenovationStage, string>> = {
  UNRENOVIERT: 'Unrenoviert',
  TEILRENOVIERT: 'Teilrenoviert',
  BETRIEBSBEREIT: 'Betriebsbereit',
  AUFGEWERTET: 'Aufgewertet',
};

export interface RenovationStep {
  readonly stage: Exclude<RenovationStage, 'UNRENOVIERT'>;
  /** Preis in ganzen VC; der Ledger bucht daraus Mikro. */
  readonly costVC: number;
  /** Ersatzteile aus dem Lager, die diese Stufe verbraucht. */
  readonly parts: number;
  readonly work: string;
}

/** Drei Stufen, jede mit eigenem Materialbedarf; die Preise sind eine erste Balance. */
export const RENOVATION_STEPS: readonly RenovationStep[] = [
  { stage: 'TEILRENOVIERT', costVC: 40, parts: 1, work: 'Boden aufgearbeitet und Theke abgezogen' },
  { stage: 'BETRIEBSBEREIT', costVC: 80, parts: 2, work: 'Elektrik geprueft und Geraete instand gesetzt' },
  { stage: 'AUFGEWERTET', costVC: 140, parts: 3, work: 'Licht, Polster und Beschilderung erneuert' },
];

/**
 * Journal und Archiv teilen die IDs: derselbe Beleg darf nicht doppelt zaehlen,
 * auch wenn er beim Aufraeumen in beide Listen kopiert wurde.
 */
function renovationEvents(world: WorldState): readonly { readonly id: number }[] {
  const seen = new Set<number>();
  const events: { readonly id: number }[] = [];
  for (const event of [...world.archive, ...world.journal]) {
    if (event.subject !== RENOVATION_SUBJECT || seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }
  return events;
}

/** Die Stufe, die das Haus wirklich erreicht hat; ohne Beleg ist es unrenoviert. */
export function renovationStage(world: WorldState): RenovationStage {
  const done = renovationEvents(world).length;
  return RENOVATION_STAGES[Math.min(RENOVATION_STAGES.length - 1, done)]!;
}

/** Die naechste Stufe mit Preis und Material; null heisst: aufgewertet. */
export function nextRenovationStep(stage: RenovationStage): RenovationStep | null {
  return RENOVATION_STEPS[RENOVATION_STAGES.indexOf(stage)] ?? null;
}

export interface RenovationView {
  readonly owned: boolean;
  readonly stage: RenovationStage;
  readonly label: string;
  readonly step: RenovationStep | null;
  readonly costVC: number;
  readonly partsNeeded: number;
  readonly parts: number;
  readonly house: VaCoinMicro;
  /** Material und Betriebskonto reichen fuer die naechste Stufe. */
  readonly ready: boolean;
  readonly note: string;
}

/** Eine Sicht fuer UI und Tests; sie rechnet nichts nach und speichert nichts. */
export function renovationView(world: WorldState, ledger: Ledger): RenovationView {
  const owned = world.player.property !== null;
  const stage = renovationStage(world);
  const step = nextRenovationStep(stage);
  const house = ledger.getBalance(HAUSKONTO);
  const cost = step ? fromVC(step.costVC) : ZERO_VC;
  const ready = owned && step !== null && world.parts >= step.parts && house >= cost;
  const note = !owned
    ? 'Kauf zuerst eine Immobilie.'
    : step === null
      ? 'Aufgewertet - am Zustand ist nichts mehr zu holen.'
      : world.parts < step.parts
        ? `Material fehlt: ${step.parts} Ersatzteile im Lager, vorhanden ${world.parts}.`
        : house < cost
          ? `Betriebskonto zu niedrig: ${toVCString(cost)} noetig, ${toVCString(house)} vorhanden.`
          : `${step.work}: ${step.costVC} VC und ${step.parts} Ersatzteile.`;
  return {
    owned,
    stage,
    label: RENOVATION_LABELS[stage],
    step,
    costVC: step?.costVC ?? 0,
    partsNeeded: step?.parts ?? 0,
    parts: world.parts,
    house,
    ready,
    note,
  };
}

/**
 * Ein Ruf-Bonus je Stufe: der Zustand, in dem Gaeste das Haus erleben, ist Teil
 * des Rufs. 0 ohne Eigentum, weil die Stufe dann UNRENOVIERT ist.
 */
export function renovationReputationBonus(world: WorldState): number {
  return world.player.property === null ? 0 : RENOVATION_STAGES.indexOf(renovationStage(world)) * 2;
}

/** Gaeste merken den Zustand beim ersten Schritt: ein Launebonus je Stufe. */
export function renovationMoodBonus(world: WorldState): number {
  return world.player.property === null ? 0 : RENOVATION_STAGES.indexOf(renovationStage(world));
}

/**
 * Eine Stufe renovieren. Erst pruefen (Eigentum, Material, Betriebskonto), dann
 * buchen, erst danach die Welt anfassen: ein Fehler hinterlaesst keinen halben
 * Zustand und keine Buchung.
 */
export function renovate(world: WorldState, ledger: Ledger, tick: number = world.tick): RenovationStage {
  if (world.player.property === null) throw new Error('Ohne Immobilie gibt es nichts zu renovieren.');
  const stage = renovationStage(world);
  const step = nextRenovationStep(stage);
  if (step === null) throw new Error('Die Immobilie ist bereits aufgewertet.');
  const area = propertyArea(world);
  if (area === null) throw new Error('Die Immobilie hat keinen Boden im WorldState.');
  if (world.parts < step.parts) {
    throw new Error(`Material fehlt: ${step.parts} Ersatzteile aus dem Lager, vorhanden ${world.parts}.`);
  }
  const cost = fromVC(step.costVC);
  const balance = ledger.getBalance(HAUSKONTO);
  if (balance < cost) {
    throw new Error(`Betriebskonto zu niedrig: ${toVCString(cost)} noetig, ${toVCString(balance)} vorhanden.`);
  }
  ledger.transfer(HAUSKONTO, SHOP, cost, `${TX_PREFIX.RENOVATION}${step.stage}`, tick);
  world.parts -= step.parts;
  // Dieselbe Bindung wie Agent 08: nur Geraete der eigenen Flaeche werden angefasst.
  const binding = propertyWorld(world);
  for (const item of binding?.furniture ?? []) {
    item.condition = 100;
    item.damaged = false;
    item.clogged = false;
    item.clog = 0;
    item.dirt = 0;
  }
  for (const tile of [...world.dirty]) {
    const x = tile % world.size;
    const y = Math.floor(tile / world.size);
    if (x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h) world.dirty.delete(tile);
  }
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: RENOVATION_SUBJECT,
    cause: `Renovierung ${RENOVATION_LABELS[step.stage]}`,
    effect: `${step.work}; ${toVCString(cost)} vom Betriebskonto, ${step.parts} Ersatzteile aus dem Lager.`,
  });
  // Nach dem Beleg: das Journal setzt die sichtbare Zeile auf seine Wirkung.
  world.lastEvent = `${RENOVATION_LABELS[step.stage]}: ${step.work}. ${step.parts} Ersatzteile verbraucht.`;
  return step.stage;
}
