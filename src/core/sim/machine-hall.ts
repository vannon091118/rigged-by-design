/**
 * Spielhalle der eigenen Immobilie: Automaten, ihr Zustand und die Wartung.
 *
 * Die Halle ist keine neue Liste. Sie liest `propertyWorld` (Agent 08), also die
 * Geraete auf der Flaeche der Immobilie, und den vorhandenen Zustand
 * `condition`/`damaged` aus `Furniture`. Wartung ist bewusst der zweite Verb
 * neben der Reparatur: Reparatur braucht ein Ersatzteil und setzt ein Geraet
 * wieder auf 100, Wartung kostet nur Betriebskonto und haelt ein laufendes
 * Geraet instand, bevor es ausfaellt. Es gibt keinen zweiten Wartungszaehler -
 * der Zustand des Geraets ist der Zaehler.
 */
import type { Ledger } from '../economy/ledger';
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { HAUSKONTO, SHOP } from './money';
import { propertyWorld } from './property';
import { TX_PREFIX } from './tx-reasons';
import type { Furniture, WorldState } from './types';

export const MAINTENANCE_SUBJECT = 'WARTUNG';

/** Ab hier gilt ein Automat als wartungsbeduerftig; dieselbe Grenze nutzt das HUD. */
export const MACHINE_WEAR_LIMIT = 85;

/** Ueber diesem Zustand lohnt keine Wartung mehr; dann ist das Geraet in Ordnung. */
export const MACHINE_FIT_CONDITION = 95;

/** Was eine Wartung am Zustand gutschreibt. */
export const MAINTENANCE_GAIN = 20;

export type MachineConditionBand = 'FIT' | 'WORN' | 'BROKEN';

export interface HallMachine {
  readonly id: number;
  readonly label: string;
  readonly game: string;
  readonly condition: number;
  readonly band: MachineConditionBand;
  readonly seats: number;
  readonly occupants: number;
  /** Wartungspreis in Mikro; die Haelfte der Reparatur, ohne Ersatzteil. */
  readonly cost: VaCoinMicro;
  /** Zustand, Konto und Defekt erlauben genau jetzt eine Wartung. */
  readonly ready: boolean;
  readonly note: string;
}

export interface MachineHallView {
  readonly owned: boolean;
  /** Name der Flaeche, auf der die Automaten stehen; null ohne Boden. */
  readonly area: string | null;
  readonly total: number;
  readonly running: number;
  readonly worn: number;
  readonly broken: number;
  readonly seats: number;
  readonly occupied: number;
  readonly cost: VaCoinMicro;
  readonly house: VaCoinMicro;
  /** Wartungsbeduerftige Automaten, die unangenehmsten zuerst. */
  readonly due: readonly HallMachine[];
  readonly note: string;
}

/** Derselbe Zustand wie im Automatenfenster, nur als Bander fuer die Halle. */
export function conditionBand(item: Pick<Furniture, 'condition' | 'damaged'>): MachineConditionBand {
  if (item.damaged || item.condition < 45) return 'BROKEN';
  return item.condition < MACHINE_WEAR_LIMIT ? 'WORN' : 'FIT';
}

/** Wartung kostet die Haelfte einer Reparatur und verbraucht kein Ersatzteil. */
export function maintenanceCost(world: WorldState): VaCoinMicro {
  return Math.max(1, Math.round(world.prices.repairCost / 2)) as VaCoinMicro;
}

/** Nur Spielautomaten der eigenen Flaeche gehoeren zur Halle. */
function hallFurniture(world: WorldState): readonly Furniture[] {
  const binding = propertyWorld(world);
  if (binding === null) return [];
  return binding.furniture.filter((item) => item.gameId !== null);
}

function hallMachine(world: WorldState, item: Furniture, house: VaCoinMicro): HallMachine {
  const cost = maintenanceCost(world);
  const band = conditionBand(item);
  return {
    id: item.id,
    label: item.label,
    game: item.gameId ?? '',
    condition: Math.round(item.condition),
    band,
    seats: item.seats,
    occupants: item.occupants.length,
    cost,
    ready: band !== 'BROKEN' && item.condition < MACHINE_FIT_CONDITION && house >= cost,
    note: band === 'BROKEN'
      ? 'Defekt: erst reparieren, Wartung hilft nicht mehr.'
      : item.condition >= MACHINE_FIT_CONDITION
        ? 'In Ordnung - keine Wartung noetig.'
        : house < cost
          ? `Betriebskonto zu niedrig: ${toVCString(cost)} noetig.`
          : `Wartung hebt den Zustand um ${MAINTENANCE_GAIN} Punkte, ohne Ersatzteil.`,
  };
}

