/** Hinterhof-Karriere im Charakterfenster: eine Sektion, keine zweite Oberflaeche. */
import type { BackyardRung, BackyardView } from '../core/sim/fight-career';
import { worldStore, useWorldStore } from '../store/use-world-store';
import { vc } from './format';

interface Props {
  readonly backyard: BackyardView;
  /** Ohne Handler bleibt der Knopf wirkungslos; der Router liefert den Stadt-Einstieg. */
  readonly onChallenge?: () => void;
}

export function CareerBackyard({ backyard, onChallenge }: Props) {
  const rung: BackyardRung = backyard.rung;
  // Der Kampfabend liest denselben Snapshot wie die Hinterhof-Leiter; kein zweiter Zustand.
  const event = useWorldStore().career.event;
  const bets = useWorldStore().career.bets;
  const market = bets.market;
  const phase = event.phase === 'ADMISSION' ? 'Einlass' : 'Durchführung';
  return (
    <section className="career-backyard" aria-label="Hinterhof-Karriere">
      <div className="career-head">
        <strong>HINTERHOF</strong>
        <span>Rang {rung.rank} / {backyard.totalRungs}</span>
        <span>{backyard.winChance} % Siegchance</span>
      </div>
      <p className="career-next">
        {rung.name} · {rung.archetype} · Startgeld {vc(rung.entryFee, 2)} · Preisgeld {vc(rung.prize, 2)}
      </p>
      <p className={`career-hp${backyard.ready ? '' : ' warn'}`}>{backyard.reason}</p>
      <button type="button" className="btn small primary" disabled={!backyard.ready} onClick={onChallenge}>
        Herausfordern
      </button>
      {backyard.history.length > 0 && (
        <ul className="career-history" aria-label="Gegnerhistorie">
          {backyard.history.map((entry) => (
            <li key={entry.name}>
              <span>{entry.name}</span>
              <b>{entry.wins} S · {entry.losses} N</b>
              <small>Tag {entry.lastDay}: {entry.lastResult}{entry.kos > 0 ? ` · ${entry.kos} KO` : ''}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="career-head">
        <strong>KAMPFABEND</strong>
        <span>{event.open ? `Turnierabend · ${phase} · ${event.ticksLeft} Ticks` : 'kein Turnierabend'}</span>
        <span>{event.crowd} Zuschauer · {event.crowdBonus > 0 ? '+' : ''}{event.crowdBonus.toFixed(1)} Trefferbonus</span>
      </div>
      <p className="career-next">
        {event.main.name} · Rang {event.main.rank} / {event.roster.length} · Nenngeld {vc(event.main.entryFee, 2)} · Preisgeld {vc(event.main.prize, 2)}
      </p>
      <p className={`career-hp${event.ready ? '' : ' warn'}`}>{event.reason}</p>
      <button type="button" className="btn small primary" disabled={!event.ready} onClick={() => worldStore.city({ kind: 'fightEvent' })}>
        Am Kampfabend starten
      </button>
      <div className="career-head">
        <strong>WETTMARKT</strong>
        <span>{market ? market.pair : 'kein Vorkampf'}</span>
        <span>{bets.pending.length} offene Scheine</span>
      </div>
      <p className={`career-hp${bets.open ? '' : ' warn'}`}>{bets.reason}</p>
      {market && (
        <div className="career-bets">
          {(['A', 'B', 'KO', 'PUNKTE'] as const).map((pick) => (
            <button
              key={pick}
              type="button"
              className="btn small"
              disabled={!bets.open}
              onClick={() => worldStore.city({ kind: 'fightBet', pick, stakeVC: 1 })}
            >
              {pick === 'A' ? market.a : pick === 'B' ? market.b : pick}
              {' · '}{market.odds[pick].toFixed(2)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
