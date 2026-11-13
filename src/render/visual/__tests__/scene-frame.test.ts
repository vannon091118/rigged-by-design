/** @test-target: src/render/visual/scene-frame.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../core/sim/templates';
import { SceneCommands } from '../../../store/scene-commands';
import { cityRenderPlan } from '../../city-exterior-layer';
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

  it('erzeugt die Stadt ueber den Produktionswechsel statt per scene.kind', () => {
    const cityScene = createVisualScenes().find((scene) => scene.id === 'city')!;
    // Referenz: derselbe Uebergang auf einer frischen Welt.
    const world = createWorld('MEDIUM');
    const start = { ...world.player.position };
    const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
    scene.enterCity();
    expect(cityScene.view.player.position).toEqual(world.player.position);
    // Ein direkt gesetztes scene.kind liess die Figur am Casino-Start stehen.
    expect(cityScene.view.player.position).not.toEqual(start);
    expect(cityScene.view.player.path).toEqual([]);
  });

  it('zeichnet alle Tueren des City-Renderplans als SVG-Flaeche', () => {
    const cityScene = createVisualScenes().find((scene) => scene.id === 'city')!;
    const plan = cityRenderPlan(cityScene.view.cityExterior);
    expect(plan).not.toBeNull();
    expect(plan!.doors.length).toBeGreaterThan(0);
    const svg = renderSceneSvg(cityScene);
    for (const door of plan!.doors) expect(svg).toContain(`data-door="${door.id}"`);
    expect(svg.match(/data-door=/g)?.length).toBe(plan!.doors.length);
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
