/**
 * @test-target: src/core/sim/esport-roles.ts
 * @error-code: ERR-2001
 *
 * Drei Rollen auf einer Event-Instanz: Zuschauer wetten, Teilnehmer melden sich
 * im Einlass und spielen ihr eigenes Match, der Veranstalter setzt die Paarung.
 * Jede Rolle bucht ausschliesslich ihre eigene Ledger-Zeile, und die Wahl
 * ueberlebt Save und Load ohne neues Save-Feld.
 */
import { describe, expect, it } from 'vitest';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { esportTeams } from '../esport';
import { announceEsportEvening, esportEveningView, playEsportMatch } from '../esport-event';
import {
  ESPORT_ENTRY_VC, ESPORT_PREMIUM_VC, esportPairingAt, esportParticipantAt,
  joinEsportSide, setEsportPairing,
} from '../esport-roles';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { createWorld, ensureStarter } from '../templates';
import { venueView } from '../venue-event';

const start = (seed = randomSeed()) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger({});
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(50), 'Test: Startgeld', 0);
  return { world, ledger, prng: new Prng(seed) };
};

/** Ankuendigen und in den Einlass springen: das Fenster liegt bei 30..59 von 150 Ticks. */
const openEvening = (seed = randomSeed()) => {
  const started = start(seed);
  announceEsportEvening(started.world);
  started.world.tick = 45;
  return started;
};

describe('Rollen am E-Sport-Abend', () => {
  it('meldet den Spieler im Einlass und bucht die Gebuehr als Ledger-Zeile', () => {
    const { world, ledger } = openEvening();
    const eventId = venueView(world).current!.id;
    const before = ledger.getBalance(PORTEMONNAIE);
    const notice = joinEsportSide(world, ledger, 'HOME');
    expect(notice).toContain('Gemeldet als Teilnehmer');
    expect(ledger.getBalance(PORTEMONNAIE)).toBe((before - fromVC(ESPORT_ENTRY_VC)) as typeof before);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.entries.filter((entry) => entry.game === 'esport')).toHaveLength(1);
    expect(esportParticipantAt(world, eventId)?.side).toBe('HOME');
    expect(world.archive.some((entry) => entry.subject === 'ESPORT_TEILNAHME'
      && entry.refs?.eventId === eventId)).toBe(true);
    expect(() => joinEsportSide(world, ledger, 'AWAY')).toThrow(/schon gemeldet/);
  });

  it('verweigert die Meldung ausserhalb des Einlasses und nach dem Match', () => {
    const early = start();
    announceEsportEvening(early.world);
    early.world.tick = 5;
    expect(() => joinEsportSide(early.world, early.ledger, 'HOME')).toThrow(/Einlass/);

    const played = openEvening();
    playEsportMatch(played.world, played.ledger, played.prng, 'HOME');
    expect(() => joinEsportSide(played.world, played.ledger, 'HOME')).toThrow(/gespielt/);
  });

  it('trennt die Rollen: Teilnehmer setzen nicht, Zuschauer spielen nicht als Teilnehmer', () => {
    const { world, ledger, prng } = openEvening();
    joinEsportSide(world, ledger, 'HOME');
    expect(() => playEsportMatch(world, ledger, prng, 'HOME')).toThrow(/Teilnehmer/);

    const spectator = openEvening();
    expect(() => playEsportMatch(spectator.world, spectator.ledger, spectator.prng, null)).toThrow(/nicht gemeldet/);
    expect(playEsportMatch(spectator.world, spectator.ledger, spectator.prng, 'HOME').role).toBe('SPECTATOR');
  });

  it('spielt das eigene Match und zahlt die Praemie nur im Sieg', () => {
    const { world, ledger, prng } = openEvening();
    joinEsportSide(world, ledger, 'HOME');
    const before = ledger.getBalance(PORTEMONNAIE);
    const result = playEsportMatch(world, ledger, prng, null);
    const after = ledger.getBalance(PORTEMONNAIE);
    expect(result.role).toBe('PARTICIPANT');
    expect(result.notice).toContain('Teilnehmer');
    expect(after).toBe((before + (result.won ? fromVC(ESPORT_PREMIUM_VC) : 0)) as typeof after);
    expect(ledger.entries.filter((entry) => entry.game === 'esport')).toHaveLength(result.won ? 2 : 1);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(esportEveningView(world, ledger.getBalance(PORTEMONNAIE)).match.played).toBe(true);
  });

  it('setzt die Paarung als Veranstalter und spielt genau diese Paarung', () => {
    const { world, ledger, prng } = openEvening();
    const [first, second] = [...esportTeams(world.day)].reverse();
    expect(() => setEsportPairing(world, first!.id, first!.id)).toThrow(/gegen sich selbst/);
    const notice = setEsportPairing(world, first!.id, second!.id);
    expect(notice).toContain(first!.name);
    expect(esportEveningView(world, ledger.getBalance(PORTEMONNAIE)).match.home.id).toBe(first!.id);
    const result = playEsportMatch(world, ledger, prng, 'HOME');
    expect(result.notice.startsWith(`${first!.name} `)).toBe(true);
  });

  it('verweigert unbekannte Teams, Paarung nach der Meldung und ausserhalb des Einlasses', () => {
    const { world, ledger } = openEvening();
    expect(() => setEsportPairing(world, 'team-99', 'team-1')).toThrow(/Unbekanntes Team/);
    joinEsportSide(world, ledger, 'HOME');
    expect(() => setEsportPairing(world, 'team-0', 'team-1')).toThrow(/Meldung/);

    const early = start();
    announceEsportEvening(early.world);
    early.world.tick = 5;
    expect(() => setEsportPairing(early.world, 'team-0', 'team-1')).toThrow(/Einlass/);
  });

  it('erhaelt Meldung, Paarung und Event-ID ueber Save und Load', () => {
    const { world, ledger } = openEvening();
    const eventId = venueView(world).current!.id;
    const teams = [...esportTeams(world.day)].reverse();
    setEsportPairing(world, teams[0]!.id, teams[1]!.id);
    joinEsportSide(world, ledger, 'AWAY');

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, 42))))!.world;
    expect(venueView(loaded).current?.id).toBe(eventId);
    expect(esportParticipantAt(loaded, eventId)?.side).toBe('AWAY');
    expect(esportPairingAt(loaded, eventId)?.homeId).toBe(teams[0]!.id);
    expect(esportEveningView(loaded, fromVC(50)).match.home.id).toBe(teams[0]!.id);
  });

  it('liefert bei gleichem Seed dasselbe Teilnehmerergebnis', () => {
    const seed = randomSeed();
    const run = () => {
      const { world, ledger, prng } = openEvening(seed);
      joinEsportSide(world, ledger, 'HOME');
      const result = playEsportMatch(world, ledger, prng, null);
      return { notice: result.notice, payout: result.payout, won: result.won };
    };
    expect(run()).toEqual(run());
  });
});
