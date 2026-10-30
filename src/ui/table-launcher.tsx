/** Waehlt das passende Fenster am Geraet: Walzen, Plinko oder Wuerfel. */
import type { GameResult } from '../core/games/contracts';
import type { DiceBetKind } from '../core/games/dice-bets';
import { defaultPlinkoConfig } from '../core/games/plinko-config';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { GameId, ModId } from '../core/sim/types';
import { DicePopup } from './dice-popup';
import { PlinkoPopup } from './plinko-popup';
import { SlotPopup } from './slot-popup';

interface SpinOptions {
  readonly variant?: DiceBetKind;
  readonly captureTrack?: boolean;
}

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
  readonly onSpin: (betVC: number, options?: SpinOptions) => GameResult | null;
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
  const where = `${houseName} · ${operator}.`;

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
