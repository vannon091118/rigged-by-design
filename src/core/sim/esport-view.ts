/**
 * Die eine Sicht auf den E-Sport-Abend: Phase, Paarung, Quote und welche Rolle
 * der Spieler gerade halten kann. Reine Ableitung aus der gespeicherten
 * `TURNIER_ABEND`-Instanz, der Rollenwahl im Journal und dem vorhandenen Seed;
 * die Abrechnung liegt in `esport-event.ts`, die Rollenwahl in `esport-roles.ts`.
 */
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import {
  ESPORT_ENTRY_VC, esportEveningTeams, esportParticipantAt, esportParticipantBonus, esportPlayedAt,
  type EsportPairing, type EsportParticipant,
} from './esport-roles';
import { ESPORT_STAKE, esportChanceBps, esportQuoteBps, type EsportTactic } from './esport-odds';
import type { WorldState } from './types';
import { venueView } from './venue-event';

const TOURNAMENT = 'TURNIER_ABEND';

export interface EsportSideView {
  readonly id: string;
  readonly name: string;
  readonly tactic: EsportTactic;
  readonly form: number;
  readonly strength: number;
}

export interface EsportMatchView {
  readonly home: EsportSideView;
  readonly away: EsportSideView;
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
  /** Eigene Meldung als Teilnehmer; `null` heißt Zuschauerrolle. */
  readonly participant: EsportParticipant | null;
  /** Gesetzte Paarung des Veranstalters; `null` heißt Tabelle entscheidet. */
  readonly pairing: EsportPairing | null;
  readonly canJoin: boolean;
  readonly canPair: boolean;
  readonly canParticipate: boolean;
}

/** Phase, Paarung, Quote, Rolle und ob das Match schon lief — eine Ableitung. */
export function esportEveningView(world: WorldState, wallet: VaCoinMicro): EsportEveningView {
  const current = venueView(world).current;
  const live = current !== null && current.kind === TOURNAMENT
    && (current.phase === 'ADMISSION' || current.phase === 'RUNNING');
  const eventId = live ? current.id : null;
  const { home, away, pairing } = esportEveningTeams(world);
  const participant = eventId === null ? null : esportParticipantAt(world, eventId);
  const bonus = participant ? esportParticipantBonus(world) : 0;
  const homeStrength = home.strength + (participant?.teamId === home.id ? bonus : 0);
  const awayStrength = away.strength + (participant?.teamId === away.id ? bonus : 0);
  const chanceBps = esportChanceBps(homeStrength, home.tactic, awayStrength, away.tactic);
  const played = eventId === null ? null : esportPlayedAt(world, eventId);
  const match: EsportMatchView = {
    home: { id: home.id, name: home.name, tactic: home.tactic, form: home.form, strength: homeStrength },
    away: { id: away.id, name: away.name, tactic: away.tactic, form: away.form, strength: awayStrength },
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
      : participant !== null
        ? `Gemeldet als Teilnehmer: ${participant.side === 'HOME' ? home.name : away.name} · Gebuehr ${ESPORT_ENTRY_VC} VC bezahlt.`
        : wallet < ESPORT_STAKE
          ? `Einsatz fehlt: ${toVCString((ESPORT_STAKE - wallet) as VaCoinMicro)}.`
          : `${home.name} (${home.tactic}) gegen ${away.name} (${away.tactic}) · Einsatz ${toVCString(ESPORT_STAKE)} · Quote ${(match.quoteHomeBps / 10_000).toFixed(2)} / ${(match.quoteAwayBps / 10_000).toFixed(2)}.`;
  return {
    open: live,
    phase: live ? (current.phase as 'ADMISSION' | 'RUNNING') : 'CLOSED',
    ticksLeft: live ? current.ticksLeft : 0,
    ready: live && played === null && participant === null && wallet >= ESPORT_STAKE,
    reason,
    match,
    participant,
    pairing,
    canJoin: live && current.phase === 'ADMISSION' && played === null && participant === null,
    canPair: live && current.phase === 'ADMISSION' && played === null && participant === null,
    canParticipate: live && played === null && participant !== null,
  };
}
