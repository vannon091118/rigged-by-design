/** @test-target: src/render/rig-parts.ts * @error-code: ERR-3001
 *
 * Die NPC-Rig-Teile kommen aus dem vorhandenen Charakter-Atlas: jede gewaehlte
 * Variante liegt im Manifest und als Frame in einer Atlasseite. Der Test prueft
 * die Auswahl fuer 128 Seeds und jede deklarierte Variante; er dekodiert keine
 * Atlasseite und ersetzt keinen Browserbeleg.
 */
import { describe, expect, it } from 'vitest';
import manifest from '../assets/manifest.json';
import { HEAD_FAMILIES, headFamilyFor, headTextureFor } from '../guest-parts';
import { RIG_PART_VARIANTS, rigPartsFor } from '../rig-parts';

interface AtlasFrame {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

const frames = new Map<string, AtlasFrame>(
  (manifest.atlas.pages ?? []).flatMap((page) => page.frames.map((frame) => [frame.path, frame] as const)),
);
const characters = manifest.characters as Record<string, string>;

const PART_STEMS = [
  ['torso-outfit', RIG_PART_VARIANTS.torso],
  ['arm-segment', RIG_PART_VARIANTS.arm],
  ['leg-segment', RIG_PART_VARIANTS.leg],
  ['footwear-part', RIG_PART_VARIANTS.footwear],
] as const;

describe('NPC-Rig-Teile aus dem Atlas', () => {
  it('waehlt fuer 128 Seeds vier vorhandene Charakterframes', () => {
    for (let seed = 0; seed < 128; seed += 1) {
      for (const [part, path] of Object.entries(rigPartsFor(seed))) {
        expect(characters[path], `${part}: ${path}`).toBe(path);
        expect(manifest.atlas.folders.characters).toContain(path);
        expect(frames.get(path)?.width, `Frame fehlt: ${path}`).toBeGreaterThan(0);
      }
    }
  });

  it('registriert jede deklarierte Variante im Manifest und im Atlas', () => {
    for (const [stem, total] of PART_STEMS) {
      for (let variant = 1; variant <= total; variant += 1) {
        const path = `characters/${stem}-${String(variant).padStart(2, '0')}.png`;
        expect(characters[path], path).toBe(path);
        expect(frames.get(path)?.width, `Frame fehlt: ${path}`).toBeGreaterThan(0);
      }
    }
  });

  it('ist seed-stabil und mischt auch benachbarte Seeds', () => {
    expect(rigPartsFor(42)).toEqual(rigPartsFor(42));
    for (const [part, total] of PART_STEMS) {
      const key = part.split('-')[0] as 'torso' | 'arm' | 'leg' | 'footwear';
      const chosen = new Set(Array.from({ length: 64 }, (_, seed) => rigPartsFor(seed)[key]));
      expect(chosen.size, key).toBeGreaterThanOrEqual(Math.min(6, total));
    }
    const torsos = new Set(Array.from({ length: 64 }, (_, seed) => rigPartsFor(seed).torso));
    expect(torsos.size).toBe(RIG_PART_VARIANTS.torso);
  });

  it('deckt alle drei Kopffamilien im Gast-Pool ab', () => {
    const paths = Array.from({ length: 19 }, (_, seed) => headTextureFor(seed));
    const families = new Set(paths.map((path) => headFamilyFor(path)));
    expect([...families].sort()).toEqual(['head-01', 'head-02', 'head-03']);
    expect(HEAD_FAMILIES).toHaveLength(3);
    expect(paths).toContain('characters/head-03-01.svg');
  });
});
