/**
 * E-Sport-Simulationsdaten: eine Stadtliga mit Team-Ankern aus den vorhandenen
 * Rivalen und Orten. Rollen, Attribute, Form und Taktik sind eine reine
 * Ableitung aus festem Liga-Seed und `world.day`; kein Save-Feld, keine zweite
 * Event-Liste, keine zweite Kampf-Engine.
 */
import { Prng } from '../rng/prng';
import type { JournalEvent } from './journal';
import type { WorldState } from './types';

export const ESPORT_TOURNAMENT_SUBJECT = 'ESPORT_TURNIER';
const ESPORT_LEAGUE_NAME = 'Stadtliga';
const ESPORT_SEED = 0x45535054;
const TEAM_COUNT = 6;
const ROLES = ['CAPTAIN', 'DUELIST', 'ANCHOR', 'SUPPORT', 'FLEX'] as const;
type EsportRole = (typeof ROLES)[number];
type EsportTactic = 'KONTROLLE' | 'DRUCK' | 'SPLIT' | 'SPAETSPIEL';
const TACTICS: readonly EsportTactic[] = ['KONTROLLE', 'DRUCK', 'SPLIT', 'SPAETSPIEL'];
const TEAM_NAMES = [
  'Hafenklause Hounds', 'Goldene Hand Five', 'Nebelpalast Nodes',
  'Kiez Kollektiv', 'Markt Mavericks', 'Casino Circuit',
] as const;
const FIRST_NAMES = ['Mira', 'Kian', 'Rune', 'Tessa', 'Nils', 'Aylin', 'Juri', 'Sena', 'Bex', 'Omar', 'Lina', 'Timo'];
const LAST_NAMES = ['Voss', 'Kern', 'Ried', 'Sander', 'Marek', 'Thiel', 'Brand', 'Falk', 'Reim', 'Stark'];

interface EsportPlayer {
  readonly id: string;
  readonly name: string;
  readonly role: EsportRole;
  readonly mechanics: number;
  readonly gameSense: number;
  readonly communication: number;
  readonly stamina: number;
}

interface EsportTeam {
  readonly id: string;
  readonly name: string;
  readonly tactic: EsportTactic;
  readonly form: number;
  readonly strength: number;
  readonly players: readonly EsportPlayer[];
}

interface EsportHistoryEntry {
  readonly day: number;
  readonly summary: string;
}

export interface EsportView {
  readonly league: string;
  readonly season: number;
  readonly teams: readonly EsportTeam[];
  readonly history: readonly EsportHistoryEntry[];
  readonly homeTeam: string;
  readonly note: string;
}

function strengthOf(players: readonly EsportPlayer[], form: number): number {
  const sum = players.reduce((total, player) => total
    + player.mechanics * 0.4 + player.gameSense * 0.35
    + player.communication * 0.15 + player.stamina * 0.1, 0);
  return Math.max(30, Math.min(99, Math.round(sum / players.length + (form - 50) * 0.15)));
}

function makeTeam(index: number, day: number): EsportTeam {
  const stable = new Prng((ESPORT_SEED + index * 7919) >>> 0);
  const players = ROLES.map((role): EsportPlayer => ({
    id: `team-${index}-${role.toLowerCase()}`,
    name: `${FIRST_NAMES[stable.nextInt(0, FIRST_NAMES.length - 1)]!} ${LAST_NAMES[stable.nextInt(0, LAST_NAMES.length - 1)]!}`,
    role,
    mechanics: stable.nextInt(35, 85),
    gameSense: stable.nextInt(35, 85),
    communication: stable.nextInt(35, 85),
    stamina: stable.nextInt(35, 85),
  }));
  const form = new Prng((ESPORT_SEED ^ Math.imul(day + index + 1, 0x9e3779b1)) >>> 0).nextInt(30, 90);
  return {
    id: `team-${index}`,
    name: TEAM_NAMES[index]!,
    tactic: TACTICS[index % TACTICS.length]!,
    form,
    players,
    strength: strengthOf(players, form),
  };
}

/** Die Liga eines Tages; Roster und Taktik bleiben, die Form folgt dem Tag. */
export function esportTeams(day: number): readonly EsportTeam[] {
  return Array.from({ length: TEAM_COUNT }, (_, index) => makeTeam(index, day));
}

/** Turniere kommen aus dem vorhandenen Archiv, nicht aus einem zweiten Zaehler. */
function esportHistory(events: readonly JournalEvent[]): readonly EsportHistoryEntry[] {
  return events
    .filter((entry) => entry.subject === ESPORT_TOURNAMENT_SUBJECT)
    .slice(-5)
    .reverse()
    .map((entry) => ({ day: entry.day, summary: entry.effect }));
}

/** Die eine Sicht: Tabelle, Saison und Historie aus derselben Ableitung. */
export function esportView(world: WorldState): EsportView {
  const teams = [...esportTeams(world.day)]
    .sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name));
  const leader = teams[0]!;
  return {
    league: ESPORT_LEAGUE_NAME,
    season: Math.floor((world.day - 1) / 7) + 1,
    teams,
    history: esportHistory(world.archive),
    homeTeam: leader.name,
    note: `${leader.name} fuehrt mit ${leader.strength}; die Form gilt fuer Tag ${world.day}.`,
  };
}
