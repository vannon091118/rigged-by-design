/** Wettkonsole unter den Walzen: Jetons, Autospin und der eine grosse Knopf. */
interface Props {
  readonly bets: readonly number[];
  readonly bet: number;
  readonly onBet: (value: number) => void;
  readonly spinning: boolean;
  readonly blocked: boolean;
  readonly auto: boolean;
  readonly onToggleAuto: () => void;
  readonly onSpin: () => void;
  readonly actionLabel: string;
  readonly hint: string;
}

export function BetConsole({ bets, bet, onBet, spinning, blocked, auto, onToggleAuto, onSpin, actionLabel, hint }: Props) {
  return (
    <div className="slot-console">
      {bets.length > 0 && (
        <div className="bet-row">
          {bets.map((value) => (
            <button key={value} type="button" className={`chip${bet === value ? ' active' : ''}`}
              disabled={spinning} onClick={() => onBet(value)} title={`Einsatz ${value} VC pro Spin`}>
              {value} VC
            </button>
          ))}
        </div>
      )}
      <div className="slot-console-actions">
        <button type="button" className={`btn small${auto ? ' primary' : ' ghost'}`} disabled={blocked}
          onClick={onToggleAuto} title="Spielt nach jedem Halt automatisch weiter, bis du es abschaltest.">
          AUTO {auto ? 'AN' : 'AUS'}
        </button>
        <button type="button" className="btn primary big" disabled={spinning || blocked} onClick={onSpin}>
          {blocked ? 'ZU WENIG BARGELD' : spinning ? 'DREHT…' : actionLabel}
        </button>
      </div>
      <small>{hint}</small>
    </div>
  );
}
