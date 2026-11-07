/** Huetchen-Fenster: zeigen, mischen, dann waehlt der Spieler selbst einen Becher. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import type { ShellRound } from '../../core/games/shell-round';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import { ShellStage, type ShellStageHandle } from '../../render/games/shell-stage';
import { playSfx } from '../../render/sound-fx';
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
  readonly onPrepare: () => ShellRound;
  readonly onPickCup: (round: ShellRound, slot: number, betVC: number) => GameResult | null;
}

type Phase = 'IDLE' | 'SHUFFLE' | 'PICK' | 'REVEAL';

export function ShellPopup(props: Props) {
  const { bets, onPrepare, onPickCup, title } = props;
  const stage = useRef<ShellStageHandle>(null);
  const [bet, setBet] = useState(bets[0] ?? 1);
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [round, setRound] = useState<ShellRound | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const busy = phase === 'SHUFFLE' || phase === 'REVEAL';

  const start = (): void => {
    if (busy) return;
    const next = onPrepare();
    setRound(next);
    setResult(null);
    setPhase('SHUFFLE');
    playSfx('cardFlip');
    stage.current?.begin(next.ballCup, next.moves, () => setPhase('PICK'));
  };

  const pick = (slot: number): void => {
    if (phase !== 'PICK' || !round) return;
    const next = onPickCup(round, slot, bet);
    if (!next) return;
    setResult(next);
    setPhase('REVEAL');
    playSfx('cardFlip');
    stage.current?.reveal(slot, () => setPhase('IDLE'));
  };

  const narration = (): string => {
    if (phase === 'SHUFFLE') return 'Der Geber zeigt die Perle und mischt die Becher.';
    if (phase === 'PICK') return 'Jetzt du: klicke den Becher an, unter dem die Perle liegt.';
    if (phase === 'REVEAL') return 'Der Becher hebt sich …';
    if (result) return `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ' · verloren'}`;
    return 'Ein Klick startet die Runde: erst wird gezeigt, dann gemischt, dann waehlst du.';
  };

  return (
    <section className="slot-window" aria-label={`${title} · Huetchenspiel`}>
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
          <strong>{title}</strong>
        </div>
        <p>{props.subtitle}</p>
      </div>

      <ShellStage ref={stage} label={`Huetchentisch ${title}`} onPick={pick} />

      <p className="slot-narration" aria-live="polite">{narration()}</p>

      {phase === 'PICK' && (
        <div className="shell-picks" role="group" aria-label="Becher waehlen">
          {[0, 1, 2].map((slot) => (
            <button key={slot} type="button" className="btn" onClick={() => pick(slot)}>
              BECHER {slot + 1}
            </button>
          ))}
        </div>
      )}

      <div className="shell-console">
        <div className="bet-row">
          {bets.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip${bet === value ? ' active' : ''}`}
              disabled={busy}
              onClick={() => setBet(value)}
              title={`Einsatz ${value} VC je Runde`}
            >
              {value} VC
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn primary big"
          disabled={busy || !props.canPay}
          onClick={start}
        >
          {!props.canPay ? 'ZU WENIG BARGELD' : phase === 'SHUFFLE' ? 'MISCHT…' : phase === 'PICK' ? 'BECHER ANKLICKEN' : `RUNDE STARTEN · ${bet} VC`}
        </button>
        <small>
          Drei Becher, eine Perle. Die Quote liegt bei 2,85x; der Hausvorteil des Betreibers geht davon ab.
        </small>
      </div>
    </section>
  );
}
