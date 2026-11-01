/** Rundenpoker: vier Spieler, ein Pot, die Entscheidung an jedem Zug bleibt beim Spieler. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import { canAfford, fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import { strengthOf, type PokerAction } from '../../core/games/poker-strategy';
import { humanAct, startHand, toCall } from '../../core/games/poker-table';
import type { PokerTable } from '../../core/games/poker-types';
import { Prng } from '../../core/rng/prng';
import type { CardDeal } from '../../store/foreign-play';
import { playSfx } from '../../render/sound-fx';
import { PokerStage, type PokerStageHandle } from '../../render/games/poker-stage';
import { CasinoWindowHeader } from '../casino-window-header';
import { vc } from '../format';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly wallets: { readonly wallet: VaCoinMicro; readonly house: VaCoinMicro };
  readonly mods: readonly string[];
  readonly pact: string;
  readonly bets: readonly number[];
  readonly canPay: boolean;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw?: () => void;
  readonly canWithdraw?: boolean;
  readonly onDeal: (stakeVC: number, bps: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, netBps: number, label: string) => GameResult | null;
}

const STREET_LABEL: Readonly<Record<PokerTable['street'], string>> = {
  PREFLOP: 'Vor dem Flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Showdown',
};

export function PokerPopup(props: Props) {
  const { bets } = props;
  const rng = useRef<Prng | null>(null);
  const stage = useRef<PokerStageHandle>(null);
  const [bet, setBet] = useState(bets[0] ?? 1);
  const [table, setTable] = useState<PokerTable | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [netBps, setNetBps] = useState<number>(10_000);
  const stake = fromVC(bet);
  const canPay = canAfford(props.wallets.wallet, stake);
  const human = table?.players[0] ?? null;
  const running = Boolean(table) && !table?.result;
  const myTurn = Boolean(table && !table.result && table.toAct === 0 && human);
  const call = table && human ? toCall(table, human) : 0;
  const canRaise = Boolean(myTurn && table && human && table.raises < 3 && human.stack > call);

  const commit = (next: PokerTable): void => {
    setTable(next);
    stage.current?.render(next);
    playSfx('cardFlip');
    if (next.result) {
      const edge = Math.max(0, 10_000 - netBps);
      const adjusted = Math.max(0, next.result.multiplierBps - edge);
      setResult(props.onSettle(bet, adjusted, next.result.label));
    }
  };

  const deal = (): void => {
    if (running || !canPay) return;
    const dealResult = props.onDeal(bet, 10_000); // Poker: 100% basis, edge handled by settle
    if (!dealResult) return;
    rng.current = new Prng(dealResult.seed);
    setNetBps(dealResult.netBps);
    setResult(null);
    commit(startHand(rng.current, { stake, opponents: 3 }));
  };

  const act = (action: PokerAction): void => {
    if (!table || !myTurn || !rng.current) return;
    commit(humanAct(table, action, rng.current));
  };

  const narration = (): string => {
    if (!table) return 'Einsatz wählen und austeilen. Vier Spieler, ein Pot, du entscheidest an jedem Zug.';
    if (table.result) {
      const payout = result ? result.payout : 0;
      return `${table.result.label} · ${payout > 0 ? vc(payout, 2) : 'Einsatz weg'}`;
    }
    if (myTurn) return `${STREET_LABEL[table.street]} · du bist am Zug. ${call > 0 ? `${(call / 10_000).toFixed(2).replace('.', ',')} VC mitgehen.` : 'Kein Einsatz offen.'}`;
    return `${STREET_LABEL[table.street]} · die Gäste sind dran. Pot ${(table.pot / 10_000).toFixed(2).replace('.', ',')} VC.`;
  };

  return (
    <section className="slot-window" aria-label={`${props.title} · Poker`}>
      <CasinoWindowHeader
        wallet={props.wallets.wallet}
        house={props.wallets.house}
        mods={props.mods}
        pact={props.pact}
        full={props.full}
        onToggleFull={props.onToggleFull}
        onWithdraw={props.onWithdraw}
        canWithdraw={props.canWithdraw}
      />
      <div className="slot-window-title">
        <div>
          <span className="eyebrow">AM TISCH</span>
          <strong>{props.title}</strong>
        </div>
        <p>{props.subtitle}</p>
      </div>

      <PokerStage ref={stage} label={`Poker-Tisch ${props.title}`} />
      <p className="slot-narration" aria-live="polite">{narration()}</p>

      <div className="table-actions">
        <button type="button" className="btn primary" disabled={!myTurn || call > 0} onClick={() => act('CHECK')}>PASSEN</button>
        <button type="button" className="btn" disabled={!myTurn} onClick={() => act('CALL')}>
          {call > 0 ? `MITGEHEN ${(call / 10_000).toFixed(2).replace('.', ',')}` : 'MITGEHEN'}
        </button>
        <button type="button" className="btn" disabled={!canRaise} onClick={() => act('RAISE')}
          title="Erhöht um die Setzeinheit; drei Erhoehungen je Strasse, danach nur noch mitgehen.">ERHÖHEN</button>
        <button type="button" className="btn ghost" disabled={!myTurn} onClick={() => act('FOLD')}
          title="Aus der Hand, die Chips im Pot bleiben liegen.">FOLD</button>
      </div>

      <div className="bet-row">
        {bets.map((value) => (
          <button key={value} type="button" className={`chip${bet === value ? ' active' : ''}`}
            disabled={running} onClick={() => setBet(value)}>
            {value} VC
          </button>
        ))}
      </div>

      <button type="button" className="btn primary big" disabled={running || !canPay} onClick={deal}>
        {running ? 'HAND LÄUFT' : canPay ? `AUSTEILEN · ${bet} VC` : 'ZU WENIG BARGELD'}
      </button>
      <small className="hint">
        Buy-in {bet} VC, Ante ein Viertel davon, drei Erhoehungen je Strasse. Der Tisch zieht
        {' '}{Math.round((strengthOf(human?.hole ?? [], table?.board ?? []) ?? 0) * 100)} % Stärke aus deinen Karten
        und kassiert 5 % vom Pot.
      </small>
    </section>
  );
}
