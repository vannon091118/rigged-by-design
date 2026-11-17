/** @test-target: scripts/lib/narrative-blocks.mjs | @error-code: ERR-4022 */
import { describe, expect, it } from 'vitest';
import { isMaintenanceOnly } from '../../../../scripts/lib/narrative-blocks.mjs';

describe('narrative-blocks: Pflegegrenze', () => {
  it('nimmt Kontrollebene und die Governance-Testbruecke als Pflege', () => {
    expect(isMaintenanceOnly([
      'docs/WORKFLOW.md',
      '.claude/settings.json',
      '.githooks/pre-commit',
      'scripts/lib/narrative-blocks.mjs',
      'src/core/governance/__tests__/doc-core.test.ts',
      'src/store/__tests__/command-atomicity.test.ts',
      'package.json',
    ])).toBe(true);
  });

  it('laesst Spielcode, Content und UI nie als Pflege durch', () => {
    expect(isMaintenanceOnly(['src/game/state.ts'])).toBe(false);
    expect(isMaintenanceOnly(['content/narrative/contributions/a.json'])).toBe(false);
    expect(isMaintenanceOnly(['public/index.html'])).toBe(false);
    expect(isMaintenanceOnly(['docs/WORKFLOW.md', 'src/game/state.ts'])).toBe(false);
  });
});
