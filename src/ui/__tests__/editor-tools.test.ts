/**
 * @test-target: src/ui/editor-tools.ts
 * @error-code: ERR-3001
 *
 * Editor-Werkzeuge: Command-Absicht und Tastaturkuerzel sind rein und testbar;
 * die Gueltigkeit der Kante entscheidet weiterhin der typisierte Command.
 */
import { describe, expect, it } from 'vitest';
import { EDITOR_TOOLS, editorCommand, editorShortcut } from '../editor-tools';

describe('Editor-Werkzeuge', () => {
  it('baut fuer den Boden ein einzelnes Tile mit dem gewaehlten Material', () => {
    expect(editorCommand('FLOOR', { x: 4, y: 7 }, 'WOOD', 'H')).toEqual({
      kind: 'FLOOR', rect: { x: 4, y: 7, w: 1, h: 1 }, material: 'WOOD',
    });
  });

  it('baut fuer Kanten genau eine Zelle auf der gewaehlten Achse', () => {
    expect(editorCommand('DOOR', { x: 3, y: 8 }, 'WOOD', 'V')).toEqual({
      kind: 'EDGES', cells: [{ axis: 'V', x: 3, y: 8 }], edge: 'DOOR',
    });
    expect(editorCommand('NONE', { x: 1, y: 2 }, 'WOOD', 'H')).toEqual({
      kind: 'EDGES', cells: [{ axis: 'H', x: 1, y: 2 }], edge: 'NONE',
    });
  });

  it('kennt alle fuenf Werkzeuge in fester Reihenfolge', () => {
    expect(EDITOR_TOOLS.map((entry) => entry.id)).toEqual(['FLOOR', 'WALL', 'DOOR', 'OPENING', 'NONE']);
  });

  it('erkennt Undo und Redo plattformuebergreifend', () => {
    const base = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
    expect(editorShortcut({ ...base, key: 'z', ctrlKey: true })).toBe('undo');
    expect(editorShortcut({ ...base, key: 'Z', metaKey: true })).toBe('undo');
    expect(editorShortcut({ ...base, key: 'y', ctrlKey: true })).toBe('redo');
    expect(editorShortcut({ ...base, key: 'z', metaKey: true, shiftKey: true })).toBe('redo');
  });

  it('ignoriert Kuerzel ohne Modifier oder mit Alt', () => {
    const base = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
    expect(editorShortcut({ ...base, key: 'z' })).toBeNull();
    expect(editorShortcut({ ...base, key: 'z', ctrlKey: true, altKey: true })).toBeNull();
    expect(editorShortcut({ ...base, key: 'x', ctrlKey: true })).toBeNull();
  });
});
