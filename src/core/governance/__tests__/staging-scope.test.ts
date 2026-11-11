/**
 * @test-target: scripts/lib/staging-scope.mjs
 * @error-code: ERR-4019
 *
 * Fremde Arbeit darf nie automatisch gestaged werden. Diese Grenzen stehen
 * hier: eigener Pfad, fremder Pfad, Ausnahme fuer die Turn-Arbeitsdatei,
 * Verzeichnis- und rekursive Allowlist sowie explizite Pfade gegen den Claim.
 * Jeder Pfad traegt zusaetzlich seine Takeover-Klasse; fremd heisst adoptierbar.
 */
import { describe, expect, it } from 'vitest';
import { TURN_EXEMPT, explicitScope, scopeChanges } from '../../../../scripts/lib/staging-scope.mjs';

const allowlist = ['scripts/turn-push.mjs', 'docs/', 'src/core/**'];

const takeover = (compatible: number, incomplete: number, corrupted = 0) => ({
  total: compatible + incomplete + corrupted,
  adopted: compatible + incomplete + corrupted,
  blocked: corrupted,
  counts: { compatible, incomplete, corrupted },
  corrupted: [],
});

describe('staging-scope', () => {
  it('laesst einen Pfad im eigenen Claim zu', () => {
    expect(scopeChanges({ changed: ['scripts/turn-push.mjs'], allowlist })).toEqual({
      allowed: ['scripts/turn-push.mjs'],
      foreign: [],
      ok: true,
      takeover: takeover(1, 0),
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

  it('nimmt die mechanischen Version-Dateien von der Sperre aus', () => {
    const scope = scopeChanges({
      changed: ['package.json', 'pnpm-lock.yaml', 'docs/INVENTORY.md', 'src/ui/hud.tsx'],
      allowlist,
    });
    expect(scope).toEqual({ allowed: [], foreign: ['src/ui/hud.tsx'], ok: false, takeover: takeover(0, 1) });
    expect(TURN_EXEMPT).toContain('pnpm-lock.yaml');
  });

  it('behandelt Verzeichnis- und rekursive Muster wie der Claim', () => {
    const scope = scopeChanges({ changed: ['docs/a/b.md', 'src/core/economy/ledger.ts', 'src/ui/x.ts'], allowlist });
    expect(scope).toEqual({
      allowed: ['docs/a/b.md', 'src/core/economy/ledger.ts'],
      foreign: ['src/ui/x.ts'],
      ok: false,
      takeover: takeover(2, 1),
    });
  });
});

describe('staging-scope explizite Pfade', () => {
  it('akzeptiert nur Pfade aus dem Claim', () => {
    expect(explicitScope({ paths: ['docs/a.md', 'src/core/sim/tick.ts'], allowlist })).toEqual({
      allowed: ['docs/a.md', 'src/core/sim/tick.ts'],
      foreign: [],
      ok: true,
    });
  });

  it('bricht bei einem fremden expliziten Pfad ab', () => {
    const scope = explicitScope({ paths: ['docs/a.md', 'src/ui/hud.tsx'], allowlist });
    expect(scope.ok).toBe(false);
    expect(scope.foreign).toEqual(['src/ui/hud.tsx']);
    expect(scope.allowed).toEqual(['docs/a.md']);
  });

  it('weist absolute Pfade und Traversal ab', () => {
    const scope = explicitScope({ paths: ['/etc/passwd', '../outside.ts', 'C:/temp/x.ts'], allowlist });
    expect(scope.ok).toBe(false);
    expect(scope.foreign).toEqual(['/etc/passwd', '../outside.ts', 'C:/temp/x.ts']);
  });

  it('entfernt Duplikate und die Turn-Arbeitsdatei', () => {
    const scope = explicitScope({ paths: ['docs/a.md', 'docs/a.md', '.turn-notes.md'], allowlist });
    expect(scope).toEqual({ allowed: ['docs/a.md'], foreign: [], ok: true });
  });
});
