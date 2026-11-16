/**
 * @test-target: scripts/lib/import-boundary.mjs
 * @error-code: ERR-4019
 *
 * Die generierte Registry ist Implementierungsdetail des Composers. Nur
 * `composer/index.ts` darf sie importieren; Produktion, Tests und Fixtures
 * gehen ueber `NARRATIVE_FRAGMENTS`. Die Regel ist fail-closed.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditRegistryBoundary,
  registrySpecifiersIn,
  REGISTRY_SURFACE,
} from '../../../../scripts/lib/import-boundary.mjs';

const dirs: string[] = [];
const fixture = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-import-boundary-'));
  dirs.push(root);
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
};
const registry = 'export const NARRATIVE_REGISTRY = [];\n';
const composer = (from = './registry.generated'): string => `import { NARRATIVE_REGISTRY } from '${from}';\nexport const X = 1;\n`;

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('import-boundary', () => {
  it('laesst die Composer-Fassade als einzigen Leser zu', () => {
    const root = fixture({
      'src/core/sim/narrative/composer/registry.generated.ts': registry,
      [REGISTRY_SURFACE]: composer(),
      'src/core/sim/city-model.ts': "import { NARRATIVE_FRAGMENTS } from './narrative/composer/index';\n",
    });
    const result = auditRegistryBoundary({ root });
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('meldet einen direkten Import aus der Produktion', () => {
    const root = fixture({
      'src/core/sim/narrative/composer/registry.generated.ts': registry,
      [REGISTRY_SURFACE]: composer(),
      'src/core/sim/city-model.ts': composer('./narrative/composer/registry.generated'),
    });
    const result = auditRegistryBoundary({ root });
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { file: 'src/core/sim/city-model.ts', specifier: './narrative/composer/registry.generated' },
    ]);
  });

  it('meldet auch Tests und Fixtures, die die Registry direkt lesen', () => {
    const root = fixture({
      'src/core/sim/narrative/composer/registry.generated.ts': registry,
      [REGISTRY_SURFACE]: composer(),
      'src/core/sim/__tests__/guest-voice.test.ts': composer('../narrative/composer/registry.generated'),
    });
    const result = auditRegistryBoundary({ root });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.file).toBe('src/core/sim/__tests__/guest-voice.test.ts');
  });

  it('ignoriert andere Importe und fremde Registries', () => {
    const root = fixture({
      'src/core/sim/narrative/composer/registry.generated.ts': registry,
      [REGISTRY_SURFACE]: composer(),
      'src/core/sim/city-model.ts': "import { clamp } from './num';\nimport { NARRATIVE_REGISTRY } from './other/registry.generated';\n",
    });
    const result = auditRegistryBoundary({ root });
    // Der zweite Import zeigt auf eine andere Datei; er zaehlt nicht als Verstoss.
    expect(result.ok).toBe(true);
  });

  it('erkennt Importe unabhaengig von der Schreibweise des Specifiers', () => {
    expect(registrySpecifiersIn("import x from './registry.generated';"))
      .toEqual(['./registry.generated']);
    expect(registrySpecifiersIn("import x from './schema';")).toEqual([]);
  });

  it('bleibt ohne src/ leer statt zu werfen', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-import-boundary-empty-'));
    dirs.push(root);
    expect(auditRegistryBoundary({ root })).toEqual({ ok: true, violations: [], scanned: 0 });
  });
});
