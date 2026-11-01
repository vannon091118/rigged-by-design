/** Video Poker: fuenf Karten, Halten per Klick, Nachziehen, Auszahlung nach 9/6-Tabelle. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import {
  createCardShoe, dealVideoPoker, drawVideoPoker, evaluateVideoPoker,
} from '../../core/games/engines/interactive-cards';
import type { Card } from '../../core/rng/shoe';
import { canAfford, fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import { VideoPokerStage, type VideoPokerStageHandle } from '../../render/games/video-poker-stage';
import type { CardDeal } from '../../store/foreign-play';
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
  readonly onDeal: (stakeVC: number, bps: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, netBps: number, label: string) => GameResult | null;
}

const NO_HOLDS = [false, false, false, false, false];

export function VideoPokerPopup(props: Props) {
  const { bets } = props;
  const stage = useRef<VideoPokerStageHandle>(null);
  const shoe = useRef(createCardShoe(0));
  const [bet, setBet] = useState(bets[0] ?? 1);
  const [hand, setHand] = useState<readonly Card[] | null>(null);
  const [holds, setHolds] = useState<readonly boolean[]>(NO_HOLDS);
  // Spiegel fuer schnelle Klicks: React-State allein wuerde den zweiten Klick verschlucken.
  const holdsRef = useRef<readonly boolean[]>(NO_HOLDS);
  const [phase, setPhase] = useState<'IDLE' | 'HOLD' | 'DONE'>('IDLE');
  const [result, setResult] = useState<GameResult | null>(null);
  const [netBps, setNetBps] = useState<number>(10_000);
  const canPay = canAfford(props.wallets.wallet, fromVC(bet));

  const deal = (): void => {
    if (phase === 'HOLD' || !canPay) return;
    const dealResult = props.onDeal(bet, 10_000); // Video Poker: 100% basis
    if (!dealResult) return;
    shoe.current = createCardShoe(dealResult.seed);
    setNetBps(dealResult.netBps);
    const dealt = dealVideoPoker(shoe.current);
    setHand(dealt);
    holdsRef.current = NO_HOLDS;
    setHolds(NO_HOLDS);
    setResult(null);
    setPhase('HOLD');
    playSfx('cardFlip');
    stage.current?.render(dealt, NO_HOLDS, null);
  };

  const toggle = (index: number): void => {
    if (phase !== 'HOLD' || !hand) return;
    const next = holdsRef.current.map((held, position) => (position === index ? !held : held));
    holdsRef.current = next;
    setHolds(next);
    playSfx('cardFlip');
    stage.current?.render(hand, next, null);
  };

  const draw = (): void => {
    if (phase !== 'HOLD' || !hand) return;
    const out = drawVideoPoker(hand, holdsRef.current, shoe.current);
    setHand(out.hand);
    setPhase('DONE');
    const evaluation = evaluateVideoPoker(out.hand);
    playSfx('cardFlip');
    stage.current?.render(out.hand, holdsRef.current, evaluation.hand === 'NOTHING' ? null : evaluation.hand);
    const edge = Math.max(0, 10_000 - netBps);
    const adjusted = Math.max(0, out.bps - edge);
    setResult(props.onSettle(bet, adjusted, out.label));
  };

  const narration = (): string => {
    if (phase === 'HOLD') {
      const count = holds.filter(Boolean).length;
      return count === 0
        ? 'Klicke die Karten an, die du behalten willst, dann Tauschen.'
        : `${count} Karte(n) gehalten. Tauschen zieht den Rest neu.`;
    }
    if (phase === 'DONE' && hand) {
      const evaluation = evaluateVideoPoker(hand);
      return `${evaluation.label} · ${result && result.payout > 0 ? vc(result.payout, 2) : 'nichts'}`;
    }
    return 'Geben, Karten halten, tauschen. Die Tabelle links zeigt, was jede Hand zahlt.';
  };

  return (
    <section className="slot-window" aria-label={`${props.title} · Video Poker`}>
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
          <strong>{props.title}</strong>
        </div>
        <p>{props.subtitle}</p>
      </div>

      <VideoPokerStage ref={stage} label={`Video-Poker-Schirm ${props.title}`} onCard={toggle} />
      <p className="slot-narration" aria-live="polite">{narration()}</p>

      {phase === 'HOLD' && hand && (
        <div className="hold-row" role="group" aria-label="Karten halten">
          {hand.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`chip${holds[index] ? ' active' : ''}`}
              onClick={() => toggle(index)}
            >
              HOLD {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="bet-row">
        {bets.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip${bet === value ? ' active' : ''}`}
            disabled={phase === 'HOLD'}
            onClick={() => setBet(value)}
          >
            {value} VC
          </button>
        ))}
      </div>

      {phase === 'HOLD' ? (
        <button type="button" className="btn primary big" onClick={draw}>TAUSCHEN</button>
      ) : (
        <button type="button" className="btn primary big" disabled={!canPay} onClick={deal}>
          {canPay ? `GEBEN · ${bet} VC` : 'ZU WENIG BARGELD'}
        </button>
      )}
      <small className="hint">
        Neun Zeilen, feste Quoten: Royal Flush 800x bis Jacks or Better 1x. Der Hausvorteil des Betreibers geht vom Gewinn ab.
      </small>
    </section>
  );
}
