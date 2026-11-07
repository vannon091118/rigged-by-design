/**
 * @test-target: scripts/lib/staging-scope.mjs
 * @error-code: ERR-4019
 *
 * Fremde Arbeit darf nie automatisch gestaged werden. Diese Grenzen stehen
 * hier: eigener Pfad, fremder Pfad, Ausnahme fuer die Turn-Arbeitsdatei,
 * Verzeichnis- und rekursive Allowlist sowie die Trennung von erlaubt/fremd.
 */
import { describe, expect, it } from 'vitest';
import { TURN_EXEMPT, scopeChanges } from '../../../../scripts/lib/staging-scope.mjs';

const allowlist = ['scripts/turn-push.mjs', 'docs/', 'src/core/**'];

describe('staging-scope', () => {
  it('laesst einen Pfad im eigenen Claim zu', () => {
    expect(scopeChanges({ changed: ['scripts/turn-push.mjs'], allowlist })).toEqual({
      allowed: ['scripts/turn-push.mjs'],
      foreign: [],
      ok: true,
    });
  });

  it('meldet fremde Arbeit statt sie zu stagen', () => {
    const scope = scopeChanges({ changed: ['scripts/turn-push.mjs', 'src/ui/hud.tsx'], allowlist });
    expect({ ok: scope.ok, foreign: scope.foreign, allowed: scope.allowed }).toEqual({
      ok: false,
      foreign: ['src/ui/hud.tsx'],
      allowed: ['scripts/turn-push.mjs'],
    });
  });

  it('nimmt die Turn-Arbeitsdatei von der Sperre aus', () => {
    const scope = scopeChanges({ changed: ['.turn-notes.md', 'docs/CHANGELOG.md'], allowlist });
    expect({ ok: scope.ok, allowed: scope.allowed, exempt: TURN_EXEMPT.includes('.turn-notes.md') })
      .toEqual({ ok: true, allowed: ['docs/CHANGELOG.md'], exempt: true });
  });

  it('behandelt Verzeichnis- und rekursive Muster wie der Claim', () => {
    const scope = scopeChanges({ changed: ['docs/a/b.md', 'src/core/economy/ledger.ts', 'src/ui/x.ts'], allowlist });
    expect(scope).toEqual({
      allowed: ['docs/a/b.md', 'src/core/economy/ledger.ts'],
      foreign: ['src/ui/x.ts'],
      ok: false,
    });
  });
});
