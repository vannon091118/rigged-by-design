/** Stadtliga im bestehenden Charakterfenster: Tabelle, Rollen und Abend aus derselben Ableitung. */
import { useState } from 'react';
import { ESPORT_ENTRY_VC } from '../core/sim/esport-roles';
import { worldStore, useWorldStore } from '../store/use-world-store';
import { vc } from './format';

export function CareerEsport() {
  const esport = useWorldStore().career.esport;
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  if (esport.teams.length === 0) return null;
  const evening = worldStore.esportEvening();
  const phase = evening.phase === 'ADMISSION' ? 'Einlass' : 'Durchführung';
  const homeValue = homeId || evening.match.home.id;
  const awayValue = awayId || evening.match.away.id;
  const participantName = evening.participant
    ? (evening.participant.side === 'HOME' ? evening.match.home.name : evening.match.away.name)
    : null;
  return (
    <>
      <div className="career-grid" aria-label="E-Sport-Liga">
        <div><span>Liga</span><b>{esport.league} · Saison {esport.season}</b></div>
        <div><span>Teams</span><b>{esport.teams.length}</b></div>
        <div><span>Führend</span><b>{esport.homeTeam}</b></div>
        <div><span>Turniere</span><b>{esport.history.length}</b></div>
      </div>
      <div className="career-head">
        <strong>E-SPORT-ABEND</strong>
        <span>{evening.open ? `Turnierabend · ${phase} · ${evening.ticksLeft} Ticks` : 'kein Turnierabend'}</span>
        <span>{evening.match.home.name} gegen {evening.match.away.name}</span>
      </div>
      <p className="career-next">
        {evening.match.home.tactic} ({evening.match.home.strength}, Form {evening.match.home.form}) gegen{' '}
        {evening.match.away.tactic} ({evening.match.away.strength}, Form {evening.match.away.form}) · Einsatz {vc(evening.match.stake, 2)} · Quote{' '}
        {(evening.match.quoteHomeBps / 10_000).toFixed(2)} / {(evening.match.quoteAwayBps / 10_000).toFixed(2)}
      </p>
      <p className={`career-hp${evening.ready || evening.canParticipate ? '' : ' warn'}`}>{evening.reason}</p>
      <div className="career-head">
        <strong>ROLLE</strong>
        <span>{participantName ? `Teilnehmer: ${participantName}` : 'Zuschauer'}</span>
        <span>{evening.pairing ? 'Paarung vom Veranstalter' : 'Paarung aus der Tabelle'}</span>
      </div>
      <button type="button" className="btn small" disabled={evening.open} onClick={() => worldStore.city({ kind: 'esportAnnounce' })}>
        Abend ankündigen
      </button>
      {evening.canJoin && (
        <>
          <button type="button" className="btn small" onClick={() => worldStore.city({ kind: 'esportJoin', side: 'HOME' })}>
            Als Teilnehmer melden: {evening.match.home.name} ({ESPORT_ENTRY_VC} VC)
          </button>
          <button type="button" className="btn small" onClick={() => worldStore.city({ kind: 'esportJoin', side: 'AWAY' })}>
            Als Teilnehmer melden: {evening.match.away.name} ({ESPORT_ENTRY_VC} VC)
          </button>
        </>
      )}
      {evening.participant && (
        <button
          type="button" className="btn small primary" disabled={!evening.canParticipate}
          onClick={() => worldStore.city({ kind: 'esportParticipate' })}
        >
          Match als Teilnehmer spielen
        </button>
      )}
      {evening.canPair && (
        <>
          <div className="career-grid" aria-label="Paarung setzen">
            <div>
              <span>Heim</span>
              <select value={homeValue} onChange={(event) => setHomeId(event.target.value)}>
                {esport.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div>
              <span>Gast</span>
              <select value={awayValue} onChange={(event) => setAwayId(event.target.value)}>
                {esport.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
          </div>
          <button
            type="button" className="btn small" disabled={homeValue === awayValue}
            onClick={() => worldStore.city({ kind: 'esportPairing', homeId: homeValue, awayId: awayValue })}
          >
            Paarung festlegen
          </button>
        </>
      )}
      <button type="button" className="btn small primary" disabled={!evening.ready} onClick={() => worldStore.city({ kind: 'esportMatch', pick: 'HOME' })}>
        Auf {evening.match.home.name} setzen
      </button>
      <button type="button" className="btn small" disabled={!evening.ready} onClick={() => worldStore.city({ kind: 'esportMatch', pick: 'AWAY' })}>
        Auf {evening.match.away.name} setzen
      </button>
      {esport.history.length > 0 && (
        <ul className="career-history" aria-label="Turnierhistorie">
          {esport.history.map((entry, index) => (
            <li key={`${entry.day}-${index}`}>
              <span>Tag {entry.day}</span>
              <small>{entry.summary}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="career-grid" aria-label="E-Sport-Tabelle">
        {esport.teams.map((team, index) => (
          <div key={team.id}>
            <span>{index + 1}. {team.name}</span>
            <b>{team.strength}</b>
            <small>{team.tactic} · Form {team.form} · {team.players.map((player) => player.role).join(' / ')}</small>
          </div>
        ))}
      </div>
    </>
  );
}
