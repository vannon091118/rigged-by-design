/** Gemeinsame Formen der Pokerrunde: Tisch, Spieler, Ergebnis. */
import type { Card } from '../rng/shoe';

export type PokerStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

/** Drei Gegnertypen mit eigener Range, Aggression und Einsatzgroesse. */
export type PokerStyleId = 'FELS' | 'HAI' | 'BUCHHALTER';

export interface PokerPlayer {
  readonly id: string;
  readonly human: boolean;
  readonly hole: readonly Card[];
  /** Nur Gäste tragen ein Profil; der Mensch entscheidet selbst. */
  readonly style?: PokerStyleId;
  /** Spielerobjekte werden pro Aktion neu erzeugt; nie wird ein geteiltes geaendert. */
  stack: number;
  /** Kumulativer Einsatz ueber alle Strassen (fuer Pot und Side Pots). */
  committed: number;
  /** Einsatz der aktuellen Strasse (fuer Call/Raise-Berechnung, wird pro Strasse zurueckgesetzt). */
  streetCommitted: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export interface PokerResult {
  /** Auszahlung bezogen auf den Buy-in: Ruestgeld zurueck plus Potanteil. */
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  /** Nettogewinn ueber den Buy-in hinaus. */
  readonly net: boolean;
}

export interface PokerTable {
  readonly players: readonly PokerPlayer[];
  readonly board: readonly Card[];
  /** Kartenschuh der Hand: eine gezogene Karte fehlt danach ueberall. */
  readonly shoe: import('../rng/shoe').CardShoe;
  readonly pot: number;
  /** Buy-in des Spielers an Position 0; alles andere ist Tischgeld. */
  readonly stake: number;
  /** Setzeinheit: ein Viertel des Buy-ins, kaufmaennisch abgerundet. */
  readonly unit: number;
  readonly street: PokerStreet;
  /** Naechster Spieler, -1 wenn niemand mehr ziehen muss. */
  readonly toAct: number;
  readonly bet: number;
  readonly raises: number;
  readonly result: PokerResult | null;
}

export interface PokerHandOptions {
  readonly stake: number;
  readonly opponents?: number;
}
