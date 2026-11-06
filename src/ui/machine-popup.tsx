/** Automaten-Popup: Zustand, Mods, Walzen und ein kostenloser Testspin. */
import { useState } from 'react';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { GateResult } from '../core/games/plinko-sandbox';
import type { PlinkoConfig, PlinkoMode } from '../core/games/plinko-config';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { ShellRound } from '../core/games/shell-round';
import { MAX_REELS, reelUpgradeCost } from '../core/games/slot-config';
import { barCapacityForLevel } from '../core/sim/deliveries';
import { MODS, attractionValue, getMod, modAppliesTo } from '../core/sim/offers';
import type { Furniture, ModId } from '../core/sim/types';
import type { SlotProfile } from '../core/games/slot-profile';
import type { CardDeal } from '../store/foreign-play';
import type { GameView } from '../store/types';
import { vc } from './format';
import { attractionBand } from './glossary';
import { MachinePlayLazy } from './machine-play-lazy';
import { PlinkoEditorLazy } from './plinko-editor-lazy';
import { PopupShell } from './popup-shell';
import { SlotRulesEditor } from './slot-rules-editor';
import { SlotTelemetry } from './slot-telemetry';

interface Props {
  readonly item: Furniture;
  readonly view: GameView;
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

const GAME_LABEL: Record<string, string> = {
  SLOT: 'Slot', BLACKJACK: 'Blackjack', POKER: 'Poker', VIDEO_POKER: 'Video Poker', ROULETTE: 'Roulette',
  PLINKO: 'Plinko', SHELL: 'Hütchenspiel', DICE: 'Würfel',
};

export function MachinePopup({ item, view, onClose, onTest, onRepair, onMod, onAddReel, onBet, onSlotOdds, onTakeDrink, onDeployPlinko, onPlinkoMode, onWithdraw, onPlay, onDeal, onSettle, onAdditionalBet, onShellRound, onRisk }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [guest, setGuest] = useState(false);
  const [full, setFull] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const isGame = Boolean(item.gameId);
  const attraction = Math.round(attractionValue(item));
  const reelCost = reelUpgradeCost(item.reels);
  const spin = (): void => {
    if (spinning || !isGame) return;
    setSpinning(true);
    window.setTimeout(() => { setResult(onTest()); setSpinning(false); }, 480);
  };
  return (
    <PopupShell eyebrow={isGame ? GAME_LABEL[item.gameId ?? ''] ?? 'SPIEL' : 'DEKORATION'} title={item.label} onClose={onClose} wide full={full} game={item.gameId}>
      {isGame ? (
        <>
          <div className="row-actions" role="group" aria-label="Spielmodus">
            <button type="button" className={`btn${guest ? '' : ' primary'}`} onClick={() => setGuest(false)}>BETREIBER</button>
            <button type="button" className={`btn${guest ? ' primary' : ''}`} onClick={() => setGuest(true)} disabled={item.damaged} title={item.damaged ? 'Erst reparieren.' : 'Mit deinem PORTEMONNAIE spielen.'}>ALS GAST SPIELEN</button>
          </div>
          {guest ? (
            <MachinePlayLazy
              item={item}
              view={view}
              full={full}
              onToggleFull={() => setFull((value) => !value)}
              onWithdraw={onWithdraw}
              onPlay={onPlay}
              onDeal={onDeal}
              onSettle={onSettle}
              onAdditionalBet={onAdditionalBet}
              onShellRound={onShellRound}
              onRisk={onRisk}
            />
          ) : (
          <>
          <div className="machine-stats">
            <Stat label="ZUSTAND" value={item.damaged ? 'DEFEKT' : `${Math.round(item.condition)}%`} bad={item.damaged || item.condition < 45} hint="Unter 18 % setzt sich niemand mehr hin. Reparatur braucht 1 Ersatzteil." />
            <Stat label="PLÄTZE" value={`${item.occupants.length}/${item.seats}`} hint="Wie viele Gäste gleichzeitig spielen können." />
            <Stat label="ANZIEHUNG" value={attractionBand(attraction)} hint={`Rohwert ${attraction}. Höher zieht mehr neue Gäste an.`} />
            <Stat label="EINSATZ AB" value={vc(item.baseBet, 2)} hint="Gilt der höhere Wert aus Gerät und globalem Mindesteinsatz." />
            {item.kind === 'BAR' && (
              <Stat label="BESTAND" value={`${item.stock}/${barCapacityForLevel(view.barLevel)}`} bad={item.stock === 0} />
            )}
          </div>
          {item.gameId === 'SLOT' && <SlotTelemetry memory={item.slotMemory} />}
          {item.gameId === 'SLOT' && <SlotRulesEditor item={item} onApply={onSlotOdds} />}
          {item.gameId === 'PLINKO' && (
            <PlinkoEditorLazy view={view} result={result} spinning={spinning} onSpin={spin} onDeploy={onDeployPlinko} onMode={onPlinkoMode} />
          )}
          {item.gameId !== 'PLINKO' && (
          <div className="slot-stage">
            <div className={`reel-window${spinning ? ' spinning' : ''}`}>
              {(result?.detail ?? ['?', '?', '?']).slice(0, 5).map((symbol, index) => (
                <span key={index} className="reel-cell">{symbol}</span>
              ))}
            </div>
            <div className="spin-info">
              <strong className={result && result.multiplierBps > 0 ? 'win' : ''}>{result ? result.label : 'Testspin kostenlos'}</strong>
              <small>Kostet nichts und zahlt nichts aus. Du siehst nur, was ein Gast hier erleben würde.</small>
              <button type="button" className="btn primary" disabled={spinning} onClick={spin}>
                {spinning ? 'DREHT…' : 'TESTSPIN'}
              </button>
            </div>
          </div>
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn"
              onClick={onRepair}
              disabled={(item.condition >= 100 && !item.damaged) || view.house < view.prices.repairCost || view.parts <= 0}
              title={view.parts <= 0 ? 'Keine Ersatzteile im Lager' : view.house < view.prices.repairCost ? 'Hauskonto zu niedrig' : 'Reparatur buchen: 1 Ersatzteil'}
            >REPARIEREN · {vc(view.prices.repairCost, 0)}</button>
            <button type="button" className="btn ghost" onClick={() => setFull((value) => !value)}>{full ? 'FENSTER' : 'VOLLBILD'}</button>
            {item.gameId === 'SLOT' && (
              <button
                type="button"
                className="btn"
                onClick={onAddReel}
                disabled={item.reels >= MAX_REELS || view.house < reelCost}
                title={item.reels >= MAX_REELS ? `Maximal ${MAX_REELS} Walzen` : `Kostet ${vc(reelCost, 0)}. Mehr Walzen heißt mehr Gewinnlinien und Kombinationen bei gleicher Auszahlungsquote.`}
              >
                WALZE ERWEITERN ({item.reels}/{MAX_REELS} · {item.reels >= MAX_REELS ? 'MAX' : vc(reelCost, 0)})
              </button>
            )}
          </div>
          <label className="inline-field">
            <span>EINSATZ AM GERÄT (VC)</span>
            <input type="number" min="0" step="0.05" defaultValue={(item.baseBet / 10_000).toFixed(2)}
              title="Gilt nur, wenn dieser Wert über dem globalen Mindesteinsatz liegt."
              onBlur={(event) => onBet(Number(event.target.value))} />
          </label>
          </>
          )}
        </>
      ) : (
        <div className="decor-info">
          <p>{item.kind === 'DECOR' ? 'Deko macht den Raum einladender. Gäste bleiben lieber und der Ruf steigt.' : 'Servicepunkt für Gäste. Hält den Laden am Laufen.'}</p>
          <div className="machine-stats">
            <Stat label="ZUSTAND" value={item.damaged ? 'DEFEKT' : `${Math.round(item.condition)}%`} bad={item.damaged || item.condition < 45} />
            <Stat label="PLÄTZE" value={`${item.occupants.length}/${item.seats}`} />
          </div>
          <button
            type="button"
            className="btn"
            onClick={onRepair}
            disabled={(item.condition >= 100 && !item.damaged) || view.house < view.prices.repairCost || view.parts <= 0}
            title={view.parts <= 0 ? 'Keine Ersatzteile im Lager' : view.house < view.prices.repairCost ? 'Hauskonto zu niedrig' : 'Reparatur buchen: 1 Ersatzteil'}
          >REPARIEREN · {vc(view.prices.repairCost, 0)}</button>
          {item.kind === 'BAR' && <button type="button" className="btn primary" onClick={onTakeDrink} title="Nimmt einen Drink aus der Bar, um ihn einem Gast zu geben.">DRINK ZAPFEN</button>}
        </div>
      )}

      {isGame && (
        <>
          <h3>Mods</h3>
          <p className="hint">
            Mods ziehen Gäste an und verändern Laune, Geduld oder Sucht – gegen Betriebskosten. Drei passen auf ein Gerät.
            Werte wie <b>+260 Anziehung</b> sind Rohwerte: mehr ist besser.
          </p>
          <div className="mod-grid">
            {MODS.filter((mod) => modAppliesTo(mod.id, item.gameId)).map((mod) => {
              const installed = item.mods.includes(mod.id);
              const blocked = installed || item.mods.length >= 3 || view.house < mod.cost;
              return (
                <button key={mod.id} type="button" className={`mod-card${installed ? ' installed' : ''}`}
                  disabled={blocked} onClick={() => onMod(mod.id)}>
                  <strong>{mod.name}</strong>
                  <span>{mod.description}</span>
                  <b>{installed ? 'VERBAUT' : vc(mod.cost, 0)}</b>
                  <small>
                    +{mod.attraction} Anziehung · {mod.patience >= 0 ? '+' : ''}{mod.patience} Geduld · +{mod.addiction} Sucht
                    {mod.bonusBps > 0 ? ` · +${(mod.bonusBps / 100).toFixed(1)} % Auszahlung` : ''}
                  </small>
                </button>
              );
            })}
          </div>
          <p className="hint">Verbaute Mods: {item.mods.length ? item.mods.map((id) => getMod(id).name).join(' · ') : 'keine'}</p>
        </>
      )}
    </PopupShell>
  );
}

function Stat({ label, value, bad = false, hint }: { label: string; value: string; bad?: boolean; hint?: string }) {
  return <div className={`machine-stat${bad ? ' bad' : ''}`} title={hint}><span>{label}</span><strong>{value}</strong></div>;
}
