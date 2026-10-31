/** Operator-Board-Editor: echte Konfiguration, ehrliches Gate, sichtbarer Fortschritt. */
import { useEffect, useRef, useState } from 'react';
import type { GameResult } from '../core/games/contracts';
import type { GateResult } from '../core/games/plinko-sandbox';
import {
  normalizePlinkoConfig, plinkoProgress, type PegKind, type PlinkoConfig, type PlinkoMode,
} from '../core/games/plinko-config';
import type { GameView } from '../store/types';
import { PlinkoStage, type PlinkoStageHandle } from '../render/games/plinko-stage';

interface Props {
  readonly view: GameView;
  readonly result: GameResult | null;
  readonly spinning: boolean;
  readonly onSpin: () => void;
  readonly onDeploy: (config: PlinkoConfig) => GateResult;
  readonly onMode: (mode: PlinkoMode) => void;
}

const PEG_KINDS: readonly PegKind[] = ['NORMAL_PEG', 'BOUNCY_PEG', 'STICKY_PEG', 'MAGNET_PEG', 'SPLIT_PEG'];
const PEG_LABEL: Record<PegKind, string> = {
  NORMAL_PEG: 'Normal', BOUNCY_PEG: 'Springend', STICKY_PEG: 'Klebrig', MAGNET_PEG: 'Magnet', SPLIT_PEG: 'Teilend',
};
const MODES: readonly PlinkoMode[] = ['SINGLE', 'TWIN', 'TRIPLE'];

