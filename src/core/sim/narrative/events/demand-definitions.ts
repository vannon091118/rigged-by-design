/** Datengetriebene Nachfrageveranstaltungen; Auswahl und Ankuendigung bleiben in `demand.ts`. */
import type { DemandEventKind } from '../../types';

interface DemandEventDefinition {
  readonly kind: DemandEventKind;
  readonly label: string;
  /** Gaeste pro Tag, die die Veranstaltung zusaetzlich bringt. */
  readonly perDay: number;
  /** Laufzeit ab Start; die Anzeige rechnet daraus `ticksLeft`. */
  readonly durationTicks: number;
  /** Anteil der Gruppen, die waehrend der Veranstaltung ein Mitglied mehr bekommen. */
  readonly groupChance: number;
  readonly groupMean: number;
  readonly startMessage: string;
  /** Genug fuer wiederkehrende Veranstaltungen, aber endlich. */
  readonly maxOccurrences: number;
}

export const DEMAND_EVENT_DEFINITIONS: Readonly<Record<DemandEventKind, DemandEventDefinition>> = {
  NEON_NACHT: {
    kind: 'NEON_NACHT', label: 'Neon-Nacht', perDay: 20, durationTicks: 150,
    groupChance: 0.55, groupMean: 0.55,
    startMessage: 'Neon-Nacht: Die Straße leuchtet, der Laden füllt sich.',
    maxOccurrences: 500,
  },
  TURNIER_ABEND: {
    kind: 'TURNIER_ABEND', label: 'Turnierabend', perDay: 16, durationTicks: 150,
    groupChance: 0.55, groupMean: 0.55,
    startMessage: 'Turnierabend: Die Tische sind reserviert, Gäste kommen in Gruppen.',
    maxOccurrences: 500,
  },
};

export const demandDefinition = (kind: DemandEventKind): DemandEventDefinition => DEMAND_EVENT_DEFINITIONS[kind];

export function isDemandEventId(value: string): value is DemandEventKind {
  return Object.hasOwn(DEMAND_EVENT_DEFINITIONS, value);
}
