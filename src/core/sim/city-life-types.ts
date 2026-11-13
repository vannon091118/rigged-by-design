/**
 * @module city-life-types — persistierbarer Lebenszustand der benannten Stadt-NPCs
 *
 * Die Stadt ist kein Standbild: Rita, Boris und Mira folgen ihrer Tagesroutine,
 * bewegen sich zwischen Wohnung, Kiez und Markt und tragen ihre Beduerfnisse,
 * Faehigkeiten, Beziehungen und Erinnerungen ueber Tagesgrenzen und Save/Load
 * hinweg. Die Typen bleiben frei von Welt-Imports, damit Save, Migration und UI
 * denselben Vertrag teilen.
 */
import type { NpcIntentKind, NpcNeeds } from './npc-types';
import type { CityTravel } from './city-life-movement';
import type { Point } from './types-model';

export type CityLifePlace = 'HOME' | 'KIEZ' | 'MARKT' | 'CASINO';

/** Attribute, die eine Entscheidung tragen; sie sind kein Anzeigewert. */
export interface NpcAttributes {
  readonly charisma: number;
  readonly intellect: number;
}

/** Faehigkeiten wachsen aus der tatsaechlichen Handlung. */
export interface NpcSkills {
  readonly cooking: number;
  readonly work: number;
  readonly social: number;
}

/** Strukturierte Erinnerung eines Bewohners; keine kopierte Prosa. */
export interface NpcMemory {
  readonly id: number;
  readonly tick: number;
  readonly kind: 'MEAL' | 'SOCIAL' | 'RUMOR' | 'WORK';
  readonly aboutNpcId: string | null;
  readonly sentiment: number;
  readonly confidence: number;
}

export interface CityResidentState {
  readonly npcId: string;
  /** Individuelle Kennung des Profils; `null` nur bis zur ersten Bindung. */
  readonly visitorId: number | null;
  readonly name: string;
  readonly role: string;
  readonly location: CityLifePlace;
  /** Kachel in der Stadt; der Ort wechselt erst bei Ankunft. */
  readonly position: Point;
  /** Laufender Weg; `null` heisst: steht still. */
  readonly travel: CityTravel | null;
  readonly intent: NpcIntentKind;
  readonly needs: NpcNeeds;
  readonly attributes: NpcAttributes;
  readonly skills: NpcSkills;
  /** Gerichtete Beziehung zu anderen Bewohnern, -100..100. */
  readonly relationships: Readonly<Record<string, number>>;
  readonly memories: readonly NpcMemory[];
  readonly lastHour: number;
  readonly lastDay: number;
}

export type CityDecisionFamily =
  | 'hunger' | 'thirst' | 'fatigue' | 'routine' | 'traits' | 'attributes'
  | 'skills' | 'emotion' | 'relationship' | 'memory' | 'social' | 'environment';

export interface CityDecisionFactor {
  readonly family: CityDecisionFamily;
  readonly detail: string;
  readonly value: number | string;
  readonly delta: number;
}

export interface CityDecisionAlternative {
  readonly intent: NpcIntentKind;
  readonly score: number;
}

export interface CityDecisionCounterfactual {
  readonly family: CityDecisionFamily;
  readonly intent: NpcIntentKind;
  readonly changed: boolean;
  readonly detail: string;
}

interface CityDecisionEnvironment {
  readonly day: number;
  readonly hour: number;
  readonly location: CityLifePlace;
  readonly present: readonly string[];
  readonly cash: number;
  readonly mood: number;
}

interface CityDecisionOutcome {
  readonly moneyDelta: number;
  readonly hungerDelta: number;
  readonly thirstDelta: number;
  readonly fatigueDelta: number;
  readonly socialDelta: number;
  readonly moodDelta: number;
  readonly cookingDelta: number;
  readonly workDelta: number;
  readonly socialSkillDelta: number;
  readonly memoryCreatedId: number | null;
  readonly memoryKind: 'MEAL' | 'SOCIAL' | 'RUMOR' | 'WORK' | null;
}

/** Eine nachvollziehbare Entscheidung samt Gegenfakt-Proben. */
export interface CityLifeDecision {
  readonly id: number;
  readonly tick: number;
  readonly day: number;
  readonly hour: number;
  readonly npcId: string;
  readonly npcName: string;
  readonly scheduledIntent: NpcIntentKind;
  readonly intent: NpcIntentKind;
  readonly location: CityLifePlace;
  readonly previousLocation: CityLifePlace;
  readonly reasons: readonly string[];
  readonly factors: readonly CityDecisionFactor[];
  readonly alternatives: readonly CityDecisionAlternative[];
  readonly counterfactuals: readonly CityDecisionCounterfactual[];
  readonly environment: CityDecisionEnvironment;
  readonly memoryId: number | null;
  readonly relationship: { readonly npcId: string; readonly value: number } | null;
  readonly outcome: CityDecisionOutcome;
  readonly socialTarget: string | null;
}

export interface CityLifeState {
  readonly residents: readonly CityResidentState[];
  /** Seed der Stadt-Simulation; alte Saves starten bei 0. */
  readonly seed?: number;
  readonly decisionSeq?: number;
  readonly memorySeq?: number;
  /** Letzte Entscheidungen je Bewohner; der Langlauf sammelt sie ein. */
  readonly lastDecisions?: readonly CityLifeDecision[];
}

/** Flache, UI-taugliche Sicht auf einen Bewohner; keine Weltobjekte. */
export interface CityResidentView {
  readonly npcId: string;
  readonly name: string;
  readonly role: string;
  readonly location: CityLifePlace;
  readonly locationLabel: string;
  /** Ziel des laufenden Wegs; `null` heisst: steht still. */
  readonly travelTo: string | null;
  readonly position: Point;
  readonly intent: NpcIntentKind;
  readonly intentLabel: string;
  readonly hunger: number;
  readonly thirst: number;
  readonly fatigue: number;
  readonly social: number;
  readonly mood: number;
  readonly traits: readonly string[];
}
