/**
 * @test-target: src/render/assets/textures.ts
 * @error-code: ERR-4022
 *
 * Der Test faehrt den echten Produktionspfad `loadAtlas` + `textureFor` und
 * stubbed nur die Engine-Grenze (Pixi-Texture/Rectangle, Browser-Image). Er
 * belegt: jedes der 17 Environment-SVGs liegt als Frame in einer Atlasseite,
 * `textureFor` liefert die geladene Atlastextur mit `nearest`, und fuer keinen
 * dieser Pfade wird `Assets.load` (also ein SVG-Netzwerk-Fetch) aufgerufen.
 *
 * Nicht belegt: Pixeldarstellung im Browser; die Seiten werden hier nicht
 * dekodiert, sondern als geladene Image-Objekte der Engine uebergeben.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ASSET, RUNTIME_ART } from '../keys';
import manifest from '../manifest.json';

const { assetsLoad } = vi.hoisted(() => ({ assetsLoad: vi.fn() }));

vi.mock('pixi.js', () => {
  class Rectangle {
    constructor(
      readonly x: number,
      readonly y: number,
      readonly width: number,
      readonly height: number,
    ) {}
  }
  class Texture {
    readonly source: { scaleMode: string; image: unknown };
    readonly frame: Rectangle;

    constructor(options: { source: { scaleMode: string; image: unknown }; frame: Rectangle }) {
      this.source = options.source;
      this.frame = options.frame;
    }

    static from(image: unknown): Texture {
      return new Texture({ source: { scaleMode: 'linear', image }, frame: new Rectangle(0, 0, 1, 1) });
    }
  }
  return { Assets: { load: assetsLoad }, Rectangle, Texture };
});

class FakeImage {
  static readonly sources: string[] = [];
  readonly naturalWidth = manifest.atlas.size;
  readonly naturalHeight = manifest.atlas.size;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    FakeImage.sources.push(value);
    queueMicrotask(() => this.onload?.());
  }
}

vi.stubGlobal('Image', FakeImage);
vi.stubGlobal('document', {});

interface AtlasFrame {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

const frames = new Map<string, AtlasFrame>(
  (manifest.atlas.pages ?? []).flatMap((page) => page.frames.map((frame) => [frame.path, frame] as const)),
);
const environment = Object.values(manifest.environment);
const svgPaths = environment.filter((path) => path.endsWith('.svg'));

function sourceSize(path: string): { width: number; height: number } {
  const url = new URL(`../../../../public/assets/casino/${path}`, import.meta.url);
  const svg = readFileSync(url, 'utf8').slice(0, 600);
  return {
    width: Number(/width="(\d+)"/.exec(svg)?.[1]),
    height: Number(/height="(\d+)"/.exec(svg)?.[1]),
  };
}

describe('Environment-SVGs im Produktionsatlas', () => {
  it('liefert alle 17 SVGs als geladene Atlastextur ohne Assets.load', async () => {
    expect(svgPaths).toHaveLength(17);
    const { atlasTexture, loadAtlas } = await import('../atlas');
    const { textureFor } = await import('../textures');

    await loadAtlas(manifest.atlas, manifest.base);

    for (const path of svgPaths) {
      expect(manifest.atlas.folders.environment).toContain(path);
      const frame = frames.get(path);
      expect(frame, `Atlas-Frame fehlt: ${path}`).toBeDefined();

      const texture = textureFor(path);
      expect(texture, `textureFor liefert null: ${path}`).not.toBeNull();
      expect(atlasTexture(path)).toBe(texture);
      expect(texture?.source.scaleMode).toBe('nearest');
      expect(texture?.frame.width).toBe(frame?.width);
      expect(texture?.frame.height).toBe(frame?.height);
    }

    expect(assetsLoad).not.toHaveBeenCalled();
  });

  it('rastert jedes SVG auf seine viewBox-Groesse', () => {
    for (const path of svgPaths) {
      const frame = frames.get(path);
      const size = sourceSize(path);
      expect(frame?.width, path).toBe(size.width);
      expect(frame?.height, path).toBe(size.height);
    }
  });

  it('verweist auf vorhandene WebP-Atlasseiten', () => {
    for (const page of manifest.atlas.pages ?? []) {
      const url = new URL(`../../../../public/assets/casino/${page.source}`, import.meta.url);
      const header = readFileSync(url).subarray(0, 12);
      expect(header.toString('ascii', 0, 4)).toBe('RIFF');
      expect(header.toString('ascii', 8, 12)).toBe('WEBP');
    }
  });

  it('loest die dritte Kopffamilie ueber Keys, Cache und Atlas auf', async () => {
    const path = 'characters/head-03-01.svg';
    expect(ASSET.heads).toContain(path);
    expect(RUNTIME_ART).toContain(path);
    expect(manifest.characters[path]).toBe(path);
    expect(manifest.atlas.folders.characters).toContain(path);
    expect(frames.get(path)).toMatchObject({ width: 32, height: 36 });

    const { atlasTexture, loadAtlas } = await import('../atlas');
    const { textureFor } = await import('../textures');
    await loadAtlas(manifest.atlas, manifest.base);

    const first = textureFor(path);
    const second = textureFor(path);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(atlasTexture(path)).toBe(first);
    expect(first?.source.scaleMode).toBe('nearest');
    expect(first?.frame).toMatchObject({ width: 32, height: 36 });

    expect(assetsLoad).not.toHaveBeenCalled();
    expect(FakeImage.sources.some((source) => source.includes('head-03-01.svg'))).toBe(false);
  });
});
