/** @test-target: src/render/visual/scene-frame.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { captureVisualEvidence, createVisualScenes, frameHash, renderSceneSvg } from '../scene-frame';

describe('R1-Bildvertrag', () => {
  it('deckt Casino-Übersicht, Casino-Detail, Stadt und Wohnung ab', () => {
    expect(createVisualScenes().map((scene) => scene.id)).toEqual([
      'casino-overview', 'casino-detail', 'city', 'apartment',
    ]);
  });

  it('ist über drei Läufe byte-identisch', () => {
    const evidence = captureVisualEvidence();
    expect(evidence).toHaveLength(4);
    for (const frame of evidence) {
      expect(frame.hash).not.toBe('unstable');
      expect(frame.hash).toHaveLength(8);
      expect(frame.svg).toContain('data-scene=');
    }
  });

  it('ändert den Hash bei einer echten Bildänderung', () => {
    const scene = createVisualScenes()[0]!;
    const before = frameHash(renderSceneSvg(scene));
    const shifted = { ...scene, camera: { ...scene.camera, zoom: 1.25 } };
    expect(frameHash(renderSceneSvg(shifted))).not.toBe(before);
  });

  it('zeichnet unbekannte Möbel als unaufgelöste Rolle, nicht als geratene Deko', () => {
    const scene = createVisualScenes()[0]!;
    const unknown = {
      ...scene.view.furniture[0],
      id: 999, kind: 'DECOR' as const, label: 'Nicht registriert', x: 1, y: 1, w: 1, h: 1,
    };
    const svg = renderSceneSvg({ ...scene, view: { ...scene.view, furniture: [unknown as never] } });
    expect(svg).toContain('data-role="unresolved"');
  });
});
