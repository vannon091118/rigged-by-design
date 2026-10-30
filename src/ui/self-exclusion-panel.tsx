/** Self-Exclusion als Gameplay: kein verstecktes Menü, sondern ein sichtbarer Pakt. */
import { useState } from 'react';
import type { GameView } from '../store/types';
import { vc } from './format';

interface Props {
  readonly view: GameView;
  readonly onExclusion: (command: 'START' | 'HONOR', limitVC?: number) => void;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'läuft',
  LIMIT_REACHED: 'Limit erreicht',
  HELD: 'eingehalten',
  BROKEN: 'gebrochen',
};

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
        <span className="exclusion-score" title="Steigt mit jedem fremden Spiel, sinkt beim Einhalten eines Pakts.">SUCHT {Math.round(view.playerAddictionScore)}/100</span>
      </div>
      <div className="exclusion-stats">
        <span title="So oft hast du ein selbst gesetztes Limit überschritten.">PAKTE GEBROCHEN <b>{view.brokenExclusionPacts}</b></span>
        <span title="Bonus, der beim Einhalten fällig wird – kein Casino-Gewinn.">BONUS-GUTHABEN <b>{vc(view.playerCash, 2)}</b></span>
        <span>PAKT <b>{pact ? STATUS_LABEL[pact.status] ?? pact.status : 'keiner'}</b></span>
      </div>
      {pact && running ? (
        <div className="exclusion-pact">
          <p>
            Stopp bei <b>-{vc(pact.limit, 0)}</b> Netto-Verlust. Aktuell <b>-{vc(pact.netLoss, 2)}</b>.
            {pact.status === 'LIMIT_REACHED'
              ? ` Grenze erreicht. Noch ${pauseLeft} Takte (≈ ${Math.ceil(pauseLeft * 0.52)} s) Pause, dann einhalten.`
              : ' Ein weiterer Spin nach der Grenze bricht den Pakt.'}
          </p>
          {pact.status === 'LIMIT_REACHED' && (
            <button type="button" className="btn primary" disabled={pauseLeft > 0} onClick={() => onExclusion('HONOR')}
              title="Hältst du die Grenze ein, bekommst du 25 % Bonus und ein dauerhaftes Klarheits-Abzeichen.">
              {pauseLeft > 0 ? `NOCH ${pauseLeft} TAKTE PAUSE` : 'PAKT EINHALTEN · BONUS +25 %'}
            </button>
          )}
        </div>
      ) : (
        <div className="exclusion-pact">
          <p>
            Lege vorher fest, wie viel Netto-Verlust du dir erlaubst. Hältst du die Grenze ein, gibt es 25 % Bonus
            und ein dauerhaftes Klarheits-Abzeichen. Ein weiterer Spin danach wird als Wortbruch protokolliert – ohne Sperre.
          </p>
          <div className="exclusion-form">
            <label>LIMIT IN VC <input type="number" min="1" step="1" value={limitVC} onChange={(event) => setLimitVC(Number(event.target.value))} /></label>
            <button type="button" className="btn" onClick={() => onExclusion('START', limitVC)}>PAKT SCHLIESSEN</button>
          </div>
        </div>
      )}
    </section>
  );
}
