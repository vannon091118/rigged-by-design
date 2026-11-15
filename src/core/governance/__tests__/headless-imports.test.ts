/**
 * @test-target: scripts/lib/headless-core.mjs
 * @error-code: ERR-4019
 *
 * Der Core bleibt headless: keine Pixi-/React-/DOM-Pakete und keine
 * relativen Importe in UI, Renderer oder Store. Der Scanner ist rein und
 * laeuft als eigenes Gate; dieser Test belegt die Regeln und den Ist-Baum.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifySpecifier, scanHeadlessCore } from '../../../../scripts/lib/headless-core.mjs';

const root = process.cwd();
const coreDir = resolve(root, 'src', 'core');
const fromCore = resolve(coreDir, 'sim', 'example.ts');

describe('Headless-Core-Importgrenze', () => {
  it('findet im echten src/core keine Grenzverletzung', () => {
    const result = scanHeadlessCore(root);
    expect(result.files).toBeGreaterThan(500);
    expect(result.violations).toEqual([]);
  });

  it('blockiert Pixi, React, DOM und Vite', () => {
    for (const specifier of ['pixi.js', 'react', 'react-dom', '@testing-library/react', 'jsdom', 'vite', '@vitejs/plugin-react']) {
      expect(classifySpecifier(specifier, fromCore, coreDir)).toContain('nicht erlaubt');
    }
  });

  it('blockiert relative Importe in Renderer, UI und Store', () => {
    for (const specifier of ['../../render/floor-stage', '../../ui/app-wiring', '../../store/world-store', '../../../src/render/floor-stage']) {
      expect(classifySpecifier(specifier, fromCore, coreDir)).toContain('verlaesst src/core');
    }
  });

  it('erlaubt Core-interne, node:- und Test-Support-Importe', () => {
    expect(classifySpecifier('../rng/prng', fromCore, coreDir)).toBeNull();
    expect(classifySpecifier('./types', fromCore, coreDir)).toBeNull();
    expect(classifySpecifier('node:fs', fromCore, coreDir)).toBeNull();
    expect(classifySpecifier('vitest', fromCore, coreDir)).toBeNull();
    expect(classifySpecifier('../../test/random-seed', resolve(coreDir, 'sim', '__tests__', 'example.test.ts'), coreDir)).toBeNull();
  });

  it('blockiert Test-Support nicht als Produktionspfad', () => {
    expect(classifySpecifier('../../test/random-seed', fromCore, coreDir)).toContain('verlaesst src/core');
  });
});
