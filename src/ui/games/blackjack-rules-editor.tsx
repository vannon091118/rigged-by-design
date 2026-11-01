/** Blackjack-Tischregeln: Decks, Soft-17, Auszahlung, Split, Versicherung, Aufgeben, Paar-Wette. */
import type { BlackjackRules } from '../../core/games/engines/blackjack';

const DECKS: readonly number[] = [1, 2, 4, 6];

interface BlackjackRulesEditorProps {
  readonly rules: BlackjackRules;
  readonly onChange: (patch: Partial<BlackjackRules>) => void;
  readonly disabled: boolean;
}

export function BlackjackRulesEditor(props: BlackjackRulesEditorProps) {
  const { rules, onChange, disabled } = props;
  const setRule = (patch: Partial<BlackjackRules>): void => onChange(patch);

  return (
    <div className="blackjack-rules" aria-label="Tischregeln">
      <span className="eyebrow">TISCHREGELN</span>
      <div className="bet-row">
        {DECKS.map((decks) => (
          <button
            key={decks}
            type="button"
            className={`chip${rules.decks === decks ? ' active' : ''}`}
            disabled={disabled}
            onClick={() => setRule({ decks })}
          >
            {decks} Deck{decks > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <div className="bet-row">
        <button
          type="button"
          className={`chip${!rules.dealerHitsSoft17 ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ dealerHitsSoft17: false })}
          title="Dealer hält weiche 17."
        >
          S17
        </button>
        <button
          type="button"
          className={`chip${rules.dealerHitsSoft17 ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ dealerHitsSoft17: true })}
          title="Dealer zieht auf weiche 17."
        >
          H17
        </button>
        <button
          type="button"
          className={`chip${rules.blackjackBps === 25_000 ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ blackjackBps: 25_000 })}
        >
          Blackjack 3:2
        </button>
        <button
          type="button"
          className={`chip${rules.blackjackBps === 22_000 ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ blackjackBps: 22_000 })}
        >
          6:5
        </button>
      </div>
      <div className="bet-row">
        <button
          type="button"
          className={`chip${rules.allowSplit ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ allowSplit: !rules.allowSplit })}
        >
          Split
        </button>
        <button
          type="button"
          className={`chip${rules.allowInsurance ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ allowInsurance: !rules.allowInsurance })}
        >
          Versicherung
        </button>
        <button
          type="button"
          className={`chip${rules.allowSurrender ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ allowSurrender: !rules.allowSurrender })}
        >
          Aufgeben
        </button>
        <button
          type="button"
          className={`chip${rules.sideBetBps > 0 ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setRule({ sideBetBps: rules.sideBetBps > 0 ? 0 : 120_000 })}
          title="Paar-Wette: 1 Einheit extra, zahlt 11:1 auf ein Paar."
        >
          Paar-Wette
        </button>
      </div>
    </div>
  );
}
