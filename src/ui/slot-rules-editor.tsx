/** Regel-Editor am Automaten: Gewichte, Auszahlungsprofil und Regeln mit den echten Chancen. */
import { useEffect, useState } from 'react';
import {
  DEFAULT_SLOT_PROFILE, MAX_PAY_SCALE_BPS, MIN_PAY_SCALE_BPS, normalizeSlotProfile, sameSlotProfile,
  slotChances, type SlotProfile,
} from '../core/games/slot-profile';
import { SLOT_SYMBOLS, type SlotSymbol } from '../core/games/engines/slot-paytable';
import type { Furniture } from '../core/sim/types';

interface Props {
  readonly item: Furniture;
  readonly onApply: (profile: SlotProfile) => void;
}

const symbolName = (symbol: SlotSymbol): string => (symbol === 'BOOK' ? 'Buch' : symbol);

export function SlotRulesEditor({ item, onApply }: Props) {
  const [draft, setDraft] = useState<SlotProfile>(() => normalizeSlotProfile(item.slotOdds));
  useEffect(() => { setDraft(normalizeSlotProfile(item.slotOdds)); }, [item.slotOdds, item.id]);
  const chances = slotChances(item.reels, draft);
  const dirty = !sameSlotProfile(draft, normalizeSlotProfile(item.slotOdds));
  const total = SLOT_SYMBOLS.reduce((sum, symbol) => sum + draft.weights[symbol], 0);

  const setWeight = (symbol: SlotSymbol, value: string): void => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft((current) => normalizeSlotProfile({
      ...current,
      weights: { ...current.weights, [symbol]: Math.max(0, Math.min(99, Math.round(parsed))) },
    }));
  };
  const setScale = (value: string): void => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft((current) => normalizeSlotProfile({ ...current, payScaleBps: Math.round(parsed * 100) }));
  };
  const setRule = (key: 'freeSpins' | 'wildBooks', value: boolean): void => {
    setDraft((current) => normalizeSlotProfile({ ...current, rules: { ...current.rules, [key]: value } }));
  };

  return (
    <section className="slot-rules">
      <div className="plinko-head">
        <div>
          <span className="eyebrow">REGEL-EDITOR</span>
          <strong>Quote {formatBps(chances.rtpBps)} · Linientreffer {formatBps(chances.lineHitBps)}</strong>
        </div>
        <span className="hint">Gewichte {total} gesamt</span>
      </div>

      <div className="slot-weights">
        {SLOT_SYMBOLS.map((symbol) => (
          <label key={symbol} className="plinko-field">
            <span>{symbolName(symbol)}</span>
            <input
              type="number" min="0" max="99" step="1" value={draft.weights[symbol]}
              aria-label={`Gewicht ${symbolName(symbol)}`}
              onChange={(event) => setWeight(symbol, event.target.value)}
            />
            <small>{formatBps(chances.perSymbolBps[symbol])}</small>
          </label>
        ))}
      </div>

      <div className="plinko-grid">
        <label className="plinko-field">
          <span>AUSZAHLUNGSPROFIL · {formatBps(draft.payScaleBps)}</span>
          <input
            type="range" min={MIN_PAY_SCALE_BPS / 100} max={MAX_PAY_SCALE_BPS / 100} step="0.5"
            value={draft.payScaleBps / 100}
            aria-label="Auszahlungsprofil"
            onChange={(event) => setScale(event.target.value)}
          />
          <small>Wirkt direkt auf die Quote: {formatBps(chances.rtpBps)} bei {item.reels} Walzen.</small>
        </label>
        <label className="plinko-field">
          <span>REGELN</span>
          <label className="inline-check">
            <input type="checkbox" checked={draft.rules.freeSpins} onChange={(event) => setRule('freeSpins', event.target.checked)} />
            Freispiele aus Büchern
          </label>
          <label className="inline-check">
            <input type="checkbox" checked={draft.rules.wildBooks} onChange={(event) => setRule('wildBooks', event.target.checked)} />
            Buch zählt als Wild
          </label>
        </label>
      </div>

      <p className="hint">
        Erwartung: {chances.linesPerSpin} bezahlte Linien je Spin ·
        {' '}{chances.jackpotSpins > 0 ? `Freispiele alle ${Math.max(1, Math.round(1 / Math.max(chances.freeRounds, 0.000001)))} Spins, Jackpot alle ${chances.jackpotSpins}` : 'keine Freispiele'}. Alle Werte rechnet die Engine,
        nicht die Anzeige.
      </p>

      <div className="plinko-actions">
        <button type="button" className="btn primary" disabled={!dirty} onClick={() => onApply(draft)}>
          {dirty ? 'REGELN ÜBERNEHMEN' : 'UNVERÄNDERT'}
        </button>
        <button type="button" className="btn ghost" disabled={sameSlotProfile(draft, DEFAULT_SLOT_PROFILE)} onClick={() => setDraft(DEFAULT_SLOT_PROFILE)}>
          STANDARD
        </button>
        <small>Gilt ab dem nächsten Spin. Der Testspin zeigt die neuen Chancen sofort.</small>
      </div>
    </section>
  );
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace('.', ',')} %`;
}