function widthsFor(count: number, center: number): number[] {
  const weights = Array.from({ length: count }, (_, index) => index === Math.floor(count / 2) ? center : 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths: number[] = [];
  let used = 0;
  weights.forEach((weight, index) => {
    if (index === count - 1) widths.push(Number((100 - used).toFixed(2)));
    else {
      const width = Number((weight / total * 100).toFixed(2));
      widths.push(width);
      used += width;
    }
  });
  return widths;
}

export function PlinkoEditor({ view, result, spinning, onSpin, onDeploy, onMode }: Props) {
  const board = useRef<PlinkoStageHandle>(null);
  const [draft, setDraft] = useState<PlinkoConfig>(view.plinko);
  const [kind, setKind] = useState<PegKind>('BOUNCY_PEG');
  const [row, setRow] = useState(1);
  const [column, setColumn] = useState(4);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(view.plinko); setGate(null); }, [view.plinko]);
  // Der Editor zeigt dasselbe Pixi-Brett wie das Spiel, keinen zweiten Zeichenpfad.
  useEffect(() => {
    if (view.lastPlinko) board.current?.play(view.lastPlinko, () => {});
  }, [view.lastPlinko]);
  const progress = plinkoProgress(view.totalPlinkoDrops, view.addictionScore, view.plinko);
  const sum = draft.pocketWidths.reduce((total, width) => total + width, 0);
  const specials = draft.pegs.filter((peg) => peg.kind !== 'NORMAL_PEG').length;

  const setCount = (count: number): void => {
    if (!Number.isInteger(count) || count < 5 || count > 13) return;
    setDraft({ ...draft, pocketCount: count, pocketWidths: widthsFor(count, 1) });
    setGate(null);
  };
  const setWidth = (index: number, value: string): void => {
    const width = Number(value);
    if (!Number.isFinite(width) || width <= 0) return;
    setDraft({ ...draft, pocketWidths: draft.pocketWidths.map((entry, at) => at === index ? width : entry) });
    setGate(null);
  };
  const addPeg = (): void => {
    if (!Number.isInteger(row) || row < 0 || row > 11 || !Number.isInteger(column) || column < 0 || column > 7) {
      setError('Reihe 0–11 und Spalte 0–7 wählen.');
      return;
    }
    if (draft.pegs.some((peg) => peg.row === row && peg.column === column)) {
      setError('Auf diesem Feld sitzt schon ein Spezial-Peg.');
      return;
    }
    setDraft({ ...draft, pegs: [...draft.pegs, { row, column, kind }] });
    setError('');
    setGate(null);
  };
  const removePeg = (index: number): void => {
    setDraft({ ...draft, pegs: draft.pegs.filter((_, at) => at !== index) });
    setGate(null);
  };
  const preset = (center: number): void => {
    setDraft({ ...draft, pocketWidths: widthsFor(draft.pocketCount, center) });
    setGate(null);
  };
  const deploy = (): void => {
    try {
      const normalized = normalizePlinkoConfig(draft);
      const measured = onDeploy(normalized);
      setGate(measured);
      setError('');
      if (measured.ok) setDraft(normalized);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Board ist ungültig.');
      setGate(null);
    }
  };
  const ready = (mode: PlinkoMode): boolean => mode === 'SINGLE' || progress.rows >= (mode === 'TWIN' ? 9 : 12);

  return (
    <section className="plinko-editor">
      <div className="plinko-head">
        <div>
          <span className="eyebrow">OPERATOR-BOARD</span>
          <strong>Reihen {progress.rows}/12 · {view.totalPlinkoDrops} Würfe · Sucht {Math.round(view.addictionScore)}</strong>
        </div>
        <div className="plinko-modes" role="group" aria-label="Plinko-Modus">
          {MODES.map((mode) => (
            <button key={mode} type="button" className={`chip${view.plinkoMode === mode ? ' active' : ''}`}
              disabled={!ready(mode)} onClick={() => onMode(mode)} title={ready(mode) ? mode : `${mode} ist noch gesperrt`}>
              {mode}
            </button>
          ))}
        </div>
      </div>
      <PlinkoStage ref={board} config={view.plinko} rows={progress.rows} label="Plinko-Brett im Editor" />
      <div className="plinko-progress">
        <span>Reihe 8 ab 25 Würfen</span><span>Reihe 9 ab 75</span><span>Reihe 10 ab 200 + 3 Spezial-Pegs</span><span>Reihe 11 ab Sucht &gt; 40</span>
      </div>

      <div className="plinko-grid">
        <label className="plinko-field"><span>TASCHEN (5–13)</span>
          <input type="number" min="5" max="13" value={draft.pocketCount} onChange={(event) => setCount(Number(event.target.value))} />
        </label>
        <div className="plinko-field"><span>BREITEN · Summe {sum.toFixed(2)} %</span>
          <div className="plinko-widths">
            {draft.pocketWidths.map((width, index) => (
              <input key={index} aria-label={`Breite Tasche ${index + 1}`} type="number" min="0.1" step="0.1" value={width}
                onChange={(event) => setWidth(index, event.target.value)} />
            ))}
          </div>
        </div>
        <div className="plinko-presets">
          <button type="button" className="btn small ghost" onClick={() => preset(1)}>GLEICH</button>
          <button type="button" className="btn small ghost" onClick={() => preset(3)}>MITTE BREIT</button>
          <button type="button" className="btn small ghost" onClick={() => preset(0.4)}>MITTE SCHMAL</button>
        </div>

        <div className="plinko-peg-form">
          <label className="plinko-field"><span>SPEZIAL-PEG</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as PegKind)}>
              {PEG_KINDS.map((entry) => <option key={entry} value={entry}>{PEG_LABEL[entry]}</option>)}
            </select>
          </label>
          <label className="plinko-field"><span>REIHE</span>
            <input type="number" min="0" max="11" value={row} onChange={(event) => setRow(Number(event.target.value))} />
          </label>
          <label className="plinko-field"><span>SPALTE</span>
            <input type="number" min="0" max="7" value={column} onChange={(event) => setColumn(Number(event.target.value))} />
          </label>
          <button type="button" className="btn small" onClick={addPeg}>PEG SETZEN</button>
        </div>
        <div className="plinko-peg-list">
          <span>{specials} Spezial-Pegs installiert:</span>
          {draft.pegs.length === 0 ? <small>Noch keine. Normale Pegs bleiben überall stehen.</small> : draft.pegs.map((peg, index) => (
            <button key={`${peg.row}:${peg.column}:${index}`} type="button" className="plinko-peg" onClick={() => removePeg(index)}>
              {PEG_LABEL[peg.kind]} {peg.row + 1}/{peg.column + 1} ×
            </button>
          ))}
        </div>
      </div>

      <div className="plinko-actions">
        <button type="button" className="btn primary" onClick={deploy}>DEPLOYEN + RTP-GATE</button>
        <button type="button" className="btn" disabled={spinning} onClick={onSpin}>{spinning ? 'PHYSIK LÄUFT…' : 'TESTSPIN'}</button>
        <small>Gate blockiert unter 85 % oder über 96 % RTP.</small>
      </div>
      {gate && <p className={`hint ${gate.ok ? 'ok' : 'bad'}`}>{gate.reason}</p>}
      {error && <p className="hint bad">{error}</p>}
      <div className="plinko-result">
        <strong>{result ? result.label : 'Bereit für den nächsten Wurf.'}</strong>
        <small>{result ? result.detail.join(' · ') : 'Der Testspin kostet kein Geld.'}</small>
      </div>
    </section>
  );
}
