/** Plinko-Fenster: das Brett ist sofort da, jeder Abwurf zeigt die echte Physikbahn. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import type { PlinkoConfig } from '../../core/games/plinko-config';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import { PlinkoStage, type PlinkoStageHandle } from '../../render/games/plinko-stage';
import { playPinRun } from '../../render/sound-fx';
import { vc } from '../format';
import { BetConsole } from '../bet-console';
import { CasinoWindowHeader } from '../casino-window-header';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly config: PlinkoConfig;
  readonly rows: number;
  readonly wallets: { readonly wallet: VaCoinMicro; readonly house: VaCoinMicro };
  readonly mods: readonly string[];
  readonly pact: string;
  readonly bets: readonly number[];
  readonly canPay: boolean;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw?: () => void;
  readonly canWithdraw?: boolean;
  readonly onDrop: (betVC: number) => GameResult | null;
}

export function PlinkoPopup(props: Props) {
  const { bets, canPay, onDrop, config, rows, title, subtitle } = props;
  const stage = useRef<PlinkoStageHandle>(null);
  const [bet, setBet] = useState(bets[0] ?? 0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const blocked = !canPay;

  const drop = (): void => {
    if (running || blocked) return;
    const next = onDrop(bet);
    if (!next) return;
    setResult(next);
    setRunning(true);
    if (next.drop) { playPinRun(6); stage.current?.play(next.drop, () => setRunning(false)); }
    else setRunning(false);
  };

  return (
    <section className="slot-window" aria-label={`${title} · Plinko`}>
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
          <span className="eyebrow">AM AUTOMATEN</span>
          <strong>{title}</strong>
        </div>
        <p>{subtitle}</p>
      </div>

      <div className="game-board">
        <div className="game-board-stage">
          <PlinkoStage ref={stage} config={config} rows={rows} label={`Plinko-Brett ${title}`} />
          <p className="slot-narration" aria-live="polite">
            {running
              ? 'Der Ball laeuft durch die Stifte und faellt in sein Fach.'
              : result
                ? `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ' · kein Treffer'}`
                : 'Bereit. Ein Klick wirft den ersten Ball.'}
          </p>
        </div>
        <div className="game-board-side">
          <BetConsole
            bets={bets}
            bet={bet}
            onBet={setBet}
            spinning={running}
            blocked={blocked}
            onSpin={drop}
            actionLabel={`BALL WERFEN · ${bet} VC`}
            hint="Die Bahn ist eine echte Simulation: gleiche Startbedingungen, gleiches Fach, gleiche Auszahlung. Jeder Wurf wird sofort gebucht."
          />
        </div>
      </div>
    </section>
  );
}
