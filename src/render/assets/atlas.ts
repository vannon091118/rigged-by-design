/**
 * Laufzeit-Atlas: nutzt die im Build gepackten Seiten, wenn das Manifest sie
 * nennt; sonst packt er die vier Pixel-Ordner deterministisch selbst in
 * 1024er-Seiten. Scheitert beides, bleibt der Einzeldatei-Pfad in textures.ts.
 */
import { Rectangle, Texture } from 'pixi.js';

interface AtlasFrame {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface AtlasPage {
  readonly source: string;
  readonly frames: readonly AtlasFrame[];
}

export interface AtlasManifest {
  readonly size: number;
  readonly padding: number;
  readonly order: readonly string[];
  readonly folders: Readonly<Record<string, readonly string[]>>;
  readonly pages?: readonly AtlasPage[];
}

interface FrameInput {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

interface PackedFrame extends FrameInput {
  readonly x: number;
  readonly y: number;
  readonly page: number;
}

interface AtlasItem extends FrameInput {
  readonly image: HTMLImageElement;
}

const textures = new Map<string, Texture>();
let ready = false;
let building: Promise<void> | null = null;

/** Bereits gepackte Textur oder null; nie blockierend. */
export function atlasTexture(path: string): Texture | null {
  return textures.get(path) ?? null;
}

/** Einmal laden; mehrere Aufrufe teilen sich dieselbe Arbeit. */
export function loadAtlas(plan: AtlasManifest, base: string): Promise<void> {
  if (ready) return Promise.resolve();
  building ??= build(plan, base).catch(() => undefined).then(() => { ready = true; });
  return building;
}

/**
 * Reiner Shelf-Plan. Sortierung nach Hoehe, Breite und Pfad macht die Seiten
 * unabhaengig von Dateisystem-Reihenfolge und damit reproduzierbar.
 */
export function shelfPack(items: readonly FrameInput[], size: number, padding: number): PackedFrame[][] {
  const sorted = [...items].sort((a, b) => b.height - a.height || b.width - a.width
    || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const pages: PackedFrame[][] = [];
  let frames: PackedFrame[] = [];
  let x = padding;
  let y = padding;
  let shelfHeight = 0;

  for (const item of sorted) {
    if (item.width <= 0 || item.height <= 0) continue;
    if (item.width + padding * 2 > size || item.height + padding * 2 > size) continue;
    if (x + item.width + padding > size) {
      x = padding;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }
    if (y + item.height + padding > size) {
      if (frames.length) pages.push(frames);
      frames = [];
      x = padding;
      y = padding;
      shelfHeight = 0;
    }
    frames.push({ ...item, x, y, page: pages.length });
    x += item.width + padding;
    shelfHeight = Math.max(shelfHeight, item.height);
  }
  if (frames.length) pages.push(frames);
  return pages;
}

async function build(plan: AtlasManifest, base: string): Promise<void> {
  if (typeof document === 'undefined') return;
  if (plan.pages?.length) {
    const pages = await Promise.all(plan.pages.map((page) => loadImage(`${base}${page.source}`)));
    if (pages.every((page): page is HTMLImageElement => Boolean(page))) {
      plan.pages.forEach((page, index) => registerPage(page, pages[index]!));
      return;
    }
  }
  await packFolders(plan, base);
}

/** Produktionspfad: eine Textur je Seite, Frames als Ausschnitte. */
function registerPage(page: AtlasPage, image: HTMLImageElement): void {
  const sheet = Texture.from(image);
  sheet.source.scaleMode = 'nearest';
  for (const frame of page.frames) {
    textures.set(frame.path, new Texture({
      source: sheet.source,
      frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
    }));
  }
}

/** Rueckfall: die Einzeldateien werden erst hier zu Seiten gepackt. */
async function packFolders(plan: AtlasManifest, base: string): Promise<void> {
  const paths = plan.order.flatMap((folder) => plan.folders[folder] ?? []);
  const images = new Map<string, HTMLImageElement>();
  const queue = [...paths];
  const workers = Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const path = queue.shift();
      if (!path) return;
      const image = await loadImage(`${base}${path}`);
      if (image) images.set(path, image);
    }
  });
  await Promise.all(workers);

  const items: AtlasItem[] = [];
  for (const [path, image] of images) {
    items.push({ path, width: image.naturalWidth, height: image.naturalHeight, image });
  }
  for (const frames of shelfPack(items, plan.size, plan.padding)) {
    const canvas = document.createElement('canvas');
    canvas.width = plan.size;
    canvas.height = plan.size;
    const context = canvas.getContext('2d');
    if (!context) continue;
    context.imageSmoothingEnabled = false;
    for (const frame of frames) {
      const image = images.get(frame.path);
      if (image) context.drawImage(image, frame.x, frame.y);
    }
    const sheet = Texture.from(canvas);
    sheet.source.scaleMode = 'nearest';
    for (const frame of frames) {
      textures.set(frame.path, new Texture({
        source: sheet.source,
        frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
      }));
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
