/** Automaten-Popup: Gast spielt, Betrieb diagnostiziert. Eine globale Perspektive, kein interner Rollentoggle. */
import { useState } from 'react';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { GateResult } from '../core/games/plinko-sandbox';
import type { PlinkoConfig, PlinkoMode } from '../core/games/plinko-config';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { ShellRound } from '../core/games/shell-round';
import type { SlotProfile } from '../core/games/slot-profile';
import type { Furniture, ModId } from '../core/sim/types';
import type { CardDeal } from '../store/foreign-play';
import type { GameView } from '../store/types';
import type { Perspective } from './app-model';
import { MachineOperatorBody, gameLabel } from './machine-operator';
import { MachinePlayLazy } from './machine-play-lazy';
import { PopupShell } from './popup-shell';

interface Props {
  readonly item: Furniture;
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onClose: () => void;
  readonly onTest: () => GameResult | null;
  readonly onRepair: () => void;
  readonly onMod: (id: ModId) => void;
  readonly onAddReel: () => void;
  readonly onBet: (vcValue: number) => void;
  readonly onSlotOdds: (profile: SlotProfile) => void;
  readonly onTakeDrink: () => void;
  readonly onDeployPlinko: (config: PlinkoConfig) => GateResult;
  readonly onPlinkoMode: (mode: PlinkoMode) => void;
  readonly onWithdraw: () => void;
  readonly onPlay: (betVC: number, options?: GameExtras) => GameResult | null;
  readonly onDeal: (stakeVC: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, engineBps: number, label: string) => GameResult | null;
  readonly onAdditionalBet: (amountVC: number) => boolean;
  readonly onShellRound: () => ShellRound;
  readonly onRisk: (color: RiskColor, stakeVC: number) => RiskOutcome | null;
}

export function MachinePopup(props: Props) {
  const { item, view, perspective, onClose, onPlay, onDeal, onSettle, onAdditionalBet, onShellRound, onRisk } = props;
  const [full, setFull] = useState(false);
  const isGame = Boolean(item.gameId);

  if (perspective === 'guest') {
    return (
      <PopupShell
        eyebrow={isGame ? 'GAST · SPIELGERÄT' : 'GAST · ORIENTIERUNG'}
        title={item.label}
        onClose={onClose}
        wide
        full={full}
        game={item.gameId}
      >
        {!isGame ? (
          <div className="guest-machine-note">
            <strong>{item.kind === 'BAR' ? 'Die Bar ist geöffnet.' : 'Kein Spielgerät.'}</strong>
            <p>Hier bedient das Personal. Setz dich an ein Spielgerät, um zu spielen.</p>
            <button type="button" className="btn ghost" onClick={onClose}>ZURÜCK AUF DEN FLOOR</button>
          </div>
        ) : item.damaged ? (
          <div className="guest-machine-note bad">
            <strong>Außer Betrieb.</strong>
            <p>Dieses Gerät wird gerade gewartet. Der Betrieb repariert es im Betriebsmodus.</p>
          </div>
        ) : (
          <MachinePlayLazy
            item={item}
            view={view}
            full={full}
            onToggleFull={() => setFull((value) => !value)}
            onWithdraw={props.onWithdraw}
            onPlay={onPlay}
            onDeal={onDeal}
            onSettle={onSettle}
            onAdditionalBet={onAdditionalBet}
            onShellRound={onShellRound}
            onRisk={onRisk}
          />
        )}
      </PopupShell>
    );
  }

  return (
    <PopupShell
      eyebrow={`BETRIEB · ${gameLabel(item.gameId ?? null)}`}
      title={item.label}
      onClose={onClose}
      wide
      full={full}
      game={item.gameId}
    >
      <MachineOperatorBody
        item={item}
        view={view}
        full={full}
        onToggleFull={() => setFull((value) => !value)}
        onTest={props.onTest}
        onRepair={props.onRepair}
        onMod={props.onMod}
        onAddReel={props.onAddReel}
        onBet={props.onBet}
        onSlotOdds={props.onSlotOdds}
        onTakeDrink={props.onTakeDrink}
        onDeployPlinko={props.onDeployPlinko}
        onPlinkoMode={props.onPlinkoMode}
      />
    </PopupShell>
  );
}
