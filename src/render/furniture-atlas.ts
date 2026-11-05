/**
 * Ein Korpus je Bauart und Groesse als RenderTexture. Instanzen zeichnen danach
 * nur ein Sprite; die Silhouette ist in beiden LOD-Stufen dieselbe.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { isCabinet } from '../core/sim/device';
import type { Furniture } from '../core/sim/types';
import { INK, LIGHT, ROLE, STROKE, furnitureTone } from './art-tokens';
import { textureFor } from './assets/textures';

/** Gebackene Korpustexturen, Schluessel ist Bauart plus Groesse. */
const atlas = new Map<string, Texture>();

/** Anzahl gebackener Texturen; das Werkstatt-HUD zeigt sie an. */
export const atlasTextureCount = (): number => atlas.size;

/** Spieltyp zu Maschinen-Textur-Key im Manifest. */
const MACHINE_TEXTURE: Readonly<Record<string, string>> = {
  SLOT: 'machines/slot-cabinet.png',
  PLINKO: 'machines/plinko-cabinet.png',
  BLACKJACK: 'machines/blackjack-table.png',
  POKER: 'machines/poker-table.png',
  VIDEO_POKER: 'machines/video-poker-terminal.png',
  ROULETTE: 'machines/roulette-table.png',
  SHELL: 'machines/table-games/shell-game-cups-and-pearl.png',
  DICE: 'machines/dice-table.png',
};

/** Service-Moebel, das keine eigene Spiel-ID hat. */
const KIND_TEXTURE: Readonly<Record<string, string>> = {
  BAR: 'decor/bar-back-shelf.png',
  TOILET: 'machines/restroom-stall.png',
  EXCHANGE: 'machines/cashier-counter.png',
  STORAGE: 'machines/storage-shelves.png',
};

/** Deko-Textur nach Schlagwort im Label; der erste Treffer gewinnt. */
const DECOR_TEXTURE: readonly (readonly [RegExp, string])[] = [
  [/sofa|lounge/i, 'decor/lounge-sofa.png'],
  [/sessel|armchair/i, 'decor/vip-armchair.png'],
  [/palme|palm/i, 'decor/potted-palm.png'],
  [/pflanze|planter|gr[üu]n/i, 'decor/planter-greenery.png'],
  [/neon|tube|leucht/i, 'decor/neon-column.png'],
  [/s[äa]ule|column/i, 'decor/casino-column.png'],
  [/kronleuchter|chandelier/i, 'decor/chandelier.png'],
  [/kandelaber|candelabra/i, 'decor/gold-candelabra.png'],
  [/katze|cat/i, 'decor/egyptian-cat-statue.png'],
  [/seil|rope/i, 'decor/velvet-rope-barrier.png'],
  [/lampe|lamp|sconce/i, 'decor/pendant-lamp.png'],
  [/zeitung|newspaper/i, 'decor/casino-newspaper.png'],
  [/tisch|table|podium/i, 'decor/casino-side-table.png'],
  [/bar|theke|counter/i, 'decor/bar-counter-stools.png'],
  [/schild|sign/i, 'decor/casino-neon-sign.png'],
];

function decorTexture(label: string): string | null {
  return DECOR_TEXTURE.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

function backdropKey(item: Furniture): string | null {
  return item.gameId
    ? MACHINE_TEXTURE[item.gameId] ?? null
    : item.kind === 'DECOR' ? decorTexture(item.label) : KIND_TEXTURE[item.kind] ?? null;
}

/** Schluessel: Bauart, Variante und Groesse. Sitze und Label aendern den Korpus. */
function bodyKey(item: Furniture, w: number, h: number): string {
  const shape = item.gameId ?? item.kind;
  const variant = item.kind === 'DECOR' ? decorTexture(item.label) ?? 'plain' : `${item.seats}`;
  return `${shape}:${variant}:${w}x${h}`;
}

function drawSlot(g: Graphics, w: number, h: number): void {
  g.roundRect(w * 0.16, h * 0.12, w * 0.68, h * 0.5, 3).fill(0x07040d).stroke({ width: 1, color: ROLE.value, alpha: 0.6 });
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      g.circle(w * 0.31 + col * w * 0.19, h * 0.22 + row * h * 0.13, 2.4)
        .fill(row === 1 ? (col === 1 ? ROLE.guest : ROLE.value) : 0x8a7aa8);
    }
  }
  g.circle(w * 0.86, h * 0.3, 3.5).fill(ROLE.value);
  g.rect(w * 0.85, h * 0.3, 2, h * 0.2).fill(ROLE.value);
  g.roundRect(w * 0.14, h * 0.76, w * 0.6, h * 0.12, 3).fill(0x1a102c);
}

