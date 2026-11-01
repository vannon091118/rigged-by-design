/**
 * Fremde Casinos: eigene Betreiber, eigene Maschinen, eigene Regeln.
 * Sie nutzen dieselben Spiele, Mods und Personas wie das eigene Haus.
 * Der Zustand wird deterministisch aus (Betreiber, Tick) abgeleitet, nicht mitgetickt.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { GameExtras, GameResult } from '../games/contracts';
import type { Prng } from '../rng/prng';
import { foreignRound } from './actions';
import { PORTEMONNAIE } from './money';
import { resolveModEffects } from './offers';
import type { GameId, ModId, PersonaId, RivalId, JobStationDef } from './types';

export type { RivalId };

interface RivalMachine {
  readonly game: GameId;
  readonly mods: readonly ModId[];
  readonly baseBet: VaCoinMicro;
  readonly label: string;
}

interface RivalOperator {
  readonly id: RivalId;
  readonly name: string;
  readonly operator: string;
  readonly style: string;
  readonly size: number;
  readonly reputation: number;
  readonly security: number;
  /** Hausvorteil des fremden Betreibers in Basispunkten. */
  readonly edgeBps: number;
  readonly minBet: VaCoinMicro;
  readonly personas: readonly PersonaId[];
  readonly machines: readonly RivalMachine[];
  /** Arbeitsplaetze auf diesem Floor, an denen der Spieler jobs annehmen kann. */
  readonly jobStations: readonly JobStationDef[];
}

const machine = (game: GameId, label: string, betVC: number, mods: readonly ModId[] = []): RivalMachine =>
  ({ game, label, baseBet: fromVC(betVC), mods });

/** Die fremden Haeuser sind fruehe Lernorte: klein, guenstig, eigene Regeln. */
export const RIVALS: readonly RivalOperator[] = [
  {
    id: 'HAFENKLAUSE', name: 'Hafenklause', operator: 'Kalle "Kleingeld" Puhl',
    style: 'Verrauchte Hafenkneipe mit zwei Automaten und einem Hütchenspieler.',
    size: 30, reputation: 22, security: 1, edgeBps: 320, minBet: fromVC(0.05),
    personas: ['LUMPEN', 'STREET', 'STAMMGAST'],
    machines: [
      machine('SLOT', 'Klappriger Automat', 0.1, ['CHERRY']),
      machine('SHELL', 'Hütchen an der Theke', 0.1),
    ],
    jobStations: [
      { id: 'PUTZ_1', jobId: 'CLEANER', x: 6, y: 6, w: 2, h: 1, label: 'Putzstation', description: 'Flecken entfernen, Gäste begrüßen. Trainiert: Wahrnehmung, Speed, Ausdauer.' },
      { id: 'BAR_1', jobId: 'BARTENDER', x: 6, y: 16, w: 2, h: 1, label: 'Bar-Theke', description: 'Drinks zapfen, Streit schlichten. Trainiert: Charisma, Brawl, Wahrnehmung, Ausdauer.' },
    ],
  },
  {
    id: 'GOLDENE_HAND', name: 'Goldene Hand', operator: 'Marlene Vest',
    style: 'Gepflegter Salon mit Tischen, Samt und aufmerksamem Personal.',
    size: 60, reputation: 58, security: 3, edgeBps: 210, minBet: fromVC(0.25),
    personas: ['BUSINESS', 'STAMMGAST', 'STREET'],
    machines: [
      machine('BLACKJACK', 'Blackjack am Samt', 0.25, ['VELVET']),
      machine('POKER', 'Poker mit Hausregel', 0.5, ['NEAR_MISS']),
      machine('VIDEO_POKER', 'Video Poker am Samt', 0.25, ['VELVET']),
      machine('SLOT', 'Münzautomat', 0.25, ['NEON', 'CHERRY']),
      machine('DICE', 'Würfel am Samt', 0.25, ['VELVET']),
    ],
    jobStations: [
      { id: 'TISCH_1', jobId: 'CARD_DEALER', x: 10, y: 10, w: 1, h: 1, label: 'Kartentisch', description: 'Karten geben, Wetten managen. Trainiert: Technik, Speed, Glück, Wahrnehmung.' },
    ],
  },
  {
    id: 'NEBELPALAST', name: 'Nebelpalast', operator: 'Das Konsortium',
    style: 'Anonymer Hochhaussaal. Hohe Einsätze, viel Sicherheit, wenig Geduld.',
    size: 90, reputation: 81, security: 5, edgeBps: 140, minBet: fromVC(1),
    personas: ['HIGH_ROLLER', 'BUSINESS'],
    machines: [
      machine('ROULETTE', 'Roulette mit hohem Limit', 1, ['EXTRA_REEL']),
      machine('PLINKO', 'Plinko-Wand', 1, ['NEON', 'NEAR_MISS']),
      machine('POKER', 'Stille Pokerrunde', 1, ['VELVET']),
    ],
    jobStations: [
      { id: 'WERKSTATT_1', jobId: 'MECHANIC', x: 15, y: 15, w: 2, h: 2, label: 'Werkstatt', description: 'Automaten reparieren, Hochspannung. Trainiert: Technik, Brawl, Ausdauer, Wahrnehmung.' },
    ],
  },
];

