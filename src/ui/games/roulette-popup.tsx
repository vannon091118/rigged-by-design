/** Roulette-Fenster: Kessel links, Setzfeld rechts, jeder Jeton ist eine echte Wette. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import { spotInfo, type RouletteChip } from '../../core/games/roulette-table';
import { fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import { RouletteStage, type RouletteStageHandle } from '../../render/games/roulette-stage';
import { playSfx } from '../../render/sound-fx';
import { vc } from '../format';
import { CasinoWindowHeader } from '../casino-window-header';
import { UI_ICON } from '../icons';
import { RouletteTableau } from '../roulette-tableau';

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
  readonly onSpin: (betVC: number, options: { roulette: readonly RouletteChip[] }) => GameResult | null;
}

export function RoulettePopup(props: Props) {
  const { bets, onSpin, title } = props;
  const stage = useRef<RouletteStageHandle>(null);
  const [denom, setDenom] = useState(bets[0] ?? 1);
  const [chips, setChips] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [lastBet, setLastBet] = useState<readonly RouletteChip[]>([]);

  const counts = Object.values(chips);
  // Einsatz in Mikro-Einheiten rechnen, damit Jetons und Einsatz exakt zusammenpassen.
  const chipMicro = fromVC(denom);
  const stakeMicro = counts.reduce((sum, count) => sum + count, 0) * chipMicro;
  const total = stakeMicro / 10_000;
  const walletVC = props.wallets.wallet / 10_000;
  const tooPoor = total > walletVC || !props.canPay;
  const blocked = running || tooPoor;

  const place = (spot: string): void => {
    if (blocked) return;
    // Ein neuer Satz gehoert nicht zum alten Ergebnis; sonst wirkt der alte
    // Verlust wie die Buchung des gerade gelegten Jetons.
    setResult(null);
    setLastBet([]);
    setChips((current) => ({ ...current, [spot]: (current[spot] ?? 0) + 1 }));
  };

  const chooseDenom = (value: number): void => {
    setResult(null);
    setLastBet([]);
    setDenom(value);
  };

  const spin = (): void => {
    if (blocked || total <= 0) return;
    const list: RouletteChip[] = Object.entries(chips)
      .filter(([, count]) => count > 0)
      .map(([spot, count]) => ({ spot, stake: (count * chipMicro) as VaCoinMicro }));
    const next = onSpin(total, { roulette: list });
    if (!next) return;
    setLastBet(list);
    setResult(next);
    setRunning(true);
    setChips({});
    const number = next.roulette?.number ?? 0;
    playSfx('roulette');
    stage.current?.spin(number, () => setRunning(false), next.payout > 0);
  };

  // Der Satz bleibt sichtbar, auch wenn kein Feld getroffen wurde; sonst ist
  // bei einer Niete nicht mehr erkennbar, worauf gesetzt wurde.
  const betText = (): string => lastBet
    .map((chip) => spotInfo(chip.spot)?.label ?? chip.spot)
    .join(' · ');

  return (
    <section className="slot-window" aria-label={`${title} · Roulette`}>
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
          <span className="eyebrow">AM KESSEL</span>
          <strong>{title}</strong>
        </div>
        <p>{props.subtitle}</p>
        <img className="dealer-portrait" src={UI_ICON.croupier} alt="Croupier" />
      </div>

      <div className="roulette-layout">
        <div className="game-board-stage">
          <RouletteStage ref={stage} label={`Roulette-Kessel ${title}`} />
          <p className="slot-narration" aria-live="polite">
            {running
              ? 'Die Kugel laeuft und faellt in ihre Tasche.'
              : result
                ? `${result.label}${betText() ? ` · Satz ${betText()}` : ''}${
                  result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ' · alles verloren'}`
                : 'Jeton waehlen, Feld anklicken, drehen. Mehrere Felder gleichzeitig sind erlaubt.'}
          </p>
        </div>

        <div className="roulette-side">
          <RouletteTableau chips={chips} blocked={running} onSpot={place} />
          <div className="roulette-console">
            <div className="bet-row">
              {bets.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip${denom === value ? ' active' : ''}`}
                  disabled={running}
                  onClick={() => chooseDenom(value)}
                  title={`Jeton zu ${value} VC`}
                >
                  {value} VC
                </button>
              ))}
            </div>
            <div className="roulette-total">
              <span>
                <img className="ui-icon" src={UI_ICON.chip} alt="" />
                {counts.reduce((sum, count) => sum + count, 0)} Jetons
              </span>
              <strong>{total} VC</strong>
            </div>
            <button type="button" className="btn primary big" disabled={blocked || total <= 0} onClick={spin}>
              {tooPoor && total > 0 ? 'ZU WENIG BARGELD' : running ? 'DREHT…' : `DREHEN · ${total} VC`}
            </button>
            <button
              type="button"
              className="btn small ghost"
              disabled={running || counts.length === 0}
              onClick={() => { setChips({}); setResult(null); setLastBet([]); }}
            >
              FELDER LEEREN
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