/** Eine Sicht fuer UI und Tests; sie speichert nichts und rechnet nichts nach. */
export function machineHallView(world: WorldState, ledger: Ledger): MachineHallView {
  const owned = world.player.property !== null;
  const house = ledger.getBalance(HAUSKONTO);
  const machines = hallFurniture(world).map((item) => hallMachine(world, item, house));
  const broken = machines.filter((machine) => machine.band === 'BROKEN').length;
  const worn = machines.filter((machine) => machine.band === 'WORN').length;
  const due = machines
    .filter((machine) => machine.band === 'WORN')
    .sort((left, right) => left.condition - right.condition)
    .slice(0, 3);
  const note = !owned
    ? 'Kauf zuerst eine Immobilie.'
    : machines.length === 0
      ? 'Noch kein Automat auf der eigenen Flaeche - im Betrieb kaufen und abstellen.'
      : broken > 0
        ? `${broken} Automat${broken === 1 ? '' : 'en'} defekt: Reparatur mit Ersatzteil.`
        : worn > 0
          ? `${worn} Automat${worn === 1 ? '' : 'en'} wartungsbeduerftig.`
          : 'Alle Automaten laufen im gruenen Bereich.';
  return {
    owned,
    area: propertyWorld(world)?.area?.id ?? null,
    total: machines.length,
    running: machines.filter((machine) => machine.band !== 'BROKEN').length,
    worn,
    broken,
    seats: machines.reduce((sum, machine) => sum + machine.seats, 0),
    occupied: machines.reduce((sum, machine) => sum + machine.occupants, 0),
    cost: maintenanceCost(world),
    house,
    due,
    note,
  };
}

/**
 * Einen Automaten warten. Erst pruefen (Eigentum, Flaeche, Zustand, Konto), dann
 * buchen, erst danach den Zustand anfassen: ein Fehler hinterlaesst weder eine
 * halbe Wartung noch eine Buchung.
 */
export function maintainMachine(
  world: WorldState,
  ledger: Ledger,
  itemId: number,
  tick: number = world.tick,
): number {
  if (world.player.property === null) throw new Error('Ohne Immobilie gibt es keine Spielhalle.');
  const item = hallFurniture(world).find((entry) => entry.id === itemId);
  if (!item) throw new Error('Kein Spielautomat auf der eigenen Flaeche.');
  if (item.damaged || item.condition < 45) throw new Error(`${item.label} ist defekt: erst reparieren.`);
  if (item.condition >= MACHINE_FIT_CONDITION) throw new Error(`${item.label} ist in Ordnung; keine Wartung noetig.`);
  const cost = maintenanceCost(world);
  const balance = ledger.getBalance(HAUSKONTO);
  if (balance < cost) throw new Error(`Betriebskonto zu niedrig: ${toVCString(cost)} noetig, ${toVCString(balance)} vorhanden.`);
  const before = Math.round(item.condition);
  ledger.transfer(HAUSKONTO, SHOP, cost, `${TX_PREFIX.MAINTENANCE}${item.label}`, tick);
  item.condition = Math.min(100, item.condition + MAINTENANCE_GAIN);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: MAINTENANCE_SUBJECT,
    cause: `Wartung ${item.label}`,
    effect: `Zustand ${before} % -> ${Math.round(item.condition)} %; ${toVCString(cost)} vom Betriebskonto, kein Ersatzteil verbraucht.`,
  });
  world.lastEvent = `${item.label} gewartet: ${before} % -> ${Math.round(item.condition)} %, ${toVCString(cost)} vom Betriebskonto.`;
  return Math.round(item.condition);
}

/** Was die Halle an einem Tag an Wartung kosten wuerde, wenn alles faellige drankommt. */
export function maintenanceDueCost(view: MachineHallView): VaCoinMicro {
  return (view.due.length * view.cost) as VaCoinMicro;
}