const INDEX = new Map(RIVALS.map((rival) => [rival.id, rival]));

export function getRival(id: RivalId): RivalOperator {
  const rival = INDEX.get(id);
  if (!rival) throw new Error(`Unbekanntes fremdes Casino: ${id}`);
  return rival;
}

/** Kleiner stabiler Hash: gleiche Eingabe, gleiches Ergebnis, ohne den Welt-PRNG zu verbrauchen. */
function hash32(text: string, step: number): number {
  let h = 0x811c9dc5 ^ step;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return (h ^ (h >>> 15)) >>> 0;
}

const DRIFT_TICKS = 600;

interface RivalState {
  readonly id: RivalId;
  readonly name: string;
  readonly operator: string;
  readonly style: string;
  readonly reputation: number;
  readonly security: number;
  readonly edgeBps: number;
  readonly attractiveness: number;
  readonly personas: readonly PersonaId[];
  readonly machines: readonly RivalMachine[];
  readonly jobStations: readonly JobStationDef[];
}

/** Ruf und Ausstattung driften langsam und reproduzierbar; kein Tickaufwand pro Haus. */
export function rivalState(rival: RivalOperator, tick: number): RivalState {
  const steps = Math.max(0, Math.floor(tick / DRIFT_TICKS));
  let reputation = rival.reputation;
  for (let step = 1; step <= steps; step += 1) {
    const roll = hash32(rival.id, step) % 5;
    reputation += roll === 0 ? -2 : roll === 4 ? 2 : 0;
    reputation = Math.max(5, Math.min(99, reputation));
  }
  const attractiveness = rival.machines.reduce((sum, entry) =>
    sum + Math.round(entry.baseBet / 10_000) * 12 + Math.round(resolveModEffects(entry.game, entry.mods).attraction / 10), 0);
  return {
    id: rival.id, name: rival.name, operator: rival.operator, style: rival.style,
    reputation, security: rival.security, edgeBps: rival.edgeBps,
    attractiveness: Math.round(attractiveness), personas: rival.personas, machines: rival.machines,
    jobStations: rival.jobStations,
  };
}

export const rivalStates = (tick: number): RivalState[] => RIVALS.map((rival) => rivalState(rival, tick));

/** Effektiver Hausvorteil: Betreiber-Regel plus Mod-Aufschlag, nie unter null. */
export function rivalEdge(rival: RivalOperator, entry: RivalMachine): number {
  const bonus = resolveModEffects(entry.game, entry.mods).bonusBps;
  return Math.max(0, rival.edgeBps + bonus);
}

interface RivalVisit {
  readonly result: GameResult;
  readonly machine: RivalMachine;
  readonly rival: RivalState;
  readonly edgeBps: number;
}

/**
 * Besuch: der Spieler setzt sein eigenes Portemonnaie. Die Buchung laeuft ueber
 * denselben Ledger-Pfad wie jedes fremde Spiel, damit kein Geld doppelt existiert.
 */
export function visitRival(
  ledger: Ledger,
  rivalId: RivalId,
  machineIndex: number,
  stake: VaCoinMicro,
  prng: Prng,
  tick: number,
  options: GameExtras = {},
): RivalVisit {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  if (stake < rival.minBet) throw new Error(`Mindesteinsatz im ${rival.name}: ${rival.minBet} Mikro.`);
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  if (stake <= ZERO_VC) throw new Error('Kein Einsatz.');
  const edgeBps = rivalEdge(rival, entry);
  const result = foreignRound(ledger, entry.game, stake, prng, tick, edgeBps, options);
  return { result, machine: entry, rival: rivalState(rival, tick), edgeBps };
}
