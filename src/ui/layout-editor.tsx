/**
 * Entwicklungs-Editor fuer das Raumlayout. Nur erreichbar, wenn der Build
 * `VITE_RBD_EDITOR_MODE=1` traegt und die URL `?editor=1` setzt; die eigentliche
 * Freigabe prueft `editor-gate.ts`, der Produktionsausschluss liegt im Import.
 */
import { useEffect, useRef, useState } from 'react';
import { FLOOR_MATERIALS, type EdgeAxis, type FloorMaterialId } from '../core/sim/layout-types';
import type { EditorCursor } from '../render/editor-overlay';
import { useWorldStore, worldStore } from '../store/use-world-store';
import { EDITOR_TOOLS, editorCommand, editorShortcut, type EditorCell, type EditorTool } from './editor-tools';
import { useLayoutTransfer } from './layout-editor-transfer';
import { LayoutRoomSummary } from './layout-room-summary';
import '../styles/layout-editor.css';

interface Props {
  readonly cellAt: (clientX: number, clientY: number) => EditorCell | null;
  readonly onCursor: (cursor: EditorCursor | null) => void;
  readonly onClose: () => void;
}

const MATERIAL_LABELS: Record<FloorMaterialId, string> = {
  CONCRETE: 'Beton', STONE: 'Stein', LINOLEUM: 'Linoleum', CARPET: 'Teppich', WOOD: 'Holz', TILE: 'Fliese',
};

const labelFor = (tool: EditorTool): string => EDITOR_TOOLS.find((entry) => entry.id === tool)?.label ?? tool;

export default function LayoutEditor({ cellAt, onCursor, onClose }: Props) {
  const view = useWorldStore();
  const transfer = useLayoutTransfer();
  const [tool, setTool] = useState<EditorTool>('FLOOR');
  const [material, setMaterial] = useState<FloorMaterialId>('WOOD');
  const [axis, setAxis] = useState<EdgeAxis>('H');
  const painting = useRef(false);
  const lastCell = useRef('');
  const cursorSink = useRef(onCursor);
  const closeSink = useRef(onClose);
  cursorSink.current = onCursor;
  closeSink.current = onClose;

  const cursorFor = (cell: EditorCell): EditorCursor => ({
    x: cell.x, y: cell.y, axis, mode: tool === 'FLOOR' ? 'FLOOR' : 'EDGE',
  });

  const paint = (cell: EditorCell): void => {
    const key = `${tool}:${axis}:${cell.x}:${cell.y}`;
    if (lastCell.current === key) return;
    lastCell.current = key;
    worldStore.paintLayout(editorCommand(tool, cell, material, axis));
  };

  const move = (clientX: number, clientY: number): EditorCell | null => {
    const cell = cellAt(clientX, clientY);
    cursorSink.current(cell ? cursorFor(cell) : null);
    return cell;
  };

  const begin = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const cell = move(event.clientX, event.clientY);
    if (!cell) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    painting.current = true;
    lastCell.current = '';
    worldStore.beginLayoutStroke(tool === 'FLOOR' ? `Boden ${MATERIAL_LABELS[material]}` : `Kante ${labelFor(tool)}`);
    paint(cell);
  };

  const end = (): void => {
    if (!painting.current) return;
    painting.current = false;
    lastCell.current = '';
    worldStore.endLayoutStroke();
  };

  // Beim Schliessen bleibt kein offener Strich und keine Auswahl in Pixi stehen.
  useEffect(() => () => {
    worldStore.endLayoutStroke();
    cursorSink.current(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSink.current();
        return;
      }
      const action = editorShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === 'undo') worldStore.undoLayout();
      else worldStore.redoLayout();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div
        className="layout-editor-shade"
        onPointerDown={begin}
        onPointerMove={(event) => { const cell = move(event.clientX, event.clientY); if (painting.current && cell) paint(cell); }}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => { end(); cursorSink.current(null); }}
      />
      <aside className="layout-editor" role="dialog" aria-label="Layout-Editor">
        <header className="layout-editor-head">
          <div><strong>Layout-Editor</strong><small>Raster {view.layout.size} × {view.layout.size}</small></div>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Editor schließen">×</button>
        </header>

        <LayoutRoomSummary layout={view.layout} />

        <div className="layout-editor-row" role="group" aria-label="Werkzeug">
          {EDITOR_TOOLS.map((entry) => (
            <button key={entry.id} type="button" className={`btn small${tool === entry.id ? ' primary' : ''}`}
              onClick={() => { setTool(entry.id); lastCell.current = ''; }}>
              {entry.label}
            </button>
          ))}
        </div>

        {tool === 'FLOOR' ? (
          <label className="layout-editor-field">
            <span>Bodenmaterial</span>
            <select value={material} onChange={(event) => { setMaterial(event.target.value as FloorMaterialId); lastCell.current = ''; }}>
              {FLOOR_MATERIALS.map((id) => <option key={id} value={id}>{MATERIAL_LABELS[id]}</option>)}
            </select>
          </label>
        ) : (
          <div className="layout-editor-row" role="group" aria-label="Kantenachse">
            <button type="button" className={`btn small${axis === 'H' ? ' primary' : ''}`} onClick={() => setAxis('H')}>Kante oben</button>
            <button type="button" className={`btn small${axis === 'V' ? ' primary' : ''}`} onClick={() => setAxis('V')}>Kante links</button>
          </div>
        )}

        <div className="layout-editor-row">
          <button type="button" className="btn small" disabled={!worldStore.canUndoLayout()} onClick={() => worldStore.undoLayout()}>↶ Undo</button>
          <button type="button" className="btn small" disabled={!worldStore.canRedoLayout()} onClick={() => worldStore.redoLayout()}>↷ Redo</button>
          <button type="button" className="btn small ghost" onClick={transfer.download}>Export</button>
          <button type="button" className="btn small ghost" onClick={transfer.openFile}>Import</button>
          <input ref={transfer.fileInput} type="file" accept="application/json,.json" hidden onChange={transfer.loadFile} />
        </div>

        <p className="panel-note">Ziehen malt einen Strich. Ctrl+Z / Ctrl+Y (⌘ auf dem Mac), Esc schließt. Import ist fail-closed.</p>
        {transfer.issue && <p className="layout-editor-issue" role="alert">{transfer.issue}</p>}
      </aside>
    </>
  );
}
