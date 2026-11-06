/**
 * Reine Werkzeuglogik des Layout-Editors: Sie uebersetzt die gewaehlte Absicht
 * in einen typisierten Command und erkennt die Tastaturkuerzel. Kein React,
 * kein Pixi, keine Welt; die Gueltigkeit entscheidet weiterhin der Command.
 */
import type { LayoutCommand } from '../core/sim/layout-commands';
import type { EdgeAxis, EdgeKind, FloorMaterialId } from '../core/sim/layout-types';

export type EditorTool = 'FLOOR' | EdgeKind | 'NONE';
type EditorAction = 'undo' | 'redo';

export interface EditorCell {
  readonly x: number;
  readonly y: number;
}

/** Die Reihenfolge ist die Bedienreihenfolge im Panel. */
export const EDITOR_TOOLS: readonly { readonly id: EditorTool; readonly label: string }[] = [
  { id: 'FLOOR', label: 'Boden' },
  { id: 'WALL', label: 'Wand' },
  { id: 'DOOR', label: 'Tür' },
  { id: 'OPENING', label: 'Durchgang' },
  { id: 'NONE', label: 'Entfernen' },
];

export function editorCommand(
  tool: EditorTool,
  cell: EditorCell,
  material: FloorMaterialId,
  axis: EdgeAxis,
): LayoutCommand {
  if (tool === 'FLOOR') {
    return { kind: 'FLOOR', rect: { x: cell.x, y: cell.y, w: 1, h: 1 }, material };
  }
  return { kind: 'EDGES', cells: [{ axis, x: cell.x, y: cell.y }], edge: tool };
}

interface EditorKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** Ctrl/Cmd+Z und Ctrl/Cmd+Y; Shift+Z ist das uebliche Redo auf dem Mac. */
export function editorShortcut(event: EditorKey): EditorAction | null {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}
