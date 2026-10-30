/** Das Setzfeld: jede Zelle ist ein Feld, jeder Klick legt einen Jeton dorthin. */
import type { ReactElement } from 'react';
import { spotInfo } from '../core/games/roulette-table';

interface Props {
  readonly chips: Readonly<Record<string, number>>;
  readonly blocked: boolean;
  readonly onSpot: (spot: string) => void;
}

const ROWS: readonly (readonly number[])[] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const EVEN_BETS: readonly (readonly [string, string])[] = [
  ['LOW', '1-18'], ['EVEN', 'GERADE'], ['RED', 'ROT'], ['BLACK', 'SCHWARZ'], ['ODD', 'UNGERADE'], ['HIGH', '19-36'],
];

export function RouletteTableau({ chips, blocked, onSpot }: Props) {
  const cell = (spot: string, label: string, extra = ''): ReactElement => {
    const count = chips[spot] ?? 0;
    const quote = spotInfo(spot)?.bps ?? 0;
    return (
      <button
        key={spot}
        type="button"
        className={`rt-cell${extra}${count > 0 ? ' has-chip' : ''}`}
        disabled={blocked}
        onClick={() => onSpot(spot)}
        title={`${label} · zahlt ${(quote / 10_000).toFixed(quote >= 100_000 ? 0 : 2).replace('.', ',')}x${count > 0 ? ` · ${count} Jeton(s)` : ''}`}
        aria-label={`${label}${count > 0 ? `, ${count} Jetons` : ''}`}
      >
        <span>{label}</span>
        {count > 0 && <b className="rt-chip">{count > 1 ? `×${count}` : '●'}</b>}
      </button>
    );
  };

  return (
    <div className="rt-tableau" role="group" aria-label="Roulette-Setzfeld">
      <div className="rt-zero">{cell('N0', '0', ' rt-green rt-zero-cell')}</div>
      <div className="rt-numbers">
        {ROWS.flatMap((row) => row.map((number) =>
          cell(`N${number}`, String(number), RED.has(number) ? ' rt-red' : ' rt-black')))}
      </div>
      <div className="rt-columns">
        {cell('C3', '2:1')}
        {cell('C2', '2:1')}
        {cell('C1', '2:1')}
      </div>
      <div className="rt-dozens">
        {cell('D1', '1. Dutzend')}
        {cell('D2', '2. Dutzend')}
        {cell('D3', '3. Dutzend')}
      </div>
      <div className="rt-even">
        {EVEN_BETS.map(([spot, label]) => cell(spot, label, spot === 'RED' ? ' rt-red' : spot === 'BLACK' ? ' rt-black' : ''))}
      </div>
    </div>
  );
}
