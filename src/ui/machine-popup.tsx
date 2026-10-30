/** Automaten-Popup: Zustand, Mods, Walzen und ein kostenloser Testspin. */
import { useState } from 'react';
import type { GameResult } from '../core/games/contracts';
import type { GateResult } from '../core/games/plinko-sandbox';
import type { PlinkoConfig, PlinkoMode } from '../core/games/plinko-config';
import { MODS, attractionValue, getMod } from '../core/sim/offers';
import type { Furniture, ModId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { vc } from './format';
import { PlinkoEditor } from './plinko-editor';
import { PopupShell } from './popup-shell';

interface Props {
  readonly item: Furniture;
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onTest: () => GameResult | null;
  readonly onRepair: () => void;
  readonly onMod: (id: ModId) => void;
  readonly onAddReel: () => void;
  readonly onBet: (vcValue: number) => void;
  readonly onTakeDrink: () => void;
  readonly onDeployPlinko: (config: PlinkoConfig) => GateResult;
  readonly onPlinkoMode: (mode: PlinkoMode) => void;
}

const GAME_LABEL: Record<string, string> = {
  SLOT: 'Slot', BLACKJACK: 'Blackjack', POKER: 'Poker', ROULETTE: 'Roulette',
  PLINKO: 'Plinko', SHELL: 'Hütchen', DICE: 'Würfel',
};

export function MachinePopup({ item, view, onClose, onTest, onRepair, onMod, onAddReel, onBet, onTakeDrink, onDeployPlinko, onPlinkoMode }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [full, setFull] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const isGame = Boolean(item.gameId);
  const spin = (): void => {
    if (spinning || !isGame) return;
    setSpinning(true);
    window.setTimeout(() => { setResult(onTest()); setSpinning(false); }, 480);
  };
  return (
    <PopupShell eyebrow={isGame ? GAME_LABEL[item.gameId ?? ''] ?? 'SPIEL' : 'AUSSTATTUNG'} title={item.label} onClose={onClose} wide full={full}>
      {isGame ? (
        <>
          <div className="machine-stats">
            <Stat label="ZUSTAND" value={item.damaged ? 'DEFEKT' : `${Math.round(item.condition)}%`} bad={item.damaged || item.condition < 45} />
            <Stat label="PLÄTZE" value={`${item.occupants.length}/${item.seats}`} />
            <Stat label="ANZIEHUNG" value={`${Math.round(attractionValue(item))}`} />
            <Stat label="MINDESTEINSATZ" value={vc(item.baseBet, 2)} />
            {item.kind === 'BAR' && (
              <Stat label="BESTAND" value={`${item.stock}/${6 + 6 * view.barLevel}`} bad={item.stock === 0} />
            )}
          </div>
          {item.gameId === 'PLINKO' && (
            <PlinkoEditor view={view} result={result} spinning={spinning} onSpin={spin} onDeploy={onDeployPlinko} onMode={onPlinkoMode} />
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
              <small>Kein echtes Geld. Nur zum Schauen, ob der Automat noch Spaß macht.</small>
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
              title={view.parts <= 0 ? 'Keine Ersatzteile im Lager' : view.house < view.prices.repairCost ? 'Hauskonto zu niedrig' : 'Reparatur buchen'}
            >REPARIEREN · {vc(view.prices.repairCost, 0)}</button>
            <button type="button" className="btn ghost" onClick={() => setFull((value) => !value)}>{full ? 'FENSTER' : 'VOLLBILD'}</button>
            {item.kind === 'SLOT' && (
              <button type="button" className="btn" onClick={onAddReel} disabled={item.reels >= 5 || view.house < (4 + item.reels * 2) * 10_000}>
                WALZE ERWEITERN ({item.reels}/5)
              </button>
            )}
          </div>
          <label className="inline-field">
            <span>MINDESTEINSATZ</span>
            <input type="number" min="0" step="0.05" defaultValue={(item.baseBet / 10_000).toFixed(2)}
              onBlur={(event) => onBet(Number(event.target.value))} />
          </label>
        </>
      ) : (
        <div className="decor-info">
          <p>{item.kind === 'DECOR' ? 'Deko macht den Raum einladender. Gäste bleiben lieber.' : 'Servicepunkt für Gäste. Hält den Laden am Laufen.'}</p>
          <div className="machine-stats">
            <Stat label="ZUSTAND" value={item.damaged ? 'DEFEKT' : `${Math.round(item.condition)}%`} bad={item.damaged || item.condition < 45} />
            <Stat label="PLÄTZE" value={`${item.occupants.length}/${item.seats}`} />
          </div>
          <button
            type="button"
            className="btn"
            onClick={onRepair}
            disabled={(item.condition >= 100 && !item.damaged) || view.house < view.prices.repairCost || view.parts <= 0}
            title={view.parts <= 0 ? 'Keine Ersatzteile im Lager' : view.house < view.prices.repairCost ? 'Hauskonto zu niedrig' : 'Reparatur buchen'}
          >REPARIEREN · {vc(view.prices.repairCost, 0)}</button>
          {item.kind === 'BAR' && <button type="button" className="btn primary" onClick={onTakeDrink}>DRINK ZAPFEN</button>}
        </div>
      )}

      {isGame && (
        <>
          <h3>Mods</h3>
          <p className="hint">Mods ziehen Gäste an und verändern Laune, Geduld oder Sucht. Drei passen auf einen Automaten.</p>
          <div className="mod-grid">
            {MODS.filter((mod) => mod.id !== 'EXTRA_REEL' || item.kind === 'SLOT').map((mod) => {
              const installed = item.mods.includes(mod.id);
              const blocked = installed || item.mods.length >= 3 || view.house < mod.cost;
              return (
                <button key={mod.id} type="button" className={`mod-card${installed ? ' installed' : ''}`}
                  disabled={blocked} onClick={() => onMod(mod.id)}>
                  <strong>{mod.name}</strong>
                  <span>{mod.description}</span>
                  <b>{installed ? 'VERBAUT' : vc(mod.cost, 0)}</b>
                  <small>+{mod.attraction} Anziehung · {mod.patience >= 0 ? '+' : ''}{mod.patience} Geduld · +{mod.addiction} Sucht</small>
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

function Stat({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return <div className={`machine-stat${bad ? ' bad' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}
