/**
 * @vitest-environment jsdom
 * @test-target: src/ui/workshop-parts.tsx | @error-code: ERR-3001
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FpsPanel } from '../workshop-parts';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const ROOT = resolve(process.cwd());
const ATLAS = ['atlas-0.webp', 'atlas-1.webp'].map((file) =>
  readFileSync(resolve(ROOT, 'public/assets/casino/atlas', file)),
);

describe('Phase 3: FPS-HUD', () => {
  it('zeigt 60 FPS mit Zielwert und Frame-Zeit', () => {
    render(<FpsPanel fps={60} />);

    expect(screen.getByText('60').textContent).toBe('60');
    expect(screen.getByText('16.7 ms').textContent).toBe('16.7 ms');
    expect(screen.getByText('60 fps').textContent).toBe('60 fps');
  });

  it('zeigt bei 30 FPS die Warnstufe und 33.3 ms', () => {
    render(<FpsPanel fps={30} />);

    expect(screen.getByText('30').textContent).toBe('30');
    expect(screen.getByText('33.3 ms').textContent).toBe('33.3 ms');
    expect(document.querySelector('.fps-value')?.className).toContain('warn');
  });

  it('zeigt ohne Messwert Platzhalter statt einer Null', () => {
    render(<FpsPanel fps={0} />);

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

describe('Phase 4: First-Frame-Budget', () => {
  it('hält beide Atlasseiten unter dem gemeinsamen 400-kB-Budget', () => {
    const total = ATLAS.reduce((sum, page) => sum + page.byteLength, 0);

    expect(ATLAS).toHaveLength(2);
    expect(Math.min(...ATLAS.map((page) => page.byteLength))).toBeGreaterThan(50_000);
    expect(total).toBeGreaterThan(300_000);
    expect(total).toBeLessThan(400_000);
  });

  it('führt den geprüften FrameCount im Manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, 'src/render/assets/manifest.json'), 'utf8'),
    ) as { atlas: { frameCount: number } };

    expect(manifest.atlas.frameCount).toBe(153);
  });
});
