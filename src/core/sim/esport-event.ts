/**
 * E-Sport-Abend im vorhandenen Turnierabend (S3-09).
 *
 * Der Abend ist keine zweite Veranstaltung und braucht kein Save-Feld: er läuft
 * auf der bereits gespeicherten `TURNIER_ABEND`-Instanz. Teams, Rollen, Form und
 * Taktik kommen aus `esportTeams(world.day)`, das Ergebnis aus dem vorhandenen
 * PRNG, Geld ausschließlich aus dem Ledger (Einsatz und Auszahlung gegen
 * `EXTERNAL`, wie jeder Fremdmarkt), und das Ergebnis landet als Journal-Zeile
 * mit `refs.eventId` im Archiv — dort liest `esportView()` die Turnierhistorie.
 *
 * Bewusst offen gelassen: Teilnehmer- und Betreiberrolle (die Abnahme verlangt
 * den Zuschauer-Pfad). Der Kampfabend bleibt unberührt: der E-Sport-Abend löst
 * die geteilte Instanz nicht auf.
 */
import type { Ledger } from '../economy/ledger';
import { mulVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { ESPORT_TOURNAMENT_SUBJECT, esportTeams } from './esport';
import { ESPORT_STAKE, esportChanceBps, esportQuoteBps, type EsportPick, type EsportTactic } from './esport-odds';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { openVenueEvent, venueView } from './venue-event';

const TOURNAMENT = 'TURNIER_ABEND';

interface EsportSide {
  readonly id: string;
  readonly name: string;
  readonly tactic: EsportTactic;
  readonly form: number;
  readonly strength: number;
}

interface EsportMatchView {
  readonly home: EsportSide;
  readonly away: EsportSide;
  /** Siegchance des Heimteams in Basispunkten (0..10000). */
  readonly chanceBps: number;
  readonly stake: VaCoinMicro;
  /** Auszahlungsmultiplikator des Tipps in Basispunkten. */
  readonly quoteHomeBps: number;
  readonly quoteAwayBps: number;
  readonly played: boolean;
  readonly result: string | null;
}

/** Der Abend hängt am Turnierabend; `CLOSED` heißt: kein Einlass, kein Match. */
export interface EsportEveningView {
  readonly open: boolean;
  readonly phase: 'ADMISSION' | 'RUNNING' | 'CLOSED';
  readonly ticksLeft: number;
  readonly ready: boolean;
  readonly reason: string;
  readonly match: EsportMatchView;
}

interface EsportMatchResult {
  readonly won: boolean;
  readonly stake: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly notice: string;
}

/** Ein Ergebnis gehoert zu genau der Event-Instanz, an der es gespielt wurde. */
function playedAt(world: WorldState, eventId: number): string | null {
  return world.archive.find((entry) => entry.subject === ESPORT_TOURNAMENT_SUBJECT
    && entry.refs?.eventId === eventId)?.effect ?? null;
}

/** Die eine Abendsicht: Phase, Paarung, Quote und ob das Match schon lief. */
export function esportEveningView(world: WorldState, wallet: VaCoinMicro): EsportEveningView {
  const current = venueView(world).current;
  const live = current !== null && current.kind === TOURNAMENT
    && (current.phase === 'ADMISSION' || current.phase === 'RUNNING');
  const [home, away] = [...esportTeams(world.day)].sort((a, b) => b.strength - a.strength);
  const chanceBps = esportChanceBps(home!.strength, home!.tactic, away!.strength, away!.tactic);
  const played = live ? playedAt(world, current.id) : null;
  const match: EsportMatchView = {
    home: { id: home!.id, name: home!.name, tactic: home!.tactic, form: home!.form, strength: home!.strength },
    away: { id: away!.id, name: away!.name, tactic: away!.tactic, form: away!.form, strength: away!.strength },
    chanceBps,
    stake: ESPORT_STAKE,
    quoteHomeBps: esportQuoteBps(chanceBps),
    quoteAwayBps: esportQuoteBps(10_000 - chanceBps),
    played: played !== null,
    result: played,
  };
  const reason = !live
    ? 'Kein Turnierabend im Einlass: Der E-Sport-Abend laeuft nur waehrend des Turnierabends.'
    : played !== null
      ? `Match gespielt: ${played}`
      : wallet < ESPORT_STAKE
        ? `Einsatz fehlt: ${toVCString((ESPORT_STAKE - wallet) as VaCoinMicro)}.`
        : `${home!.name} (${home!.tactic}) gegen ${away!.name} (${away!.tactic}) · Einsatz ${toVCString(ESPORT_STAKE)} · Quote ${(match.quoteHomeBps / 10_000).toFixed(2)} / ${(match.quoteAwayBps / 10_000).toFixed(2)}.`;
  return {
    open: live,
    phase: live ? (current.phase as 'ADMISSION' | 'RUNNING') : 'CLOSED',
    ticksLeft: live ? current.ticksLeft : 0,
    ready: live && played === null && wallet >= ESPORT_STAKE,
    reason,
    match,
  };
}

/** Kündigt den Abend über den vorhandenen Scheduler an; ein laufender Abend bleibt. */
export function announceEsportEvening(world: WorldState): string {
  const current = venueView(world).current;
  if (current && current.kind === TOURNAMENT) throw new Error('Es läuft bereits ein Turnierabend.');
  const event = openVenueEvent(world, 'TURNIER_ABEND');
  if (!event) throw new Error('Kein Turnierabend angesetzt.');
  const notice = 'E-Sport-Abend angekündigt: Einlass und Paarung stehen im Turnierabend.';
  world.lastEvent = notice;
  return notice;
}

/**
 * Spielt das Match des Abends: Einsatz und Auszahlung sind Ledger-Zeilen gegen
 * `EXTERNAL`, das Ergebnis ist deterministisch aus Chancenwert und PRNG-Strom.
 */
export function playEsportMatch(
  world: WorldState, ledger: Ledger, prng: Prng, pick: EsportPick,
): EsportMatchResult {
  const evening = esportEveningView(world, ledger.getBalance(PORTEMONNAIE));
  if (!evening.open || evening.match.played || !evening.ready) throw new Error(evening.reason);
  const current = venueView(world).current!;
  const { home, away, chanceBps, quoteHomeBps, quoteAwayBps } = evening.match;
  const roll = prng.nextInt(0, 9_999);
  const homeWins = roll < chanceBps;
  const winnerScore = 13 + (roll % 5);
  const loserScore = Math.max(3, winnerScore - 2 - (roll % 3));
  const homeScore = homeWins ? winnerScore : loserScore;
  const awayScore = homeWins ? loserScore : winnerScore;
  ledger.transfer(PORTEMONNAIE, EXTERNAL, ESPORT_STAKE, TX_REASON.FOREIGN_STAKE, world.tick, 'esport');
  const won = (pick === 'HOME') === homeWins;
  const payout = won ? mulVC(ESPORT_STAKE, pick === 'HOME' ? quoteHomeBps : quoteAwayBps) : ZERO_VC;
  if (payout > ZERO_VC) {
    ledger.transfer(EXTERNAL, PORTEMONNAIE, payout, TX_REASON.FOREIGN_WIN, world.tick, 'esport');
  }
  const winner = homeWins ? home.name : away.name;
  const picked = pick === 'HOME' ? home.name : away.name;
  const money = won ? `Auszahlung ${toVCString(payout)}` : `Einsatz ${toVCString(ESPORT_STAKE)} verloren`;
  const notice = `${home.name} ${homeScore}:${awayScore} ${away.name} · ${winner} gewinnt · Tipp ${picked} · ${money}.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: ESPORT_TOURNAMENT_SUBJECT,
    cause: `${home.name} (${home.tactic}, Form ${home.form}, ${home.strength}) gegen ${away.name} (${away.tactic}, Form ${away.form}, ${away.strength}) · Chance ${chanceBps}/10000`,
    effect: notice,
    amount: won ? payout : ESPORT_STAKE,
    refs: { eventId: current.id },
  });
  world.lastEvent = notice;
  return { won, stake: ESPORT_STAKE, payout, homeScore, awayScore, notice };
}
