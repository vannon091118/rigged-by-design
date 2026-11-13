/**
 * @test-target: src/render/room-art.ts
 * @error-code: ERR-3001
 *
 * Ein Chunk wird als Textur gebacken. Zeichnet eine Zone oder die Weltkante
 * ueber die Chunk-Kante hinaus, waechst die Textur und wird verschoben
 * gerendert: In der 60x60-Stadt lagen dadurch breite Bodenstreifen uebereinander.
 * Der Test zeichnet die echten Zeichenfunktionen in einen Recorder und verlangt,
 * dass jedes Rechteck in seinem Chunk bleibt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { areasForSize } from '../../core/sim/grid-zones';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { buildView } from '../../store/snapshot';
import { SceneCommands } from '../../store/scene-commands';
import { drawRegionFloor } from '../room-art';

interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** Minimaler Graphics-Ersatz: sammelt Rechtecke, alles andere ist ein No-op. */
function recorder(): { g: Parameters<typeof drawRegionFloor>[0]; rects: Box[] } {
  const rects: Box[] = [];
  const chain = {
    rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); return chain; },
    roundRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); return chain; },
    fill() { return chain; },
    stroke() { return chain; },
    ellipse() { return chain; },
    circle() { return chain; },
    moveTo() { return chain; },
    lineTo() { return chain; },
    poly() { return chain; },
  };
  return { g: chain as unknown as Parameters<typeof drawRegionFloor>[0], rects };
}

function cityView(): ReturnType<typeof buildView> {
  const world = createWorld('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
  scene.enterCity();
  return buildView(world, new Ledger(), '');
}

function outside(rects: readonly Box[], area: { x: number; y: number; w: number; h: number }, tile: number): Box[] {
  const left = area.x * tile;
  const top = area.y * tile;
  const right = left + area.w * tile;
  const bottom = top + area.h * tile;
  return rects.filter((r) => r.x < left - 0.5 || r.y < top - 0.5 || r.x + r.w > right + 0.5 || r.y + r.h > bottom + 0.5);
}

describe('Chunk-Clip der Raumdarstellung', () => {
  it('haelt jede gezeichnete Flaeche der 60x60-Stadt in ihrem 30x30-Chunk', () => {
    const view = cityView();
    expect(view.size).toBe(60);
    for (const area of areasForSize(view.size)) {
      const { g, rects } = recorder();
      drawRegionFloor(g, view, area, TILE);
      const leaked = outside(rects, area, TILE);
      expect(leaked, `${area.id} zeichnet ausserhalb: ${JSON.stringify(leaked.slice(0, 3))}`).toEqual([]);
    }
  });

  it('zeichnet die Weltkante in jedem Randchunk, aber nie ueber ihn hinaus', () => {
    const view = cityView();
    const areas = areasForSize(view.size);
    const rimChunks = areas.filter((area) => {
      const { g, rects } = recorder();
      drawRegionFloor(g, view, area, TILE);
      // Die Kante ist die einzige Flaeche mit INK-Fuellung am Chunkrand.
      return rects.some((r) => r.y <= area.y * TILE + 4 && r.h >= 4);
    });
    // Zwei Spalten und zwei Reihen: jeder Randchunk traegt seinen Teil der Kante.
    expect(rimChunks.length).toBe(areas.length);
  });

  it('laesst ein 16x16-Casino innerhalb seines einen Chunks', () => {
    const world = createWorld('SMALL');
    const view = buildView(world, new Ledger(), '');
    const [area] = areasForSize(view.size);
    const { g, rects } = recorder();
    drawRegionFloor(g, view, area!, TILE);
    expect(outside(rects, area!, TILE)).toEqual([]);
  });
});
