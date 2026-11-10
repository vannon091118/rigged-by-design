/** Fremdes Haus: echte Rivalen mit Betreiber, Regeln, Maschinen und Hausvorteil. */
import { useState } from 'react';
import { HOUSE_FLOAT } from '../core/sim/money';
import { RIVALS, rivalStates, type RivalId } from '../core/sim/rivals';
import type { GameResult } from '../core/games/contracts';
import type { DiceBetKind } from '../core/games/dice-bets';
import type { ShellRound } from '../core/games/shell-round';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { CardDeal } from '../store/foreign-play';
import type { ExclusionCommand } from '../store/game-commands';
import type { GameView } from '../store/types';
import { vc } from './format';
import { TICK_MS } from '../core/sim/tick-timing';
import { RivalProfile, TableStage, VenueTop } from './games-venue';
import { GAME_ICON, UI_ICON } from './icons';
import { PopupShell } from './popup-shell';
import { SelfExclusionPanel } from './self-exclusion-panel';
import { TableLauncher } from './table-launcher';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onPlay: (
    rivalId: RivalId, machineIndex: number, betVC: number,
    options?: { variant?: DiceBetKind; captureTrack?: boolean },
  ) => GameResult | null;
  readonly onRisk: (rivalId: RivalId, color: RiskColor, stakeVC: number) => RiskOutcome | null;
  readonly onTakeHome: () => void;
  readonly onShellRound: () => ShellRound;
  readonly onDealCard: (rivalId: RivalId, machineIndex: number, stakeVC: number) => CardDeal | null;
  readonly onSettleCard: (rivalId: RivalId, machineIndex: number, stakeVC: number, engineBps: number, label: string) => GameResult | null;
  /** Bucht einen weiteren Einsatz (Double, Split, Versicherung) und meldet Erfolg. */
  readonly onAdditionalBet: (additionalVC: number) => boolean;
  readonly onExclusion: (command: ExclusionCommand, limitVC?: number) => void;
  readonly initialRivalId?: RivalId;
}

const BET_STEPS = [1, 2, 5, 10] as const;

export function GamesPopup({ view, onClose, onPlay, onRisk, onTakeHome, onExclusion, onShellRound, onDealCard, onSettleCard, onAdditionalBet, initialRivalId }: Props) {
  const states = rivalStates(view.tick);
  const startRival = states.find((entry) => entry.id === (initialRivalId ?? RIVALS[0]!.id)) ?? states[0]!;
  const [rivalId, setRivalId] = useState<RivalId>(startRival.id);
  const [machineIndex, setMachineIndex] = useState(0);
  const [betVC, setBetVC] = useState(startRival.machines[0]!.baseBet / 10_000);
  const [full, setFull] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const rival = states.find((entry) => entry.id === rivalId) ?? states[0]!;
  const machine = rival.machines[machineIndex] ?? rival.machines[0]!;
  const baseVC = machine.baseBet / 10_000;
  const bets = BET_STEPS.map((step) => Number((baseVC * step).toFixed(2)));
  const cannotPay = view.wallet < betVC * 10_000;

  const selectRival = (id: RivalId): void => {
    const next = states.find((entry) => entry.id === id)!;
    setRivalId(id);
    setMachineIndex(0);
    setBetVC(next.machines[0]!.baseBet / 10_000);
    setResult(null);
  };

  const selectMachine = (index: number): void => {
    setMachineIndex(index);
    setBetVC(rival.machines[index]!.baseBet / 10_000);
    setResult(null);
  };

  const play = (): void => {
    if (spinning || cannotPay) return;
    setSpinning(true);
    window.setTimeout(() => {
      setResult(onPlay(rivalId, machineIndex, betVC));
      setSpinning(false);
    }, TICK_MS);
  };

  return (
    <PopupShell eyebrow="DU BIST GAST" title={rival.name} onClose={onClose} wide full={full} surface="activity" game={machine.game}>
      <VenueTop
        states={states}
        rivalId={rivalId}
        onSelect={selectRival}
        wallet={view.wallet}
        house={view.house}
        full={full}
        onTakeHome={onTakeHome}
        onToggleFull={() => setFull((value) => !value)}
      />

      <SelfExclusionPanel view={view} onExclusion={onExclusion} />

      <RivalProfile rival={rival} />

      <div className="game-select">
        {rival.machines.map((entry, index) => (
          <button
            key={`${entry.game}-${index}`}
            type="button"
            className={`game-tab${machineIndex === index ? ' active' : ''}`}
            onClick={() => selectMachine(index)}
            title="Gerät wählen. Der Mindesteinsatz steht in der zweiten Zeile."
          >
            <img className="game-tab-icon" src={GAME_ICON[entry.game] ?? UI_ICON.coin} alt="" />
            <strong>{entry.label}</strong>
            <span>{entry.game} · ab {vc(entry.baseBet, 2)}{entry.mods.length ? ` · ${entry.mods.length} Mods` : ''}</span>
          </button>
        ))}
      </div>

      {machine.game === 'SLOT' || machine.game === 'PLINKO' || machine.game === 'DICE' || machine.game === 'ROULETTE' || machine.game === 'SHELL' || machine.game === 'BLACKJACK' || machine.game === 'POKER' || machine.game === 'VIDEO_POKER' ? (
        <TableLauncher
          key={`${rivalId}-${machineIndex}`}
          game={machine.game}
          label={machine.label}
          houseName={rival.name}
          operator={rival.operator}
          wallet={view.wallet}
          house={view.house}
          mods={machine.mods}
          pact={view.exclusionPact ? `Limit ${vc(view.exclusionPact.limit, 0)}` : 'kein Pakt'}
          bets={bets}
          canPay={!cannotPay}
          full={full}
          onToggleFull={() => setFull((value) => !value)}
          onWithdraw={onTakeHome}
          canWithdraw={view.house > HOUSE_FLOAT}
          onSpin={(betVC, options) => onPlay(rivalId, machineIndex, betVC, options)}
          onRisk={machine.game === 'SLOT' ? (color, stakeVC) => onRisk(rivalId, color, stakeVC) : undefined}
          onShellRound={onShellRound}
          onDeal={(stakeVC) => onDealCard(rivalId, machineIndex, stakeVC)}
          onSettle={(stakeVC, engineBps, label) => onSettleCard(rivalId, machineIndex, stakeVC, engineBps, label)}
          onAdditionalBet={onAdditionalBet}
        />
      ) : (
        <TableStage
          machine={machine}
          spinning={spinning}
          result={result}
          bets={bets}
          betVC={betVC}
          cannotPay={cannotPay}
          full={full}
          onBet={setBetVC}
          onPlay={play}
        />
      )}
    </PopupShell>
  );
}
