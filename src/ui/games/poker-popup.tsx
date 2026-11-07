/** Rundenpoker: fünf Buy-in-Stakes, Einsatz pro Turn, drei CPU-Profile. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import { canAfford, fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import type { PokerAction } from '../../core/games/poker-strategy';
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
  readonly onDeal: (stakeVC: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, engineBps: number, label: string) => GameResult | null;
}

const STREET_LABEL: Readonly<Record<PokerTable['street'], string>> = {
  PREFLOP: 'Vor dem Flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Showdown',
};

/** Fünf Buy-in-Stufen; die erste ist der Mindest-Buy-in von 10 VC. */
const STAKES = [10, 20, 50, 100, 200] as const;

const RAISE_SIZES = [
  { id: 'THIRD', label: '1/3 POT', fraction: 1 / 3 },
  { id: 'HALF', label: '1/2 POT', fraction: 1 / 2 },
  { id: 'THREE_QUARTER', label: '3/4 POT', fraction: 3 / 4 },
  { id: 'POT', label: 'POT', fraction: 1 },
  { id: 'ALL_IN', label: 'ALL-IN', fraction: null },
] as const;

type RaiseSizeId = typeof RAISE_SIZES[number]['id'];

const amount = (micro: number): string => vc(micro, 2);

export function PokerPopup(props: Props) {
  const rng = useRef<Prng | null>(null);
  const stage = useRef<PokerStageHandle>(null);
  const [buyIn, setBuyIn] = useState<number>(STAKES[0]);
  const [raiseSize, setRaiseSize] = useState<RaiseSizeId>('HALF');
  const [table, setTable] = useState<PokerTable | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const stake = fromVC(buyIn);
  const canPay = canAfford(props.wallets.wallet, stake);
  const human = table?.players[0] ?? null;
  const running = Boolean(table) && !table?.result;
  const myTurn = Boolean(table && !table.result && table.toAct === 0 && human);
  const call = table && human ? toCall(table, human) : 0;
  const canRaise = Boolean(myTurn && table && human && table.raises < 3 && human.stack > call);
  const selectedRaise = RAISE_SIZES.find((entry) => entry.id === raiseSize) ?? RAISE_SIZES[1];

  const raiseTarget = (): number => {
    if (!table || !human) return 0;
    if (selectedRaise.fraction === null) return human.streetCommitted + human.stack;
    const potRaise = Math.max(table.unit, Math.round((table.pot + call) * selectedRaise.fraction));
    return Math.min(human.streetCommitted + human.stack, table.bet + potRaise);
  };

  const commit = (next: PokerTable): void => {
    setTable(next);
    stage.current?.render(next);
    playSfx('cardFlip');
    if (next.result) setResult(props.onSettle(buyIn, next.result.multiplierBps, next.result.label));
  };

  const deal = (): void => {
    if (running || !canPay) return;
    const dealResult = props.onDeal(buyIn);
    if (!dealResult) return;
    rng.current = new Prng(dealResult.seed);
    setResult(null);
    commit(startHand(rng.current, { stake, opponents: 3 }));
  };

  const act = (action: PokerAction): void => {
    if (!table || !myTurn || !rng.current) return;
    commit(humanAct(table, action, rng.current, action === 'RAISE' ? raiseTarget() : undefined));
  };

  const narration = (): string => {
    if (!table) return 'Buy-in wählen und austeilen. Fünf Stakes ab 10 VC, drei Gäste mit eigenen Profilen.';
    if (table.result) {
      const payout = result ? result.payout : 0;
      return `${table.result.label} · ${payout > 0 ? amount(payout) : 'Einsatz weg'}`;
    }
    if (myTurn) return `${STREET_LABEL[table.street]} · du bist am Zug. ${call > 0 ? `${amount(call)} mitgehen.` : 'Kein Einsatz offen.'}`;
    return `${STREET_LABEL[table.street]} · die Gäste sind dran. Pot ${amount(table.pot)}.`;
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
          {call > 0 ? `MITGEHEN ${amount(call)}` : 'MITGEHEN'}
        </button>
        <button type="button" className="btn" disabled={!canRaise} onClick={() => act('RAISE')}
          title="Erhöht um die gewählte Pot-Größe; drei Erhoehungen je Strasse, danach nur noch mitgehen.">
          {canRaise ? `ERHÖHEN · ${amount(raiseTarget())}` : 'ERHÖHEN'}
        </button>
        <button type="button" className="btn ghost" disabled={!myTurn} onClick={() => act('FOLD')}
          title="Aus der Hand, die Chips im Pot bleiben liegen.">FOLD</button>
      </div>

      {myTurn && !table?.result ? (
        <div className="bet-row" aria-label="Einsatz pro Turn">
          <span className="hint">SATZ</span>
          {RAISE_SIZES.map((entry) => (
            <button key={entry.id} type="button" className={`chip${raiseSize === entry.id ? ' active' : ''}`}
              onClick={() => setRaiseSize(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
      ) : !table || table.result ? (
        <div className="bet-row" aria-label="Buy-in">
          <span className="hint">BUY-IN</span>
          {STAKES.map((value) => (
            <button key={value} type="button" className={`chip${buyIn === value ? ' active' : ''}`}
              disabled={running} onClick={() => setBuyIn(value)}>
              {value} VC
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">Gegner am Zug – die nächste Entscheidung ist wieder deine.</p>
      )}

      <button type="button" className="btn primary big" disabled={running || !canPay} onClick={deal}>
        {running ? 'HAND LÄUFT' : canPay ? `AUSTEILEN · ${buyIn} VC` : 'ZU WENIG BARGELD'}
      </button>
      <small className="hint">
        Buy-in ab 10 VC, fünf Stakes. Ante ein Viertel davon; Fels spielt eng, Buchhalter ausgeglichen,
        Hai weit und aggressiv. 5 % Hausanteil vom Pot.
      </small>
    </section>
  );
}
