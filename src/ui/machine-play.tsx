/** Eigene Spiele am Automaten: dieselben Tische wie im Fremdhaus, eigener Geldweg. */
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { ShellRound } from '../core/games/shell-round';
import type { Furniture } from '../core/sim/types';
import { HOUSE_FLOAT } from '../core/sim/money';
import { ownMinBet } from '../core/sim/own-play';
import type { CardDeal } from '../store/foreign-play';
import type { GameView } from '../store/types';
import { TableLauncher } from './table-launcher';

export interface MachinePlayProps {
  readonly item: Furniture;
  readonly view: GameView;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw: () => void;
  readonly onPlay: (betVC: number, options?: GameExtras) => GameResult | null;
  readonly onDeal: (stakeVC: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, engineBps: number, label: string) => GameResult | null;
  readonly onAdditionalBet: (amountVC: number) => boolean;
  readonly onShellRound: () => ShellRound;
  readonly onRisk: (color: RiskColor, stakeVC: number) => RiskOutcome | null;
}

export default function MachinePlay(props: MachinePlayProps) {
  const item = props.item;
  const minVC = ownMinBet(props.view, item) / 10_000;
  const baseVC = Math.max(minVC, item.baseBet / 10_000);
  const bets = [1, 2, 5, 10].map((step) => Number((baseVC * step).toFixed(2)));
  const pact = props.view.exclusionPact ? `Limit ${props.view.exclusionPact.limit / 10_000} VC` : 'kein Pakt';
  return (
    <TableLauncher
      game={item.gameId ?? 'SLOT'}
      label={item.label}
      houseName="Dein Casino"
      operator="DU · GAST"
      wallet={props.view.wallet}
      house={props.view.house}
      mods={item.mods}
      pact={pact}
      bets={bets}
      canPay={props.view.wallet >= ownMinBet(props.view, item)}
      full={props.full}
      onToggleFull={props.onToggleFull}
      onWithdraw={props.onWithdraw}
      canWithdraw={props.view.house > HOUSE_FLOAT}
      onSpin={(betVC, options) => props.onPlay(betVC, options)}
      onShellRound={props.onShellRound}
      onDeal={props.onDeal}
      onSettle={props.onSettle}
      onAdditionalBet={props.onAdditionalBet}
      onRisk={item.gameId === 'SLOT' ? props.onRisk : undefined}
    />
  );
}
