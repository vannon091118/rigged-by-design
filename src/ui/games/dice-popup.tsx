/** Wuerfel-Fenster: Wettfeld waehlen, Jetons setzen, Wurf zeigt die Augen des Kerns. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import { DICE_BETS, type DiceBetKind } from '../../core/games/dice-bets';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import { DiceStage, type DiceStageHandle } from '../../render/games/dice-stage';
import { playSfx } from '../../render/sound-fx';
import { vc } from '../format';
import { BetConsole } from '../bet-console';
import { CasinoWindowHeader } from '../casino-window-header';

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
  readonly onRoll: (kind: DiceBetKind, betVC: number) => GameResult | null;
}

const multiplierText = (bps: number): string => `${(bps / 10_000).toFixed(2).replace('.', ',')}x`;

export function DicePopup(props: Props) {
  const { bets, canPay, onRoll } = props;
  const stage = useRef<DiceStageHandle>(null);
  const [bet, setBet] = useState(bets[0] ?? 0);
  const [kind, setKind] = useState<DiceBetKind>('UNDER');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [rolledKind, setRolledKind] = useState<DiceBetKind | null>(null);
  const blocked = !canPay;

  const roll = (): void => {
    if (running || blocked) return;
    const next = onRoll(kind, bet);
    if (!next) return;
    setRolledKind(kind);
    setResult(next);
    setRunning(true);
    const dice = next.dice ?? [1, 1];
    playSfx('reelStop');
    stage.current?.roll(dice, next.multiplierBps > 0, () => setRunning(false));
  };

  const active = DICE_BETS.find((entry) => entry.id === kind) ?? DICE_BETS[0]!;

  return (
    <section className="slot-window" aria-label={`${props.title} · Wuerfel`}>
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

      <div className="dice-fields" role="group" aria-label="Wettfelder">
        {DICE_BETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`dice-field${entry.id === kind ? ' active' : ''}${result && rolledKind === entry.id ? (result.multiplierBps > 0 ? ' win' : ' lose') : ''}`}
            disabled={running}
            onClick={() => setKind(entry.id)}
            title={entry.hint}
          >
            <strong>{entry.label}</strong>
            <span>{multiplierText(entry.payoutBps)}</span>
          </button>
        ))}
      </div>

      <div className="game-board">
        <div className="game-board-stage">
          <DiceStage ref={stage} label={`Wuerfeltisch ${props.title}`} />
          <p className="slot-narration" aria-live="polite">
            {running
              ? 'Die Wuerfel fliegen und bleiben auf den Augen des Wurfs liegen.'
              : result
                ? `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ' · verloren'}`
                : `${active.label} gesetzt. ${active.hint}`}
          </p>
        </div>
        <div className="game-board-side">
          <BetConsole
            bets={bets}
            bet={bet}
            onBet={setBet}
            spinning={running}
            blocked={blocked}
            onSpin={roll}
            actionLabel={`WUERFELN · ${bet} VC`}
            hint="Beide Wuerfel sind fair: 36 Kombinationen, jede gleich wahrscheinlich. Die Quote je Feld steht am Feld."
          />
        </div>
      </div>
    </section>
  );
}
