/**
 * @module fight-bet-register — offene Wettscheine als eigener Zustand
 *
 * Ein Schein ist Geld: Der Einsatz ist beim Platzieren gebucht, die Auszahlung
 * haengt an genau diesem Schein. Deshalb lebt er in einem eigenen, begrenzten
 * Register im Save — nicht im Journal, dessen Archiv bei 2000 Eintraegen von
 * vorne gekappt wird. Die Quote steht als Basispunkt-Ganzzahl am Schein, damit
 * die Abrechnung integer rechnet und keinen Text liest.
 */
import { mulVC, type VaCoinMicro } from '../economy/vacoin';
import { adoptFightBetsFromArchive, normalizeStoredFightBets } from './fight-bet-register-legacy';
import type { JournalEvent } from './journal';

export type FightBetPick = 'A' | 'B' | 'KO' | 'PUNKTE';

export const SLIP_SUBJECT = 'WETTSCHEIN';
export const SETTLE_SUBJECT = 'WETTABRECHNUNG';
export const UNDERCARD_SUBJECT = 'VORKAMPF';

export interface FightBetSlip {
  readonly id: number;
  readonly eventId: number;
  readonly pick: FightBetPick;
  readonly stake: VaCoinMicro;
  /** Fixierte Quote in Basispunkten: 185 = Quote 1.85. */
  readonly oddsBp: number;
}

export interface UndercardResult {
  readonly eventId: number;
  readonly a: string;
  readonly b: string;
  readonly winner: 'A' | 'B';
  readonly method: 'KO' | 'PUNKTE';
  readonly rounds: number;
}

export interface FightBetState {
  /** Naechste freie Schein-Nummer; waechst monoton und ueberlebt den Save. */
  nextSlipId: number;
  /** Abgegeben und noch nicht abgerechnet. */
  open: FightBetSlip[];
  /** Der entschiedene Vorkampf des laufenden Abends. */
  undercard: UndercardResult | null;
}

export const emptyFightBets = (): FightBetState => ({ nextSlipId: 1, open: [], undercard: null });

interface FightBetHost {
  fightBets?: FightBetState;
}

/** Das Register der Welt; alte Saves bekommen es beim Laden oder hier einmalig. */
function fightBetsOf(world: FightBetHost): FightBetState {
  if (!world.fightBets) world.fightBets = emptyFightBets();
  return world.fightBets;
}

/** Ein neuer Schein mit eigener Nummer; der Aufrufer bucht den Einsatz. */
export function registerSlip(world: FightBetHost, slip: Omit<FightBetSlip, 'id'>): FightBetSlip {
  const state = fightBetsOf(world);
  const entry: FightBetSlip = { ...slip, id: state.nextSlipId };
  state.nextSlipId += 1;
  state.open.push(entry);
  return entry;
}

/** Nimmt den Schein aus dem Register; true, wenn er offen war. */
export function closeSlip(world: FightBetHost, slipId: number): boolean {
  const state = fightBetsOf(world);
  const index = state.open.findIndex((slip) => slip.id === slipId);
  if (index < 0) return false;
  state.open.splice(index, 1);
  return true;
}

/** Die Auszahlung eines gewonnenen Scheins: integer, Floor zugunsten der Bank. */
export function payoutOf(slip: FightBetSlip): VaCoinMicro {
  return mulVC(slip.stake, slip.oddsBp);
}

export function openSlipsOf(world: FightBetHost): readonly FightBetSlip[] {
  return fightBetsOf(world).open;
}

export function recordUndercard(world: FightBetHost, result: UndercardResult): void {
  fightBetsOf(world).undercard = { ...result };
}

/** Das Vorkampf-Ergebnis eines Abends; ohne Register-Eintrag null. */
export function undercardOf(world: FightBetHost, eventId: number): UndercardResult | null {
  const found = fightBetsOf(world).undercard;
  return found && found.eventId === eventId ? { ...found } : null;
}

/** Laedt das Register aus dem Save; ohne Feld wird es aus dem Archiv adoptiert. */
export function normalizeFightBets(
  raw: unknown,
  archive: readonly JournalEvent[] = [],
): FightBetState {
  if (typeof raw !== 'object' || raw === null) return adoptFightBetsFromArchive(archive);
  return normalizeStoredFightBets(raw as Record<string, unknown>);
}
