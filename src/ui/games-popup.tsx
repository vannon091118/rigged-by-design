/** Fremdes Haus: echte Rivalen mit Betreiber, Regeln, Maschinen und Hausvorteil. */
import { useState } from 'react';
import { HOUSE_FLOAT } from '../core/sim/money';
import { RIVALS, rivalStates, type RivalId } from '../core/sim/rivals';
import type { GameResult } from '../core/games/contracts';
import type { DiceBetKind } from '../core/games/dice-bets';
import type { ShellRound } from '../core/games/shell-round';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { CardDeal } from '../store/foreign-play';
import type { GameView } from '../store/types';
import { vc } from './format';
import { attractionBand, houseEdgeText } from './glossary';
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
  readonly onDealCard: (rivalId: RivalId, machineIndex: number, stakeVC: number, bps: number) => CardDeal | null;
  readonly onSettleCard: (rivalId: RivalId, machineIndex: number, stakeVC: number, netBps: number, label: string) => GameResult | null;
  readonly onExclusion: (command: 'START' | 'HONOR', limitVC?: number) => void;
}

const BET_STEPS = [1, 2, 5, 10] as const;

const personaLabel = (id: string): string =>
  id === 'HIGH_ROLLER' ? 'High Roller' : id === 'STAMMGAST' ? 'Stammgast'
    : id.charAt(0) + id.slice(1).toLowerCase();

export function GamesPopup({ view, onClose, onPlay, onRisk, onTakeHome, onExclusion, onShellRound, onDealCard, onSettleCard }: Props) {
  const states = rivalStates(view.tick);
  const [rivalId, setRivalId] = useState<RivalId>(RIVALS[0]!.id);
  const [machineIndex, setMachineIndex] = useState(0);
  const [betVC, setBetVC] = useState(RIVALS[0]!.machines[0]!.baseBet / 10_000);
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
    }, 520);
  };

  return (
    <PopupShell eyebrow="DU BIST GAST" title={rival.name} onClose={onClose} wide full={full}>
      <div className="foreign-top">
        <div className="house-tabs">
          {states.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`house-tab${entry.id === rivalId ? ' active' : ''}`}
              onClick={() => selectRival(entry.id)}
            >
              <strong>{entry.name}</strong>
              <span>Ruf {entry.reputation} % · Sicherheit {entry.security}/5 · ab {vc(entry.machines[0]!.baseBet, 2)}</span>
            </button>
          ))}
        </div>
        <div className="foreign-wallet" title="Dein privates Bargeld. Es gehört nicht dem Casino.">
          <span>PORTEMONNAIE</span>
          <strong>{vc(view.wallet, 2)}</strong>
          <button type="button" className="btn small" onClick={onTakeHome} disabled={view.house <= HOUSE_FLOAT} title="Holt bis zu 5 VC vom Hauskonto. 5 VC bleiben als Betriebsreserve.">ABHEBEN</button>
          <button type="button" className="btn small ghost" onClick={() => setFull((value) => !value)}>{full ? 'FENSTER' : 'VOLLBILD'}</button>
        </div>
      </div>

      <SelfExclusionPanel view={view} onExclusion={onExclusion} />

      <section className="rival-profile" aria-label={`Profil ${rival.name}`}>
        <div>
          <span className="eyebrow">BETREIBER</span>
          <strong>{rival.operator}</strong>
          <p>{rival.style}</p>
        </div>
        <dl>
          <div title="Wie angesehen das Haus ist. Hoher Ruf zieht bessere Gäste an."><dt>Ruf</dt><dd>{rival.reputation} %</dd></div>
          <div title="Security schlichtet Streit – hier zahlst du dafür, nicht der Betreiber."><dt>Sicherheit</dt><dd>{rival.security}/5</dd></div>
          <div title="Anteil jedes Einsatzes, der im Schnitt beim Betreiber bleibt."><dt>Hausvorteil</dt><dd>{(rival.edgeBps / 100).toFixed(2)} %</dd></div>
          <div title={`Rohwert ${rival.attractiveness}`}><dt>Anziehung</dt><dd>{attractionBand(rival.attractiveness)}</dd></div>
        </dl>
      </section>
      <p className="hint">
        {houseEdgeText(rival.edgeBps)} Er gehört dem Betreiber – dein Portemonnaie ist hier Gast.
        Dieses Haus zieht vor allem {rival.personas.map(personaLabel).join(', ')} an.
      </p>

      <div className="game-select">
        {rival.machines.map((entry, index) => (
          <button
            key={`${entry.game}-${index}`}
            type="button"
            className={`game-tab${machineIndex === index ? ' active' : ''}`}
            onClick={() => selectMachine(index)}
            title="Gerät wählen. Der Mindesteinsatz steht in der zweiten Zeile."
          >
            <b>{entry.label.slice(0, 1)}</b>
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
          onDeal={(stakeVC, bps) => onDealCard(rivalId, machineIndex, stakeVC, bps)}
          onSettle={(stakeVC, netBps, label) => onSettleCard(rivalId, machineIndex, stakeVC, netBps, label)}
        />
      ) : (
      <div className={`table-stage${full ? ' full' : ''}`}>
        <div className={`game-screen${spinning ? ' spinning' : ''}`}>
          <div className="screen-title">{machine.label}</div>
          <div className="screen-result">
            {result ? result.detail.slice(0, 5).map((part, index) => <span key={index} className="screen-symbol">{part}</span>)
              : <span className="screen-symbol muted">BEREIT</span>}
          </div>
          <div className={`screen-label${result && result.payout > 0 ? ' win' : ''}`}>
            {spinning ? 'Das Rad dreht…' : result ? `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ''}` : 'Setze einen Einsatz und drücke SPIELEN.'}
          </div>
        </div>
        <div className="table-controls">
          <div className="bet-row">
            {bets.map((value) => (
              <button key={value} type="button" className={`chip${betVC === value ? ' active' : ''}`} onClick={() => setBetVC(value)}>{value} VC</button>
            ))}
          </div>
          <button type="button" className="btn primary big" disabled={spinning || cannotPay} onClick={play}>
            {cannotPay ? 'ZU WENIG BARGELD' : spinning ? 'SPIELT…' : `SPIELEN · ${betVC} VC`}
          </button>
          <small>
            Gewinne gehen zurück ins Portemonnaie, Verluste bleiben im fremden Haus.
            {cannotPay ? ' Hebe am Hauskonto ab, um weiterzuspielen.' : ` Mindesteinsatz ${vc(machine.baseBet, 2)}.`}
          </small>
        </div>
      </div>
      )}
    </PopupShell>
  );
}
