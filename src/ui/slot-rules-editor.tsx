/** Regel-Editor am Automaten: Streifen, Gewichte, Modell, Volatilität und Bonus-Paytable. */
import { useEffect, useState } from 'react';
import {
  DEFAULT_SLOT_PROFILE, MAX_BONUS_SCALE_BPS, MAX_PAY_SCALE_BPS, MIN_BONUS_SCALE_BPS, MIN_PAY_SCALE_BPS,
  normalizeSlotProfile, sameSlotProfile, slotChances, type PayModel, type SlotProfile,
  type Volatility,
} from '../core/games/slot-profile';
import { stripsFromWeights } from '../core/games/engines/slot-strips';
import { SLOT_SYMBOLS, type SlotSymbol } from '../core/games/engines/slot-paytable';
import type { Furniture } from '../core/sim/types';

interface Props {
  readonly item: Furniture;
  readonly onApply: (profile: SlotProfile) => void;
}

const MODEL_LABEL: Record<PayModel, string> = { LINES: 'LINIEN', WAYS: 'WAYS', CLUSTER: 'CLUSTER' };
const MODELS: readonly PayModel[] = ['LINES', 'WAYS', 'CLUSTER'];
const VOLATILITIES: readonly Volatility[] = ['LOW', 'MID', 'HIGH'];
const VOLATILITY_LABEL: Record<Volatility, string> = { LOW: 'FLACH', MID: 'MITTEL', HIGH: 'STEIL' };

const symbolName = (symbol: SlotSymbol): string => (symbol === 'BOOK' ? 'Buch' : symbol);

