/** @test-target: src/render/view-layers.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import type { GameView } from '../../store/types';
import { syncViewLayers, type ViewLayers } from '../view-layers';

function harness(dirty: boolean) {
  const calls: string[] = [];
  const layer = (name: string) => new Proxy({}, {
    get: (_target, key) => () => { calls.push(`${name}.${String(key)}`); },
  });
  const layers = {
    scene: {
      redrawRoom: () => calls.push('scene.redrawRoom'),
      setLabels: () => calls.push('scene.setLabels'),
      redrawDirt: () => calls.push('scene.redrawDirt'),
      depth: { flush: () => calls.push('scene.flush') },
    },
    city: {
      update: () => calls.push('city.update'),
      setAmbient: () => calls.push('city.setAmbient'),
    },
    ambient: { update: () => calls.push('ambient.update') },
    lights: { update: () => calls.push('lights.update') },
    walls: { sync: () => calls.push('walls.sync') },
    cues: { setPath: () => calls.push('cues.setPath') },
    entities: {
      resetFurniture: () => calls.push('entities.resetFurniture'),
      sync: () => calls.push('entities.sync'),
      cull: () => calls.push('entities.cull'),
    },
    cityActors: { sync: () => calls.push('cityActors.sync'), clear: () => calls.push('cityActors.clear') },
    rig: {
      get lod() { return 1; },
      get dirty() { return dirty; },
      resetForLayout: () => calls.push('rig.resetForLayout'),
      updateLod: () => calls.push('rig.updateLod'),
      apply: () => calls.push('rig.apply'),
    },
    renderer: layer('renderer'),
  } as unknown as ViewLayers;
  const view = {
    template: 'MEDIUM', size: 30, carpet: 'VIOLET', dayPhase: 'evening',
    scene: { kind: 'OWN' }, layout: { size: 30, edges: [] },
    player: { path: [], pathIndex: 0 },
    cityExterior: null,
  } as unknown as GameView;
  return { calls, layers, view };
}

describe('Snapshot-Reihenfolge der Layer', () => {
  it('versorgt jeden Layer genau einmal und in fester Reihenfolge', () => {
    const { calls, layers, view } = harness(false);
    syncViewLayers(layers, view, view, false, 1000);
    expect(calls).toEqual([
      'scene.redrawRoom', 'city.update', 'city.setAmbient', 'ambient.update', 'lights.update',
      'scene.setLabels', 'scene.redrawDirt', 'entities.sync', 'cityActors.sync', 'walls.sync', 'scene.flush',
      'cues.setPath', 'rig.updateLod', 'entities.cull',
    ]);
    expect(calls.filter((entry) => entry === 'entities.sync')).toHaveLength(1);
    expect(calls).not.toContain('rig.apply');
  });

  it('wendet die Kamera nur bei Aenderung an und cullt dann nicht doppelt', () => {
    const { calls, layers, view } = harness(true);
    syncViewLayers(layers, view, view, false, 1000);
    expect(calls).toContain('rig.apply');
    expect(calls).not.toContain('entities.cull');
  });

  it('setzt Moebel nur bei einem echten Layoutwechsel zurueck', () => {
    const { calls, layers, view } = harness(true);
    syncViewLayers(layers, { ...view, template: 'LARGE' }, view, true, 1000);
    expect(calls).toContain('entities.resetFurniture');
    expect(calls).toContain('rig.resetForLayout');
  });
});
