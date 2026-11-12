/**
 * Ein Korpus je Bauart und Groesse als RenderTexture. Instanzen zeichnen danach
 * nur ein Sprite; die Silhouette ist in beiden LOD-Stufen dieselbe.
 *
 * Die Rolle kommt aus `decor-roles`: stabile IDs zuerst, exakte Labels nur als
 * letzter registrierter Fall. Unbekannte Deko wird als Platzhalter gezeichnet,
 * nicht mit einer geratenen Textur oder einer gruenen Ersatzfläche.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { isCabinet } from '../core/sim/device';
import type { Furniture } from '../core/sim/types';
import { INK, LIGHT, ROLE, STROKE, furnitureTone } from './art-tokens';
import { textureFor } from './assets/textures';
import { resolveFurnitureRole, type FurnitureRole } from './decor-roles';

/** Gebackene Korpustexturen, Schluessel ist Bauart plus Groesse. */
const atlas = new Map<string, Texture>();

/** Anzahl gebackener Texturen; das Werkstatt-HUD zeigt sie an. */
export const atlasTextureCount = (): number => atlas.size;

/** Ein Glow-Ring fuer alle Objekte: bei Druck geht er kurz auf alpha 0.5. */
let glow: Texture | null = null;
export function glowTextureFor(renderer: Renderer): Texture {
  if (glow) return glow;
  const shape = new Graphics();
  shape.roundRect(0, 0, 32, 32, 9).stroke({ width: 3, color: 0xffffff, alpha: 0.95 });
  shape.roundRect(4, 4, 24, 24, 7).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  glow = renderer.generateTexture({ target: shape, resolution: 1 });
  shape.destroy();
  return glow;
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

/** Bekannte Rollen ohne eigenes Asset erhalten eine erkennbare Grundform. */
function drawRoleShape(g: Graphics, w: number, h: number, role: FurnitureRole): void {
  switch (role) {
    case 'BED':
      g.roundRect(2, h * 0.18, w - 4, h * 0.66, 5).fill(0x3a2a4a);
      g.roundRect(4, h * 0.24, w - 8, h * 0.2, 3).fill(0xd8c8e8);
      g.rect(3, h * 0.48, w - 6, 2).fill(0x6a4a86);
      return;
    case 'WARDROBE':
      g.roundRect(2, 2, w - 4, h - 4, 3).fill(0x2a2038).stroke({ width: 1, color: 0x6a4a86 });
      g.rect(w * 0.5, 4, 1, h - 8).fill(0x8a7aa8);
      g.circle(w * 0.43, h * 0.52, 1.3).fill(ROLE.value);
      return;
    case 'TABLE':
      g.roundRect(2, h * 0.32, w - 4, h * 0.32, 3).fill(0x4a3428);
      g.rect(w * 0.18, h * 0.64, 3, h * 0.22).fill(0x2a1a14);
      g.rect(w * 0.76, h * 0.64, 3, h * 0.22).fill(0x2a1a14);
      return;
    case 'KITCHEN':
      g.roundRect(2, h * 0.2, w - 4, h * 0.62, 3).fill(0x28333a);
      g.rect(4, h * 0.24, w - 8, 2).fill(0xb8c8d0);
      g.circle(w * 0.5, h * 0.55, 3).fill(0x7a9aa8);
      return;
    case 'FRIDGE':
      g.roundRect(3, 2, w - 6, h - 4, 3).fill(0x3a4650).stroke({ width: 1, color: 0x9ab0c0 });
      g.rect(5, h * 0.42, w - 10, 1).fill(0x9ab0c0);
      g.rect(w * 0.82, h * 0.2, 1, h * 0.18).fill(0xc8d8e0);
      return;
    case 'SINK':
      g.roundRect(2, h * 0.4, w - 4, h * 0.4, 3).fill(0x2a3a44);
      g.circle(w * 0.5, h * 0.58, 3).fill(0x9ac8d8);
      g.rect(w * 0.5, h * 0.12, 1, h * 0.28).fill(0xb8d0d8);
      return;
    case 'SMARTPHONE':
      g.roundRect(w * 0.28, h * 0.18, w * 0.44, h * 0.56, 2).fill(0x101820).stroke({ width: 1, color: ROLE.service });
      g.rect(w * 0.34, h * 0.26, w * 0.32, h * 0.28).fill(0x1a3a44);
      return;
    case 'SOFA':
      g.roundRect(2, h * 0.22, w - 4, h * 0.56, 6).fill(0x4a2040);
      g.roundRect(4, h * 0.34, w - 8, h * 0.34, 4).fill(0x74305e);
      g.rect(w * 0.06, h * 0.76, 4, h * 0.16).fill(0x2a1424);
      g.rect(w * 0.9, h * 0.76, 4, h * 0.16).fill(0x2a1424);
      return;
    case 'MIRROR':
      g.roundRect(w * 0.16, h * 0.06, w * 0.68, h * 0.86, 5).fill(0x2a1a3a).stroke({ width: 2, color: 0xffd166, alpha: 0.7 });
      g.roundRect(w * 0.24, h * 0.14, w * 0.52, h * 0.7, 3).fill(0x162832).stroke({ width: 1, color: 0xbff6ff, alpha: 0.65 });
      g.moveTo(w * 0.3, h * 0.7).lineTo(w * 0.52, h * 0.22).stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
      return;
    default:
      g.circle(w * 0.5, h * 0.52, Math.min(w, h) * 0.28).fill(0x3a2a4a).stroke({ width: 1, color: 0x8a7aa8 });
      g.rect(w * 0.42, h * 0.74, w * 0.16, h * 0.2).fill(0x2a1a14);
  }
}

/** Unbekannte Rolle: sichtbare Warnfläche statt einer geratenen Textur. */
function drawUnresolved(g: Graphics, w: number, h: number): void {
  g.roundRect(1, 1, w - 2, h - 2, 4).fill(0x241d33).stroke({ width: 2, color: ROLE.warning, alpha: 0.92 });
  for (let x = 4; x < w - 4; x += 8) {
    g.moveTo(x, 3).lineTo(Math.min(w - 4, x + 5), h - 3)
      .stroke({ width: 1, color: ROLE.warning, alpha: 0.35 });
  }
  g.moveTo(w * 0.4, h * 0.32).quadraticCurveTo(w * 0.5, h * 0.18, w * 0.6, h * 0.32)
    .quadraticCurveTo(w * 0.62, h * 0.42, w * 0.5, h * 0.48)
    .stroke({ width: 2, color: ROLE.warning, alpha: 0.95 });
  g.circle(w * 0.5, h * 0.62, 1.7).fill(ROLE.warning);
}

/** Schluessel: Rolle, Sitze und Groesse. Zwei unbekannte Labels teilen keine Textur. */
function bodyKey(item: Furniture, w: number, h: number): string {
  const role = resolveFurnitureRole(item);
  const shape = role?.key ?? `unresolved:${item.kind}:${item.label}`;
  return `${shape}:${item.seats}:${w}x${h}`;
}

/** Korpus einmal zeichnen; Lichtinsel, Schatten und Backdrop gehoeren dazu. */
function drawBody(target: Container, item: Furniture, w: number, h: number): void {
  const role = resolveFurnitureRole(item);
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
  const bodyColor = role ? tone.body : 0x241d33;
  const edge = role ? tone.edge : ROLE.warning;
  g.roundRect(0, 0, w, h, 5).fill(bodyColor).stroke({ width: STROKE.hair, color: edge, alpha: 0.5 });
  g.roundRect(2, 2, w - 4, h - 4, 4).fill({ color: 0x07040d, alpha: 0.28 });
  g.rect(3, 1, w - 6, 1).fill({ color: LIGHT.warm, alpha: 0.2 });
  g.rect(1, 3, 1, h - 6).fill({ color: LIGHT.warm, alpha: 0.1 });
  if (!role) drawUnresolved(g, w, h);
  else if (isCabinet(item)) drawSlot(g, w, h);
  else if (item.kind === 'TABLE') drawTable(g, w, h, item.seats);
  else if (item.kind === 'BAR') drawBar(g, w, h);
  else if (item.kind === 'TOILET') drawToilet(g, w, h, item.seats);
  else if (item.kind === 'EXCHANGE') drawExchange(g, w, h);
  else if (item.kind === 'STORAGE') drawStorage(g, w, h);
  else if (item.kind === 'DECOR') drawRoleShape(g, w, h, role.role);
  target.addChild(pool, shadow, g);
  const texture = role?.asset ? textureFor(role.asset) : null;
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
