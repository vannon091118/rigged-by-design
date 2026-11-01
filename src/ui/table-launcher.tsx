/** Waehlt das passende Fenster am Geraet: Walzen, Plinko oder Wuerfel. */
import type { GameExtras, GameResult } from '../core/games/contracts';
import { defaultPlinkoConfig } from '../core/games/plinko-config';
import type { ShellRound } from '../core/games/shell-round';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { CardDeal } from '../store/foreign-play';
import type { GameId, ModId } from '../core/sim/types';
import { BlackjackPopup } from './games/blackjack-popup';
import { DicePopup } from './games/dice-popup';
import { PlinkoPopup } from './games/plinko-popup';
import { PokerPopup } from './games/poker-popup';
import { RoulettePopup } from './games/roulette-popup';
import { ShellPopup } from './games/shell-popup';
import { SlotPopup } from './games/slot-popup';
import { VideoPokerPopup } from './games/video-poker-popup';

interface Props {
  readonly game: GameId;
  readonly label: string;
  readonly houseName: string;
  readonly operator: string;
  readonly wallet: VaCoinMicro;
  readonly house: VaCoinMicro;
  readonly mods: readonly ModId[];
  readonly pact: string;
  readonly bets: readonly number[];
  readonly canPay: boolean;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw: () => void;
  readonly canWithdraw: boolean;
  readonly onSpin: (betVC: number, options?: GameExtras) => GameResult | null;
  readonly onShellRound: () => ShellRound;
  readonly onDeal: (stakeVC: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, engineBps: number, label: string) => GameResult | null;
  /** Bucht einen weiteren Einsatz (Double, Split, Versicherung) und meldet Erfolg. */
  readonly onAdditionalBet: (additionalVC: number) => boolean;
  readonly onRisk?: (color: RiskColor, stakeVC: number) => RiskOutcome | null;
}

export function TableLauncher(props: Props) {
  const { game, label, houseName, operator, wallet, house, mods, pact, bets, canPay, full, onSpin, onRisk } = props;
  const wallets = { wallet, house };
  const common = {
    title: label,
    mods,
    pact,
    bets,
    canPay,
    full,
    onToggleFull: props.onToggleFull,
    onWithdraw: props.onWithdraw,
    canWithdraw: props.canWithdraw,
  };
  const where = `${houseName} Â· ${operator}.`;

  if (game === 'PLINKO') {
    return (
      <PlinkoPopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Standardbrett mit acht Reihen.`}
        config={defaultPlinkoConfig()}
        rows={8}
        onDrop={(betVC) => onSpin(betVC, { captureTrack: true })}
      />
    );
  }
  if (game === 'BLACKJACK') {
    return (
      <BlackjackPopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Zwei Karten, ein Dealer, du entscheidest.`}
        onDeal={props.onDeal}
        onSettle={props.onSettle}
        onAdditionalBet={props.onAdditionalBet}
      />
    );
  }
  if (game === 'POKER') {
    return (
      <PokerPopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Vier Spieler, ein Pot, du entscheidest an jedem Zug.`}
        onDeal={props.onDeal}
        onSettle={props.onSettle}
      />
    );
  }
  if (game === 'VIDEO_POKER') {
    return (
      <VideoPokerPopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Neun Zeilen, fuenf Karten, du haeltst.`}
        onDeal={props.onDeal}
        onSettle={props.onSettle}
      />
    );
  }
  if (game === 'ROULETTE') {
    return (
      <RoulettePopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Kessel mit 37 Taschen, Satz auf jedem Feld.`}
        onSpin={(betVC, options) => onSpin(betVC, options)}
      />
    );
  }
  if (game === 'SHELL') {
    return (
      <ShellPopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Drei Becher, eine Perle, du waehlst.`}
        onPrepare={() => props.onShellRound()}
        onPickCup={(round, slot, betVC) => onSpin(betVC, { shell: { round, pick: slot } })}
      />
    );
  }
  if (game === 'DICE') {
    return (
      <DicePopup
        {...common}
        wallets={wallets}
        subtitle={`${where} Zwei faire Wuerfel, fuenf Felder.`}
        onRoll={(kind, betVC) => onSpin(betVC, { variant: kind })}
      />
    );
  }
  return (
    <SlotPopup
      {...common}
      wallet={wallet}
      house={house}
      subtitle={`${where} Hausvorteil je nach Geraet.`}
      onSpinFor={(betVC) => onSpin(betVC)}
      onGamble={onRisk ? (color, stakeVC) => onRisk(color, stakeVC) : undefined}
    />
  );
}
