/** Tischregeln des Blackjack-Fensters: reine Auswahl, keine Rundenlogik. */
import type { BlackjackRules } from '../../core/games/engines/blackjack';

const DECKS: readonly number[] = [1, 2, 4, 6];

interface Props {
  readonly rules: BlackjackRules;
  readonly disabled: boolean;
  readonly onChange: (patch: Partial<BlackjackRules>) => void;
}

export function BlackjackRulesPanel({ rules, disabled, onChange }: Props) {
  return (
    <div className="blackjack-rules" aria-label="Tischregeln">
      <span className="eyebrow">TISCHREGELN</span>
      <div className="bet-row">
        {DECKS.map((decks) => (
          <button key={decks} type="button" className={`chip${rules.decks === decks ? ' active' : ''}`}
            disabled={disabled} onClick={() => onChange({ decks })}>{decks} Deck{decks > 1 ? 's' : ''}</button>
        ))}
      </div>
      <div className="bet-row">
        <button type="button" className={`chip${!rules.dealerHitsSoft17 ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ dealerHitsSoft17: false })} title="Dealer hält weiche 17.">S17</button>
        <button type="button" className={`chip${rules.dealerHitsSoft17 ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ dealerHitsSoft17: true })} title="Dealer zieht auf weiche 17.">H17</button>
        <button type="button" className={`chip${rules.blackjackBps === 25_000 ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ blackjackBps: 25_000 })}>Blackjack 3:2</button>
        <button type="button" className={`chip${rules.blackjackBps === 22_000 ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ blackjackBps: 22_000 })}>6:5</button>
      </div>
      <div className="bet-row">
        <button type="button" className={`chip${rules.allowSplit ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ allowSplit: !rules.allowSplit })}>Split</button>
        <button type="button" className={`chip${rules.allowInsurance ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ allowInsurance: !rules.allowInsurance })}>Versicherung</button>
        <button type="button" className={`chip${rules.allowSurrender ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ allowSurrender: !rules.allowSurrender })}>Aufgeben</button>
        <button type="button" className={`chip${rules.sideBetBps > 0 ? ' active' : ''}`} disabled={disabled}
          onClick={() => onChange({ sideBetBps: rules.sideBetBps > 0 ? 0 : 120_000 })}
          title="Paar-Wette: 1 Einheit extra, zahlt 11:1 auf ein Paar.">Paar-Wette</button>
      </div>
    </div>
  );
}
