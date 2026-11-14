/** Geldblock des HUD: Betrag, Kasse/Offen und Tagesziel in einer Achse. */
import { HAUSKONTO } from '../core/sim/money';
import { ACCOUNT_LABEL, HELP } from './glossary';
import { UI_ICON } from './icons';

interface HudMoneyProps {
  readonly guest: boolean;
  readonly amount: string;
  readonly desk: string;
  readonly pending: string;
  /** Formatiert nur bei offener Schuld; `null` blendet die Zeile aus. */
  readonly debt?: string | null;
  readonly pact: string;
  readonly goal: { readonly label: string; readonly percent: number; readonly text: string };
}

/** Lange Betraege bekommen eine kleinere Stufe, statt die HUD-Zeile zu sprengen. */
const toneFor = (amount: string): string | undefined => (amount.length > 17 ? 'xlong' : amount.length > 13 ? 'long' : undefined);

export function HudMoney({ guest, amount, desk, pending, debt = null, pact, goal }: HudMoneyProps) {
  return (
    <div className={`hud-money ${guest ? 'guest' : 'operator'}`} title={guest ? HELP.portemonnaie : HELP.hauskonto}>
      <span><img className="ui-icon" src={UI_ICON.coin} alt="" />{guest ? 'PORTEMONNAIE' : ACCOUNT_LABEL[HAUSKONTO]}</span>
      <strong className={toneFor(amount)}>{amount}</strong>
      <small>
        {guest ? (
          <>
            <span className="term" title={HELP.offen}>Offen {pending}</span>
            <span className="hud-money-sep" aria-hidden="true">·</span>
            <span className="hud-money-pact">{pact}</span>
          </>
        ) : (
          <>
            <span className="term" title={HELP.kasse}>Kasse {desk}</span>
            <span className="hud-money-sep" aria-hidden="true">·</span>
            <span className="term" title={HELP.offen}>Offen {pending}</span>
            {debt && (
              <>
                <span className="hud-money-sep" aria-hidden="true">·</span>
                <span className="term hud-money-debt" title={HELP.schuld}>Schuld {debt}</span>
              </>
            )}
          </>
        )}
      </small>
      {!guest && (
        <div className="hud-goal-row" title={`${goal.text} · ${goal.percent} %`}>
          <span className="hud-goal-label">{goal.label}</span>
          <span className="hud-goal" aria-hidden="true">
            <i style={{ width: `${goal.percent}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}