function drawTable(g: Graphics, w: number, h: number, seats: number): void {
  g.circle(w / 2, h / 2, Math.min(w, h) * 0.34).fill(0x1d2a1a).stroke({ width: 2, color: 0x8a9a64, alpha: 0.6 });
  for (let seat = 0; seat < seats; seat += 1) {
    const angle = (seat / Math.max(1, seats)) * Math.PI * 2;
    g.circle(w / 2 + Math.cos(angle) * w * 0.42, h / 2 + Math.sin(angle) * h * 0.42, 4).fill(0x5a4a3a);
  }
  g.rect(w * 0.2, h * 0.48, w * 0.6, 2).fill(0x8a6a4a);
}

function drawBar(g: Graphics, w: number, h: number): void {
  g.roundRect(3, h * 0.2, w - 6, h * 0.42, 5).fill(0x5b2838);
  g.roundRect(6, h * 0.64, w - 12, h * 0.24, 4).fill(0x2c1420);
  for (let bottle = 0; bottle < 6; bottle += 1) {
    g.roundRect(8 + bottle * (w / 7), h * 0.26, 3, 10, 1)
      .fill([ROLE.service, ROLE.guest, ROLE.value, ROLE.identity, ROLE.warning, ROLE.service][bottle]!);
  }
}

function drawToilet(g: Graphics, w: number, h: number, seats: number): void {
  for (let stall = 0; stall < seats; stall += 1) {
    const x = 3 + stall * ((w - 6) / Math.max(1, seats));
    const cell = (w - 6) / Math.max(1, seats);
    g.roundRect(x, 3, cell - 2, h - 6, 3).fill(0x101c2a).stroke({ width: 1, color: 0x5a87a8, alpha: 0.5 });
    g.circle(x + cell / 2, h * 0.58, 4).fill(0xd8e8f0).stroke({ width: 1, color: 0x5a87a8 });
  }
}

function drawExchange(g: Graphics, w: number, h: number): void {
  g.roundRect(4, h * 0.42, w - 8, h * 0.34, 3).fill(0x6b4a22);
  g.rect(8, h * 0.38, w - 16, 2).fill(ROLE.value);
  g.circle(w * 0.35, h * 0.78, 3).fill(ROLE.service);
  for (let bar = 0; bar < 4; bar += 1) g.rect(10 + bar * 9, h * 0.12, 1, h * 0.24).fill({ color: ROLE.value, alpha: 0.3 });
}

function drawStorage(g: Graphics, w: number, h: number): void {
  g.roundRect(w * 0.12, h * 0.2, w * 0.76, h * 0.62, 4).fill(0x17131f);
  for (let box = 0; box < 3; box += 1) {
    g.rect(w * 0.2 + box * w * 0.2, h * 0.32, w * 0.14, h * 0.3).fill(0x3a3048);
    g.rect(w * 0.2 + box * w * 0.2, h * 0.32, w * 0.14, 2).fill(0x6a4a86);
  }
}

