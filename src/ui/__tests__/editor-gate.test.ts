/**
 * @test-target: src/ui/editor-gate.ts
 * @error-code: ERR-3001
 *
 * Editor-Freigabe: der Query-Parameter allein oeffnet nie einen Produktionsbuild.
 */
import { describe, expect, it } from 'vitest';
import { editorEnabled } from '../editor-gate';

describe('Editor-Freigabe', () => {
  it('oeffnet nur mit Build-Flag und Query-Parameter', () => {
    expect(editorEnabled('?editor=1', '1')).toBe(true);
    expect(editorEnabled('?foo=2&editor=1', '1')).toBe(true);
  });

  it('ignoriert den Query-Parameter ohne Build-Flag', () => {
    expect(editorEnabled('?editor=1', undefined)).toBe(false);
    expect(editorEnabled('?editor=1', '0')).toBe(false);
    expect(editorEnabled('?editor=1', 'true')).toBe(false);
  });

  it('oeffnet nicht ohne Query-Parameter', () => {
    expect(editorEnabled('', '1')).toBe(false);
    expect(editorEnabled('?editor=0', '1')).toBe(false);
    expect(editorEnabled('?editor', '1')).toBe(false);
  });
});
