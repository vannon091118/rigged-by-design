/**
 * Rollen am E-Sport-Abend: Zuschauer, Teilnehmer und Veranstalter.
 *
 * Alle drei Rollen liegen auf derselben gespeicherten `TURNIER_ABEND`-Instanz.
 * Die Wahl steht als typisierte Referenz am Journal-Eintrag (`refs.eventId`
 * plus Rolle/Team), ist damit Teil des Saves und braucht kein zweites Feld.
 * Geld laeuft ausschliesslich ueber den Ledger: Teilnahmegebuehr und Praemie
 * sind gebuchte Zeilen gegen `EXTERNAL`, wie jeder Fremdmarkt.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, toVCString } from '../economy/vacoin';
import { ESPORT_TOURNAMENT_SUBJECT, esportTeams } from './esport';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { normalizePlayerNeeds, playerCondition } from './player-needs';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { venueView } from './venue-event';

export type EsportSide = 'HOME' | 'AWAY';

export interface EsportPairing {
  readonly homeId: string;
  readonly awayId: string;
}

export interface EsportParticipant {
  readonly side: EsportSide;
  readonly teamId: string;
}

/** Teilnahmegebuehr je Abend; die Wette bleibt der separate Zuschauerpreis. */
export const ESPORT_ENTRY_VC = 2;
/** Praemie fuer eine gewonnene Teilnahme, ebenfalls als Ledger-Zeile. */
export const ESPORT_PREMIUM_VC = 8;

const JOIN_SUBJECT = 'ESPORT_TEILNAHME';
const PAIRING_SUBJECT = 'ESPORT_PAARUNG';
const TOURNAMENT = 'TURNIER_ABEND';

type Team = ReturnType<typeof esportTeams>[number];

function currentTournament(world: WorldState) {
  const current = venueView(world).current;
  return current !== null && current.kind === TOURNAMENT ? current : null;
}

/** Ein Ergebnis gehoert zu genau der Event-Instanz, an der es gespielt wurde. */
export function esportPlayedAt(world: WorldState, eventId: number): string | null {
  return world.archive.find((entry) => entry.subject === ESPORT_TOURNAMENT_SUBJECT
    && entry.refs?.eventId === eventId)?.effect ?? null;
}

function lastEventOf(world: WorldState, subject: string, eventId: number) {
  return [...world.archive].reverse().find((entry) => entry.subject === subject
    && entry.refs?.eventId === eventId);
}

/** Die gemeldete Seite des Spielers, falls er fuer diesen Abend gemeldet ist. */
export function esportParticipantAt(world: WorldState, eventId: number): EsportParticipant | null {
  const entry = lastEventOf(world, JOIN_SUBJECT, eventId);
  const side = entry?.refs?.esportSide;
  const teamId = entry?.refs?.esportTeamId;
  return side && teamId ? { side, teamId } : null;
}

/** Die vom Veranstalter gesetzte Paarung, falls es eine gibt. */
export function esportPairingAt(world: WorldState, eventId: number): EsportPairing | null {
  const refs = lastEventOf(world, PAIRING_SUBJECT, eventId)?.refs;
  return refs?.esportHomeId && refs.esportAwayId
    ? { homeId: refs.esportHomeId, awayId: refs.esportAwayId }
    : null;
}

/**
 * Der Beitrag des Teilnehmers ist seine echte Verfassung, kein Menue-XP:
 * wer satt und wach ist, bringt drei Punkte, wer hungert, einen.
 */
export function esportParticipantBonus(world: WorldState): number {
  const factor = playerCondition(normalizePlayerNeeds(world.player.needs)).workXpFactor;
  return factor >= 1 ? 3 : factor >= 0.8 ? 2 : 1;
}

/**
 * Die Paarung des Abends: gesetzt vom Veranstalter, sonst die beiden
 * staerksten Teams. Genau eine Ableitung fuer Sicht und Abrechnung.
 */
export function esportEveningTeams(world: WorldState): { home: Team; away: Team; pairing: EsportPairing | null } {
  const event = currentTournament(world);
  const pairing = event ? esportPairingAt(world, event.id) : null;
  if (pairing) {
    const byId = new Map(esportTeams(world.day).map((team) => [team.id, team]));
    const home = byId.get(pairing.homeId);
    const away = byId.get(pairing.awayId);
    if (home && away) return { home, away, pairing };
  }
  const [home, away] = [...esportTeams(world.day)]
    .sort((left, right) => right.strength - left.strength || left.name.localeCompare(right.name));
  return { home: home!, away: away!, pairing: null };
}

/** Meldung als Teilnehmer: nur im Einlass, einmal je Abend, Gebuehr sofort gebucht. */
export function joinEsportSide(world: WorldState, ledger: Ledger, side: EsportSide): string {
  const event = currentTournament(world);
  if (!event) throw new Error('Kein Turnierabend im Einlass: Eine Meldung ist erst mit dem Abend moeglich.');
  if (event.phase !== 'ADMISSION') throw new Error(`Die Meldung ist nur im Einlass offen (${event.phaseLabel}).`);
  if (esportPlayedAt(world, event.id) !== null) throw new Error('Das Match dieses Abends ist bereits gespielt.');
  if (esportParticipantAt(world, event.id) !== null) throw new Error('Du bist fuer diesen Abend schon gemeldet.');
  const { home, away } = esportEveningTeams(world);
  const team = side === 'HOME' ? home : away;
  const fee = fromVC(ESPORT_ENTRY_VC);
  if (ledger.getBalance(PORTEMONNAIE) < fee) throw new Error(`Teilnahmegebuehr fehlt: ${ESPORT_ENTRY_VC} VC.`);
  ledger.transfer(PORTEMONNAIE, EXTERNAL, fee, TX_REASON.FOREIGN_STAKE, world.tick, 'esport');
  const notice = `Gemeldet als Teilnehmer: ${team.name} (${side === 'HOME' ? 'Heim' : 'Gast'}) · Gebuehr ${toVCString(fee)}.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: JOIN_SUBJECT,
    cause: `E-Sport-Abend #${event.id}: ${team.name}`,
    effect: notice,
    amount: fee,
    refs: { eventId: event.id, esportSide: side, esportTeamId: team.id },
  });
  return notice;
}

/** Veranstalterhandlung: Paarung setzen, solange noch niemand gemeldet ist. */
export function setEsportPairing(world: WorldState, homeId: string, awayId: string): string {
  const event = currentTournament(world);
  if (!event) throw new Error('Kein Turnierabend: Eine Paarung laesst sich nur am Abend setzen.');
  if (event.phase !== 'ADMISSION') throw new Error(`Die Paarung steht nur im Einlass zur Wahl (${event.phaseLabel}).`);
  if (esportPlayedAt(world, event.id) !== null) throw new Error('Das Match dieses Abends ist bereits gespielt.');
  if (esportParticipantAt(world, event.id) !== null) throw new Error('Nach einer Meldung bleibt die Paarung stehen.');
  if (homeId === awayId) throw new Error('Ein Team kann nicht gegen sich selbst antreten.');
  const teams = new Map(esportTeams(world.day).map((team) => [team.id, team]));
  const home = teams.get(homeId);
  const away = teams.get(awayId);
  if (!home || !away) throw new Error('Unbekanntes Team: Die Paarung kommt aus der Stadtliga.');
  const notice = `Paarung gesetzt: ${home.name} gegen ${away.name}.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: PAIRING_SUBJECT,
    cause: `E-Sport-Abend #${event.id}: Veranstalter`,
    effect: notice,
    refs: { eventId: event.id, esportHomeId: home.id, esportAwayId: away.id },
  });
  return notice;
}