function drawDecor(g: Graphics, w: number, h: number, label: string): void {
  if (label.toLowerCase().includes('sofa')) {
    g.roundRect(2, h * 0.22, w - 4, h * 0.56, 6).fill(0x4a2040);
    g.roundRect(4, h * 0.34, w - 8, h * 0.34, 4).fill(0x74305e);
    g.rect(w * 0.06, h * 0.76, 4, h * 0.16).fill(0x2a1424);
    g.rect(w * 0.9, h * 0.76, 4, h * 0.16).fill(0x2a1424);
    return;
  }
  g.circle(w * 0.5, h * 0.55, w * 0.35).fill(0x2dd4a0);
  g.circle(w * 0.35, h * 0.35, w * 0.22).fill(0x3f8a6a);
  g.rect(w * 0.43, h * 0.7, w * 0.14, h * 0.25).fill(0x5a3a2a);
}

/** Korpus einmal zeichnen; Lichtinsel, Schatten und Backdrop gehoeren dazu. */
function drawBody(target: Container, item: Furniture, w: number, h: number): void {
  const tone = furnitureTone(item.kind);
  const pool = new Graphics();
  if (item.kind === 'EXCHANGE' || item.kind === 'BAR' || item.gameId) {
    pool.ellipse(w / 2, h / 2, w * 0.9, h * 0.85).fill({ color: tone.edge, alpha: 0.045 });
    pool.ellipse(w / 2, h / 2, w * 0.6, h * 0.55).fill({ color: LIGHT.warm, alpha: 0.04 });
  }
  // Licht faellt von oben links: weicher Wurf nach unten rechts, harte Kontaktkante am Fuss.
  const shadow = new Graphics();
  shadow.roundRect(6, 9, w, h, 8).fill({ color: 0x000000, alpha: tone.shadow * 0.34 });
  shadow.roundRect(3, 5, w + 1, h + 1, 7).fill({ color: 0x000000, alpha: tone.shadow * 0.55 });
  shadow.roundRect(1, 3, w, h, 6).fill({ color: 0x000000, alpha: tone.shadow });
  const g = new Graphics();
  g.roundRect(0, 0, w, h, 5).fill(tone.body).stroke({ width: STROKE.hair, color: tone.edge, alpha: 0.5 });
  g.roundRect(2, 2, w - 4, h - 4, 4).fill({ color: 0x07040d, alpha: 0.28 });
  g.rect(3, 1, w - 6, 1).fill({ color: LIGHT.warm, alpha: 0.2 });
  g.rect(1, 3, 1, h - 6).fill({ color: LIGHT.warm, alpha: 0.1 });
  if (isCabinet(item)) drawSlot(g, w, h);
  else if (item.kind === 'TABLE') drawTable(g, w, h, item.seats);
  else if (item.kind === 'BAR') drawBar(g, w, h);
  else if (item.kind === 'TOILET') drawToilet(g, w, h, item.seats);
  else if (item.kind === 'EXCHANGE') drawExchange(g, w, h);
  else if (item.kind === 'STORAGE') drawStorage(g, w, h);
  else if (item.kind === 'DECOR') drawDecor(g, w, h, item.label);
  target.addChild(pool, shadow, g);
  const key = backdropKey(item);
  const texture = key ? textureFor(key) : null;
  if (texture) {
    const sprite = new Sprite(texture);
    sprite.width = w;
    sprite.height = h;
    sprite.alpha = 0.92;
    target.addChild(sprite);
  }
  // Unsichtbarer Rahmen haelt die Texturgroesse auch bei runden Formen.
  target.addChild(new Graphics().rect(0, 0, w, h).fill({ color: INK, alpha: 0.001 }));
}

/** Textur je Bauart und Groesse, beim ersten Zugriff gebacken. */
export function atlasTextureFor(renderer: Renderer, item: Furniture, tile: number): Texture {
  const w = item.w * tile;
  const h = item.h * tile;
  const key = bodyKey(item, w, h);
  const hit = atlas.get(key);
  if (hit) return hit;
  const container = new Container();
  drawBody(container, item, w, h);
  const texture = renderer.generateTexture({ target: container, resolution: 1 });
  container.destroy({ children: true });
  atlas.set(key, texture);
  return texture;
}
