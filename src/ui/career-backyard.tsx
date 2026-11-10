/** Hinterhof-Karriere im Charakterfenster: eine Sektion, keine zweite Oberflaeche. */
import type { BackyardRung, BackyardView } from '../core/sim/fight-career';
import { vc } from './format';

interface Props {
  readonly backyard: BackyardView;
  /** Ohne Handler bleibt der Knopf wirkungslos; der Router liefert den Stadt-Einstieg. */
  readonly onChallenge?: () => void;
}

export function CareerBackyard({ backyard, onChallenge }: Props) {
  const rung: BackyardRung = backyard.rung;
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
    </section>
  );
}
