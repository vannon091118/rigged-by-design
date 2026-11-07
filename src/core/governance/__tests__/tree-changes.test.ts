/**
 * @test-target: scripts/lib/tree-changes.mjs
 * @error-code: ERR-0911
 *
 * Der Fix-Modus muss jede Aenderung nennen, auch Loeschungen. Ein stilles
 * Aufraeumen waere von einem gruenen Lauf nicht zu unterscheiden.
 */
import { describe, expect, it } from 'vitest';
import { describeChanges, diffTree, parsePorcelain } from '../../../../scripts/lib/tree-changes.mjs';

const BEFORE = [' M src/core/sim/actions.ts', '?? docs/new.md', ' D docs/old.png', 'M  package.json'].join('\n');
const AFTER = [' M src/core/sim/actions.ts', ' M docs/new.md', 'M  package.json', '?? scripts/lib/new.mjs', ' D docs/old.png', ' D docs/older.png'].join('\n');

describe('Arbeitsbaum-Aenderungen', () => {
  it('liest Status, Pfad und Umbenennungsziel aus git status', () => {
    const state = parsePorcelain(BEFORE);
    expect(state.get('src/core/sim/actions.ts')).toBe('M');
    expect(state.get('docs/new.md')).toBe('??');
    expect(parsePorcelain('R  alt.ts -> neu.ts').get('neu.ts')).toBe('R');
    expect(parsePorcelain('').size).toBe(0);
  });

  it('trennt Neuanlage, Aenderung und neue Loeschung', () => {
    expect(diffTree(BEFORE, AFTER)).toEqual({
      added: ['scripts/lib/new.mjs'],
      modified: ['docs/new.md'],
      deleted: ['docs/older.png'],
    });
  });

  it('bleibt bei identischem Baum leer und idempotent', () => {
    expect(diffTree(AFTER, AFTER)).toEqual({ added: [], modified: [], deleted: [] });
    expect(describeChanges(diffTree(AFTER, AFTER))).toEqual([]);
  });

  it('protokolliert jede Aenderung als eigene Zeile', () => {
    const lines = describeChanges(diffTree(BEFORE, AFTER));
    expect(lines.join('\n')).toMatch(/- geloescht: docs\/older\.png/);
    expect(lines).toHaveLength(3);
  });
});
