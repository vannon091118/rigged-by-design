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
 * Drei getrennte Rollen auf derselben Instanz: Zuschauer setzen über den
 * Wettpfad, Teilnehmer melden sich im Einlass und spielen ihr eigenes Match,
 * der Veranstalter setzt die Paarung. Die Sicht steht in `esport-view.ts`, die
 * Rollenwahl in `esport-roles.ts`; hier wird nur abgerechnet.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, mulVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { ESPORT_TOURNAMENT_SUBJECT } from './esport';
import { ESPORT_PREMIUM_VC } from './esport-roles';
import { esportEveningView } from './esport-view';
import { ESPORT_STAKE, type EsportPick } from './esport-odds';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { openVenueEvent, venueView } from './venue-event';

export { esportEveningView } from './esport-view';
export type { EsportEveningView, EsportMatchView, EsportSideView } from './esport-view';

const TOURNAMENT = 'TURNIER_ABEND';

interface EsportMatchResult {
  readonly role: 'SPECTATOR' | 'PARTICIPANT';
  readonly won: boolean;
  readonly stake: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly notice: string;
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
 * Spielt das Match des Abends. `pick` gesetzt heißt Zuschauerwette; `null`
 * heißt eigene Teilnahme. Beide Rollen teilen sich dieselbe Auflösung, aber nie
 * dasselbe Geld: der Zuschauer zahlt Einsatz, der Teilnehmer hat die Gebühr
 * bereits bezahlt und bekommt im Sieg die Prämie.
 */
export function playEsportMatch(
  world: WorldState, ledger: Ledger, prng: Prng, pick: EsportPick | null,
): EsportMatchResult {
  const evening = esportEveningView(world, ledger.getBalance(PORTEMONNAIE));
  const current = venueView(world).current;
  if (!current || current.kind !== TOURNAMENT) throw new Error(evening.reason);
  if (!evening.open || evening.match.played) throw new Error(evening.reason);
  const participant = evening.participant;
  if (pick !== null) {
    if (participant !== null) throw new Error('Du bist als Teilnehmer gemeldet: Auf das eigene Match wird nicht gesetzt.');
    if (!evening.ready) throw new Error(evening.reason);
  } else if (participant === null) {
    throw new Error('Du bist fuer diesen Abend nicht gemeldet.');
  }
  const { home, away, chanceBps, quoteHomeBps, quoteAwayBps } = evening.match;
  const roll = prng.nextInt(0, 9_999);
  const homeWins = roll < chanceBps;
  const winnerScore = 13 + (roll % 5);
  const loserScore = Math.max(3, winnerScore - 2 - (roll % 3));
  const homeScore = homeWins ? winnerScore : loserScore;
  const awayScore = homeWins ? loserScore : winnerScore;
  const participantSide = participant?.side ?? null;
  const joinedWon = participantSide === null ? false : (participantSide === 'HOME') === homeWins;
  const stake = pick === null ? ZERO_VC : ESPORT_STAKE;
  if (pick !== null) {
    ledger.transfer(PORTEMONNAIE, EXTERNAL, ESPORT_STAKE, TX_REASON.FOREIGN_STAKE, world.tick, 'esport');
  }
  const won = pick === null ? joinedWon : (pick === 'HOME') === homeWins;
  const payout = !won ? ZERO_VC
    : pick === null ? fromVC(ESPORT_PREMIUM_VC)
      : mulVC(ESPORT_STAKE, pick === 'HOME' ? quoteHomeBps : quoteAwayBps);
  if (payout > ZERO_VC) {
    ledger.transfer(EXTERNAL, PORTEMONNAIE, payout, TX_REASON.FOREIGN_WIN, world.tick, 'esport');
  }
  const winner = homeWins ? home.name : away.name;
  const money = won
    ? `Auszahlung ${toVCString(payout)}`
    : pick === null ? 'keine Praemie' : `Einsatz ${toVCString(ESPORT_STAKE)} verloren`;
  const role = participantSide === null
    ? `Tipp ${pick === 'HOME' ? home.name : away.name}`
    : `Teilnehmer ${participantSide === 'HOME' ? home.name : away.name}`;
  const notice = `${home.name} ${homeScore}:${awayScore} ${away.name} · ${winner} gewinnt · ${role} · ${money}.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: ESPORT_TOURNAMENT_SUBJECT,
    cause: `${home.name} (${home.tactic}, Form ${home.form}, ${home.strength}) gegen ${away.name} (${away.tactic}, Form ${away.form}, ${away.strength}) · Chance ${chanceBps}/10000`,
    effect: notice,
    amount: won ? payout : stake,
    refs: participantSide === null
      ? { eventId: current.id }
      : { eventId: current.id, esportSide: participantSide, esportTeamId: participant!.teamId },
  });
  world.lastEvent = notice;
  return {
    role: participantSide === null ? 'SPECTATOR' : 'PARTICIPANT',
    won, stake, payout, homeScore, awayScore, notice,
  };
}
