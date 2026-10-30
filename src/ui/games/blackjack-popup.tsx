/** Blackjack-Fenster: der Spieler zieht selbst, der Dealer deckt erst nach dem Halten auf. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import {
  createCardShoe, doubleBlackjack, hitBlackjack, standBlackjack, startBlackjack, type BlackjackRound,
} from '../../core/games/engines/interactive-cards';
import type { CardShoe } from '../../core/rng/shoe';
import { canAfford, fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import { BlackjackStage, type BlackjackStageHandle } from '../../render/games/blackjack-stage';
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
  readonly seed: () => number;
  readonly onSettle: (stakeVC: number, bps: number, label: string) => GameResult | null;
}

export function BlackjackPopup(props: Props) {
  const { bets } = props;
  const stage = useRef<BlackjackStageHandle>(null);
  const shoe = useRef<CardShoe | null>(null);
  const [bet, setBet] = useState(bets[0] ?? 1);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const playing = round?.phase === 'PLAYER';
  const stake = fromVC(bet);
  const canPay = canAfford(props.wallets.wallet, stake);
  const canDouble = canAfford(props.wallets.wallet, fromVC(bet * 2));

  const commit = (next: BlackjackRound): void => {
    setRound(next);
    stage.current?.render(next);
    if (next.phase === 'DONE') {
      setResult(props.onSettle(bet * next.units, next.multiplierBps, next.label));
    }
  };

  const deal = (): void => {
    if (playing || !canPay) return;
    shoe.current = createCardShoe(props.seed());
    setResult(null);
    commit(startBlackjack(shoe.current, 1));
  };

  const act = (kind: 'HIT' | 'STAND' | 'DOUBLE'): void => {
    if (!round || !shoe.current || round.phase !== 'PLAYER') return;
    if (kind === 'HIT') commit(hitBlackjack(round, shoe.current));
    else if (kind === 'STAND') commit(standBlackjack(round, shoe.current));
    else commit(doubleBlackjack(round, shoe.current));
  };

  const narration = (): string => {
    if (round?.phase === 'PLAYER') return `Du hast ${round.label.replace('Deine ', '')}. Der Dealer zeigt eine Karte.`;
    if (result) return `${round?.label ?? ''} · ${result.payout > 0 ? vc(result.payout, 2) : 'Einsatz weg'}`;
    if (round) return round.label;
    return 'Einsatz waehlen und austeilen. Blackjack zahlt 3:2, Gleichstand gibt den Einsatz zurueck.';
  };

  return (
    <section className="slot-window" aria-label={`${props.title} · Blackjack`}>
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

      <BlackjackStage ref={stage} label={`Blackjack-Tisch ${props.title}`} />
      <p className="slot-narration" aria-live="polite">{narration()}</p>

      <div className="table-actions">
        <button type="button" className="btn primary" disabled={!playing} onClick={() => act('HIT')}>
          KARTE ZIEHEN
        </button>
        <button type="button" className="btn" disabled={!playing} onClick={() => act('STAND')}>
          HALTEN
        </button>
        <button
          type="button"
          className="btn"
          disabled={!playing || round?.player.length !== 2 || !canDouble}
          onClick={() => act('DOUBLE')}
          title="Doppelter Einsatz, genau eine Karte, danach zieht der Dealer."
        >
          VERDOPPELN
        </button>
      </div>

      <div className="bet-row">
        {bets.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip${bet === value ? ' active' : ''}`}
            disabled={playing}
            onClick={() => setBet(value)}
          >
            {value} VC
          </button>
        ))}
      </div>

      <button type="button" className="btn primary big" disabled={playing || !canPay} onClick={deal}>
        {playing ? 'HAND LAEUFT' : canPay ? `AUSTEILEN · ${bet} VC` : 'ZU WENIG BARGELD'}
      </button>
      <small className="hint">
        Der Dealer zieht bis 17 und haelt weiche 17. Verdoppeln verdoppelt den Einsatz und damit auch das Risiko.
      </small>
    </section>
  );
}
