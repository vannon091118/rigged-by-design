/** Blackjack-Tisch-Aktionen: Karten ziehen, halten, verdoppeln, splitten, aufgeben, Versicherung. */
import type { BlackjackRound } from '../../core/games/engines/blackjack';

interface BlackjackTableActionsProps {
  readonly round: BlackjackRound | null;
  readonly activeHand: { readonly cards: readonly { readonly rank: string }[]; readonly done?: boolean } | null;
  readonly canDouble: boolean;
  readonly canSplit: boolean;
  readonly canSurrender: boolean;
  readonly playing: boolean;
  readonly onAct: (kind: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER') => void;
  readonly onInsure: (take: boolean) => void;
}

export function BlackjackTableActions(props: BlackjackTableActionsProps) {
  const { round, activeHand, canDouble, canSplit, canSurrender, playing, onAct, onInsure } = props;

  if (round?.insuranceOffered) {
    return (
      <div className="table-actions">
        <button type="button" className="btn primary" onClick={() => onInsure(true)}>
          VERSICHERUNG NEHMEN
        </button>
        <button type="button" className="btn" onClick={() => onInsure(false)}>
          OHNE WEITER
        </button>
      </div>
    );
  }

  return (
    <div className="table-actions">
      <button type="button" className="btn primary" disabled={!playing} onClick={() => onAct('HIT')}>
        KARTE ZIEHEN
      </button>
      <button type="button" className="btn" disabled={!playing} onClick={() => onAct('STAND')}>
        HALTEN
      </button>
      <button
        type="button"
        className="btn"
        disabled={!playing || activeHand?.cards.length !== 2 || !canDouble}
        onClick={() => onAct('DOUBLE')}
        title="Doppelter Einsatz, genau eine Karte, danach zieht der Dealer."
      >
        VERDOPPELN
      </button>
      <button
        type="button"
        className="btn"
        disabled={!canSplit}
        onClick={() => onAct('SPLIT')}
        title="Zwei gleiche Ränge werden zu zwei Händen mit eigenem Einsatz."
      >
        SPLIT
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={!canSurrender}
        onClick={() => onAct('SURRENDER')}
        title="Halber Einsatz zurück, bevor die erste Karte fällt."
      >
        AUFGEBEN
      </button>
    </div>
  );
}
