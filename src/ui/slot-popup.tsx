/** Ein Slot-Fenster: Walzen, Wettkonsole und die Risiko-Karte nach jedem Gewinn. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameResult } from '../core/games/contracts';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { VaCoinMicro } from '../core/economy/vacoin';
import { SlotStage, type SlotStageHandle } from '../render/games/slot-stage';
import { vc } from './format';
import { BetConsole } from './bet-console';
import { CasinoWindowHeader } from './casino-window-header';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly wallet: VaCoinMicro;
  readonly house?: VaCoinMicro;
  readonly mods: readonly string[];
  readonly pact: string;
  readonly bets: readonly number[];
  readonly canPay: boolean;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw?: () => void;
  readonly canWithdraw?: boolean;
  readonly onSpinFor: (betVC: number) => GameResult | null;
  readonly onGamble?: (color: RiskColor, stakeVC: number) => RiskOutcome | null;
}

const stakeOf = (result: GameResult | null): number =>
  result ? Number((result.payout / 10_000).toFixed(2)) : 0;

export function SlotPopup(props: Props) {
  const { title, subtitle, bets, canPay, full, onSpinFor, onGamble } = props;
  const stage = useRef<SlotStageHandle>(null);
  const [bet, setBet] = useState(bets[0] ?? 0);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [settled, setSettled] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [risk, setRisk] = useState<RiskOutcome | null>(null);
  const blocked = bets.length > 0 && !canPay;

  const runSpin = useCallback((): void => {
    if (spinning || blocked) return;
    const next = onSpinFor(bet);
    if (!next) return;
    setSpinning(true);
    setRisk(null);
    stage.current?.spin(next, () => {
      setResult(next);
      setSpinning(false);
      setSettled((value) => value + 1);
    });
  }, [bet, blocked, onSpinFor, spinning]);

  useEffect(() => {
    if (!auto || spinning || settled === 0 || blocked) return;
    const id = window.setTimeout(() => runSpin(), 950);
    return () => window.clearTimeout(id);
  }, [auto, blocked, runSpin, settled, spinning]);

  const takeRisk = (color: RiskColor): void => {
    if (!onGamble || !result) return;
    const outcome = onGamble(color, stakeOf(result));
    if (!outcome) return;
    setRisk(outcome);
    stage.current?.gamble(outcome.card, outcome.won);
  };

  const stake = stakeOf(result);
  const canRisk = Boolean(onGamble) && stake > 0 && !spinning && risk === null;
  const wins = result?.wins?.length ?? 0;

  return (
    <section className="slot-window" aria-label={`${title} · Slot`}>
      <CasinoWindowHeader
        wallet={props.wallet}
        house={props.house}
        mods={props.mods}
        pact={props.pact}
        full={full}
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

      <SlotStage ref={stage} label={`Walzen von ${title}`} />

      <p className="slot-narration" aria-live="polite">
        {spinning
          ? 'Die Walzen laufen und halten von links nach rechts.'
          : result
            ? `${result.label}${wins ? ` · ${wins} Gewinnlinie${wins === 1 ? '' : 'n'}` : ''}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ''}`
            : 'Bereit. Der erste Spin startet die Walzen.'}
      </p>

      {canRisk && (
        <div className="risk-row">
          <span className="risk-row-label" title="Setzt den gerade gewonnenen Betrag erneut ein. 50/50, keine Serie.">
            RISIKO · {vc(result!.payout, 2)} auf eine Farbe
          </span>
          <button type="button" className="btn small" onClick={() => takeRisk('ROT')}>NEHMEN? ROT</button>
          <button type="button" className="btn small" onClick={() => takeRisk('SCHWARZ')}>SCHWARZ</button>
        </div>
      )}
      {risk && (
        <p className={`risk-result${risk.won ? ' win' : ''}`} aria-live="polite">
          Karte: {risk.card} · {risk.won ? `verdoppelt auf ${vc(risk.payout, 2)}` : `verloren (${vc(risk.stake, 2)})`}
        </p>
      )}

      <BetConsole
        bets={bets}
        bet={bet}
        onBet={setBet}
        spinning={spinning}
        blocked={blocked}
        auto={auto}
        onToggleAuto={() => setAuto((value) => !value)}
        onSpin={runSpin}
        actionLabel={bets.length ? `SPIN · ${bet} VC` : 'TESTSPIN'}
        hint={bets.length
          ? 'Gewinne gehen zurueck ins Portemonnaie, Verluste bleiben im fremden Haus. Nach jedem Gewinn entscheidet die Risiko-Karte.'
          : 'Der Testspin kostet nichts und zahlt nichts aus. So sieht ein Gast diesen Automaten.'}
      />
    </section>
  );
}