export function SlotRulesEditor({ item, onApply }: Props) {
  const [draft, setDraft] = useState<SlotProfile>(() => normalizeSlotProfile(item.slotOdds));
  useEffect(() => { setDraft(normalizeSlotProfile(item.slotOdds)); }, [item.slotOdds, item.id]);
  const chances = slotChances(item.reels, draft);
  const dirty = !sameSlotProfile(draft, normalizeSlotProfile(item.slotOdds));
  const total = SLOT_SYMBOLS.reduce((sum, symbol) => sum + draft.weights[symbol], 0);
  const strips = draft.reelStrips.length > 0;

  const patch = (next: Partial<SlotProfile>): void => setDraft(normalizeSlotProfile({ ...draft, ...next }));
  const setWeight = (symbol: SlotSymbol, value: string): void => {
    if (!Number.isFinite(Number(value))) return;
    patch({ weights: { ...draft.weights, [symbol]: Math.round(Number(value)) } });
  };
  const setRule = (key: 'scatter' | 'wildMode', value: boolean): void => {
    patch(key === 'scatter' ? { scatter: value } : { wildMode: value ? 'BOOK' : 'NONE' });
  };

  return (
    <section className="slot-rules">
      <div className="plinko-head">
        <div>
          <span className="eyebrow">REGEL-EDITOR</span>
          <strong>Quote {formatBps(chances.rtpBps)} · {strips ? `${draft.reelStrips.length} Streifen` : 'Gewichte'}</strong>
        </div>
        <span className="hint">{total} Gewicht gesamt</span>
      </div>

      <div className="slot-weights">
        {SLOT_SYMBOLS.map((symbol) => (
          <label key={symbol} className="plinko-field">
            <span>{symbolName(symbol)}</span>
            <input type="number" min="0" max="99" step="1" value={draft.weights[symbol]}
              aria-label={`Gewicht ${symbolName(symbol)}`}
              disabled={strips}
              onChange={(event) => setWeight(symbol, event.target.value)} />
            <small>{formatBps(chances.perSymbolBps[symbol])}</small>
          </label>
        ))}
      </div>

      <div className="plinko-actions">
        <button type="button" className="btn small ghost" disabled={strips}
          onClick={() => patch({ reelStrips: stripsFromWeights(draft.weights, item.reels) })}
          title="Friert die Gewichte als Walzenstreifen ein: ab dann zieht die Engine aus dem Streifen.">
          STREIFEN ERZEUGEN
        </button>
        <button type="button" className="btn small ghost" disabled={!strips}
          onClick={() => patch({ reelStrips: [] })}>STREIFEN LÖSCHEN</button>
      </div>

      <div className="plinko-grid">
        <label className="plinko-field"><span>BEWERTUNG</span>
          <div className="bet-row">
            {MODELS.map((model) => (
              <button key={model} type="button" className={`chip${draft.model === model ? ' active' : ''}`}
                onClick={() => patch({ model })}>{MODEL_LABEL[model]}</button>
            ))}
          </div>
        </label>
        <label className="plinko-field"><span>VOLATILITÄT</span>
          <div className="bet-row">
            {VOLATILITIES.map((volatility) => (
              <button key={volatility} type="button" className={`chip${draft.volatility === volatility ? ' active' : ''}`}
                onClick={() => patch({ volatility })}>{VOLATILITY_LABEL[volatility]}</button>
            ))}
          </div>
        </label>
        <label className="plinko-field"><span>REGELN</span>
          <label className="inline-check">
            <input type="checkbox" checked={draft.scatter} onChange={(event) => setRule('scatter', event.target.checked)} />
            Bücher lösen Bonus aus
          </label>
          <label className="inline-check">
            <input type="checkbox" checked={draft.wildMode === 'BOOK'} onChange={(event) => setRule('wildMode', event.target.checked)} />
            Buch zählt als Wild
          </label>
        </label>
        <label className="plinko-field"><span>BONUSRUNDEN · {draft.freeSpins}</span>
          <input type="range" min="0" max="20" step="1" value={draft.freeSpins}
            onChange={(event) => patch({ freeSpins: Number(event.target.value) })} /></label>
        <label className="plinko-field"><span>MULTIPLIKATOR · ×{draft.multiplier}</span>
          <input type="range" min="1" max="5" step="1" value={draft.multiplier}
            onChange={(event) => patch({ multiplier: Number(event.target.value) })} /></label>
        <label className="plinko-field">
          <span>BASIS-PAYTABLE · {formatBps(draft.payScaleBps)}</span>
          <input type="range" min={MIN_PAY_SCALE_BPS / 100} max={MAX_PAY_SCALE_BPS / 100} step="0.5"
            value={draft.payScaleBps / 100} onChange={(event) => patch({ payScaleBps: Number(event.target.value) * 100 })} />
        </label>
        <label className="plinko-field">
          <span>BONUS-PAYTABLE · {formatBps(draft.bonusPayScaleBps)}</span>
          <input type="range" min={MIN_BONUS_SCALE_BPS / 100} max={MAX_BONUS_SCALE_BPS / 100} step="0.5"
            value={draft.bonusPayScaleBps / 100} onChange={(event) => patch({ bonusPayScaleBps: Number(event.target.value) * 100 })} />
        </label>
      </div>

      <p className="hint">
        Quote {formatBps(chances.rtpBps)} · {chances.modelHint} · Bonus alle {chances.bonusEvery || '–'} Spins,
        {' '}{chances.freeRounds} Freizüge je Spin. Alle Werte rechnet die Engine, nicht die Anzeige.
      </p>

      <div className="plinko-actions">
        <button type="button" className="btn primary" disabled={!dirty} onClick={() => onApply(draft)}>
          {dirty ? 'REGELN ÜBERNEHMEN' : 'UNVERÄNDERT'}
        </button>
        <button type="button" className="btn ghost" disabled={sameSlotProfile(draft, DEFAULT_SLOT_PROFILE)}
          onClick={() => setDraft(DEFAULT_SLOT_PROFILE)}>STANDARD</button>
        <small>Gilt ab dem nächsten Spin. Der Testspin zeigt die neuen Chancen sofort.</small>
      </div>
    </section>
  );
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace('.', ',')} %`;
}
