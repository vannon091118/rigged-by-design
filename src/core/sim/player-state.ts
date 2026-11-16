/**
 * Der Spielerzustand als eigener Vertrag: Position, Beduerfnisse, Job, Eigentum
 * und Fach-Skills. `types-model.ts` re-exportiert diese Typen, damit alle
 * bestehenden Importpfade stabil bleiben.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import type { PlayerRpgState } from './player-rpg';
import type { PlayerSkillState } from './player-skills';
import type { ClothingState } from './clothing';
import type { JobTaskType, PlayerJobId, Point, PropertyId, RivalId } from './types-model';

export interface PlayerJobTask {
  readonly stationId: string; readonly taskType: JobTaskType;
  ticksElapsed: number; readonly ticksTotal: number;
}

export interface PlayerJobState {
  readonly jobId: PlayerJobId; readonly rivalId: RivalId; readonly stationId: string;
  currentTask: PlayerJobTask | null; workDays: number; lastPaidDay: number;
  /** Tag der zuletzt abgeschlossenen Schicht; 0 heisst: noch nie gearbeitet. */
  lastWorkDay: number;
  /** Aktuelle Karriere-Rangstufe (1 = Anfaenger, 2+ = befoerdert). Teil des Save-Zustands. */
  careerRank: number;
  /** Leistungspunkte der letzten abgeschlossenen Schichten (0-100 je Schicht). */
  performanceHistory: number[];
  /** Gebaeude-ID, auf die sich der Spieler beworben hat (null = keine Bewerbung offen). */
  appliedTo: string | null;
  /** Gebaeude-ID, die dem Spieler ein Job-Angebot gemacht hat (null = kein Angebot). */
  offeredBy: string | null;
}

export interface JobStationDef {
  readonly id: string; readonly jobId: PlayerJobId; readonly x: number; readonly y: number;
  readonly w: number; readonly h: number; readonly label: string; readonly description: string;
}

/** Eigentum als Datensatz: welche Immobilie, zu welchem Preis, an welchem Tag. */
export interface OwnedProperty {
  readonly id: PropertyId;
  readonly priceVC: VaCoinMicro;
  readonly day: number;
}

export interface PlayerBilling {
  /** Tag der zuletzt abgerechneten Periode; verhindert Doppelabbuchung nach Reload. */
  lastBilledDay: number;
  /** Anzahl der Perioden mit offener Rechnung; steigt nur im Verzug. */
  overdueWeeks: number;
}

export interface PlayerNeeds {
  /** 0 = satt, 100 = dringend; der Tick hebt den Wert, Essen senkt ihn. */
  hunger: number;
  /** 0 = satt, 100 = dringend; Trinken senkt den Wert. */
  thirst: number;
}

export interface Player {
  position: Point; path: Point[]; pathIndex: number; carrying: string; rpg: PlayerRpgState;
  /** Persistente Spielerbeduerfnisse; Teil desselben Zustands wie Position und RPG. */
  needs: PlayerNeeds;
  job: PlayerJobState | null; barPurchased: boolean;
  /** Erste Gewerbeimmobilie; null heisst: noch kein Eigentum. */
  property: OwnedProperty | null;
  /** Spieler-Fach-Skills (Learn-by-Doing); separat von den RPG-Attributen. */
  skills: PlayerSkillState;
  /** Gekaufte Kleidung und die zwei Trage-Slots; Teil desselben Save-Zustands. */
  clothing: ClothingState;
  /** Woechentliche Abrechnung: Merker und Verzug, kein zweiter Geldzaehler. */
  billing: PlayerBilling;
}
