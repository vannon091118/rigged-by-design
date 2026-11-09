/**
 * Typen der Stadt. Reine Beschreibung von Zustand und Sicht, keine Logik -
 * damit Core, Store und UI dieselbe Form teilen, ohne Zyklen zu bauen.
 */
export type CityLocationId = 'CASINO' | 'KIEZ' | 'MARKT';
export type CityBranchId = 'KIEZ' | 'MARKT';

/** Die 30 Eigenschaften, die Wissen, Redseligkeit und Glaubwuerdigkeit faerben. */
export type TraitId =
  | 'KONSUMENT' | 'LASTERMAUL' | 'MITLAEUFER' | 'EINZELGAENGER' | 'GERUECHTEMACHER'
  | 'VERSCHWIEGEN' | 'HILFSBEREIT' | 'MISSTRAUISCH' | 'LEICHTGLAEUBIG' | 'PRAHLER'
  | 'BESCHEIDEN' | 'RAUCHER' | 'TRINKER' | 'SPIELER' | 'GEIZHALS'
  | 'GROSSZUEGIG' | 'NEUGIERIG' | 'DESINTERESSIERT' | 'LOYAL' | 'VERRAETER'
  | 'EHRLICH' | 'VERSCHLAGEN' | 'RUHEPOL' | 'CHAOT' | 'SPARSAM'
  | 'MITTEILSAM' | 'SCHUECHTERN' | 'STOLZ' | 'BEOBACHTER' | 'FUERSORGLICH';

/** 1 = angelegt, 2 = gefestigt, 3 = starke Auspraegung. */
export type TraitIntensity = 1 | 2 | 3;

/** Eine gehaltene Eigenschaft; `progress` sammelt Praegung bis zur naechsten Stufe. */
export interface TraitState {
  readonly id: TraitId;
  readonly intensity: TraitIntensity;
  readonly progress: number;
}

/** Die drei sozialen Handlungen einer Begegnung; jede bucht Geld und Beziehung. */
export type EncounterAction = 'GEBEN' | 'HELFEN' | 'ABLEHNEN';
export const ENCOUNTER_ACTIONS: readonly EncounterAction[] = ['GEBEN', 'HELFEN', 'ABLEHNEN'];

/**
 * Eine abgeschlossene Begegnung. Der Datensatz ist die Erinnerung des Ortes:
 * Name, Handlung und Tag bleiben erhalten, damit der naechste Dialog sie nennt.
 */
export interface CityEncounterRecord {
  readonly npcId: number;
  readonly name: string;
  readonly location: CityLocationId;
  readonly day: number;
  readonly tick: number;
  readonly action: EncounterAction;
  /** Aus dem Portemonnaie bezahlter Betrag in Mikro-VaCoins. */
  readonly amount: number;
  /** Beziehungswert dieses NPCs zum Spieler nach der Handlung. */
  readonly trust: number;
}

export interface CityState {
  /** Wo der Charakter gerade steht. */
  readonly location: CityLocationId;
  /** Tag, fuer den die Energie gilt; ein neuer Tag fuellt sie auf. */
  energyDay: number;
  energy: number;
  /** Fortschrittspunkte je Zweig, nie negativ. */
  KIEZ: number;
  MARKT: number;
  /** Besuche je Ort, damit der Text nicht bei jedem Klick derselbe ist. */
  visits: Readonly<Record<CityLocationId, number>>;
  /** Letztes sichtbares Ergebnis der Stadt (Rang, Text, Wirkung). */
  lastResult: string;
  lastText: string;
  /** Abgeschlossene Zweige; ein Abschluss bleibt bestehen. */
  completed: readonly CityBranchId[];
  /** Begegnungen im Ort, aelteste zuerst; die Quelle der Erinnerung im Dialog. */
  encounters?: readonly CityEncounterRecord[];
}

export interface CityActionView {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly energy: number;
  readonly branch: CityBranchId;
  readonly progress: number;
  readonly enabled: boolean;
  readonly blocked: string;
}

export interface CityBranchView {
  readonly id: CityBranchId;
  readonly name: string;
  readonly tier: string;
  readonly next: string | null;
  readonly points: number;
  readonly need: number;
  readonly done: boolean;
  readonly unlocked: boolean;
}

export interface CityView {
  readonly location: CityLocationId;
  readonly locationName: string;
  readonly note: string;
  readonly energy: number;
  readonly energyMax: number;
  readonly branches: readonly CityBranchView[];
  readonly actions: readonly CityActionView[];
  readonly locations: readonly { readonly id: CityLocationId; readonly name: string; readonly here: boolean; readonly locked: boolean }[];
  readonly lastText: string;
  readonly lastResult: string;
  readonly completed: readonly CityBranchId[];
}

export interface ActionDef {
  readonly id: string;
  readonly location: CityLocationId;
  readonly label: string;
  readonly hint: string;
  readonly energy: number;
  readonly branch: CityBranchId;
  readonly progress: number;
  /** Ruf, den die Handlung dem Haus bringt (0..100-Skala). */
  readonly reputation: number;
}
