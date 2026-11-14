/**
 * Qualifikation des Personals.
 *
 * Eine Stufe je Agent ist der einzige Ort, an dem "besser" definiert ist: Lohn
 * und Bewertung lesen hier, damit nicht zwei Stellen dieselbe Wirkung erfinden.
 * Die Stufe gehoert zum Agenten (nicht zur Rolle), damit zwei Reinigungskraefte
 * unterschiedlich bezahlt und unterschiedlich bewertet werden koennen.
 */
import { mulVC, type VaCoinMicro } from '../economy/vacoin';

export type StaffQualification = 'LEHRLING' | 'GESELLE' | 'MEISTER';

interface StaffQualificationRule {
  /** Rangfolge fuer Anzeige und Auftragsvergabe; hoeher arbeitet zuerst. */
  readonly rank: number;
  /** Lohn in Basispunkten des Rollensatzes (10.000 = voller Satz). */
  readonly wageBps: number;
  /** Zuschlag auf die geleistete Arbeit in Ticks, bevor bewertet wird. */
  readonly workBonus: number;
  readonly label: string;
}

export const STAFF_QUALIFICATION_RULES: Readonly<Record<StaffQualification, StaffQualificationRule>> = {
  LEHRLING: { rank: 1, wageBps: 8_000, workBonus: 0, label: 'Lehrling' },
  GESELLE: { rank: 2, wageBps: 10_000, workBonus: 25, label: 'Geselle' },
  MEISTER: { rank: 3, wageBps: 13_000, workBonus: 60, label: 'Meister' },
};

const STAFF_QUALIFICATIONS: readonly StaffQualification[] = ['LEHRLING', 'GESELLE', 'MEISTER'];

/**
 * Neueinstellung: die Stufe folgt deterministisch aus der Agenten-ID. Kein
 * Wuerfeln im Spielpfad und keine Auswahl, die der Spieler nicht sieht.
 */
export function qualificationForAgent(id: number): StaffQualification {
  const index = (Math.abs(Math.trunc(id)) * 7) % STAFF_QUALIFICATIONS.length;
  return STAFF_QUALIFICATIONS[index]!;
}

/** Lohn einer Stufe aus dem Rollensatz; der Satz selbst bleibt eine Quelle. */
export function staffWage(base: VaCoinMicro, qualification: StaffQualification): VaCoinMicro {
  return mulVC(base, STAFF_QUALIFICATION_RULES[qualification].wageBps);
}

/** Was die Stufe zur geleisteten Arbeit beitraegt, bevor die Stufen greifen. */
export function qualificationWorkBonus(qualification: StaffQualification): number {
  return STAFF_QUALIFICATION_RULES[qualification].workBonus;
}

/** Rang der Stufe: Auftragsvergabe nimmt den hoechsten zuerst. */
export function qualificationRank(qualification: StaffQualification): number {
  return STAFF_QUALIFICATION_RULES[qualification].rank;
}

export function qualificationLabel(qualification: StaffQualification): string {
  return STAFF_QUALIFICATION_RULES[qualification].label;
}
