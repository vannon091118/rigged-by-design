/** Self-Exclusion als Gameplay: kein verstecktes Menü, sondern ein sichtbarer Pakt. */
import { useState } from 'react';
import type { GameView } from '../store/types';
import { vc } from './format';

interface Props {
  readonly view: GameView;
  readonly onExclusion: (command: 'START' | 'HONOR', limitVC?: number) => void;
}

export function SelfExclusionPanel({ view, onExclusion }: Props) {
  const [limitVC, setLimitVC] = useState(100);
  const pact = view.exclusionPact;
  const running = pact?.status === 'ACTIVE' || pact?.status === 'LIMIT_REACHED';
  const pauseLeft = pact ? Math.max(0, pact.pauseUntilTick - view.tick) : 0;
  return (
    <section className={`exclusion-panel${view.clarityBadge ? ' clear' : ''}`} aria-label="Selbstbeherrschungs-Pakt">
      <div className="exclusion-head">
        <div>
          <span className="eyebrow">WETTE GEGEN DIE EIGENE SUCHT</span>
          <strong>{view.clarityBadge ? 'Klarheits-Abzeichen verdient' : 'Disziplin ist eine Entscheidung.'}</strong>
        </div>
        <span className="exclusion-score">SUCHT {Math.round(view.playerAddictionScore)}/100</span>
      </div>
      <div className="exclusion-stats">
        <span>WORTBRÜCHE <b>{view.brokenExclusionPacts}</b></span>
        <span>DISZIPLIN-GUTHABEN <b>{vc(view.playerCash, 2)}</b></span>
        <span>PAKT <b>{pact ? pact.status : 'KEINER'}</b></span>
      </div>
      {pact && running ? (
        <div className="exclusion-pact">
          <p>
            Stopp bei <b>-{vc(pact.limit, 0)}</b> Netto-Verlust. Aktuell <b>-{vc(pact.netLoss, 2)}</b>.
            {pact.status === 'LIMIT_REACHED'
              ? ` Grenze erreicht. Noch ${pauseLeft} Ticks Pause, dann einhalten.`
              : ' Ein weiterer Spin nach der Grenze bricht den Pakt.'}
          </p>
          {pact.status === 'LIMIT_REACHED' && (
            <button type="button" className="btn primary" disabled={pauseLeft > 0} onClick={() => onExclusion('HONOR')}>
              {pauseLeft > 0 ? `NOCH ${pauseLeft} TICKS PAUSE` : 'PAKT EINHALTEN · BONUS +25 %'}
            </button>
          )}
        </div>
      ) : (
        <div className="exclusion-pact">
          <p>Setze ein ehrliches Limit. Wer es hält, bekommt 25 % als Disziplin-Bonus und ein permanentes Klarheits-Abzeichen. Wer weiterspielt, wird als Wortbruch registriert — ohne Sperre.</p>
          <div className="exclusion-form">
            <label>LIMIT IN VC <input type="number" min="1" step="1" value={limitVC} onChange={(event) => setLimitVC(Number(event.target.value))} /></label>
            <button type="button" className="btn" onClick={() => onExclusion('START', limitVC)}>PAKT SCHLIESSEN</button>
          </div>
        </div>
      )}
    </section>
  );
}
