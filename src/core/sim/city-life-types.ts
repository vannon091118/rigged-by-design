/**
 * @module city-life-types — persistierbarer Lebenszustand der benannten Stadt-NPCs
 *
 * Die Stadt ist kein Standbild: Rita, Boris und Mira folgen ihrer Tagesroutine,
 * bewegen sich zwischen Wohnung, Kiez und Markt und tragen ihre Beduerfnisse
 * ueber Tagesgrenzen und Save/Load hinweg. Die Typen bleiben frei von
 * Welt-Imports, damit Save, Migration und UI denselben Vertrag teilen.
 */
import type { NpcIntentKind, NpcNeeds } from './npc-types';

export type CityLifePlace = 'HOME' | 'KIEZ' | 'MARKT' | 'CASINO';

export interface CityResidentState {
  readonly npcId: string;
  readonly name: string;
  readonly role: string;
  readonly location: CityLifePlace;
  readonly intent: NpcIntentKind;
  readonly needs: NpcNeeds;
  readonly lastHour: number;
  readonly lastDay: number;
}

export interface CityLifeState {
  readonly residents: readonly CityResidentState[];
}

/** Flache, UI-taugliche Sicht auf einen Bewohner; keine Weltobjekte. */
export interface CityResidentView {
  readonly npcId: string;
  readonly name: string;
  readonly role: string;
  readonly location: CityLifePlace;
  readonly locationLabel: string;
  readonly intent: NpcIntentKind;
  readonly intentLabel: string;
  readonly hunger: number;
  readonly thirst: number;
  readonly fatigue: number;
  readonly social: number;
  readonly mood: number;
  readonly traits: readonly string[];
}
