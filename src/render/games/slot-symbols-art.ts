/** Slot-Symbole: das Pixel-Paket, wo es eines gibt, sonst die gezeichnete Grafik. Der Rueckfall ist kein Notbehelf, sondern der Grund, warum die Buehne auch ohne geladene Texturen vollstaendig aussieht. */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { slotSymbolAsset, textureFor } from '../assets/textures';
import { EXTRA_SYMBOLS } from './slot-symbols-extra';

const GOLD = 0xffd166;
const GOLD_DEEP = 0xb07a1f;
const TEAL = 0x2ee6c8;
const VIOLET = 0x8b5cf6;
const PINK = 0xff2e88;
const INK = 0x120b1c;

export function plate(size: number, tint: number): Graphics {
  const g = new Graphics();
  g.roundRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88, size * 0.14).fill({ color: INK, alpha: 0.55 });
  g.roundRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88, size * 0.14).stroke({ width: 2, color: tint, alpha: 0.45 });
  return g;
}

function glyph(root: Container, size: number, label: string, tint: number): void {
  const text = new Text({
    text: label,
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: size * 0.46, fontWeight: '800', fill: tint },
  });
  text.anchor.set(0.5);
  text.position.set(size / 2, size / 2);
  root.addChild(text);
}

function book(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, GOLD));
  const g = new Graphics();
  g.roundRect(size * 0.24, size * 0.2, size * 0.52, size * 0.6, size * 0.06).fill(GOLD_DEEP);
  g.roundRect(size * 0.28, size * 0.24, size * 0.44, size * 0.52, size * 0.04).fill(GOLD);
  g.rect(size * 0.47, size * 0.22, size * 0.06, size * 0.56).fill(GOLD_DEEP);
  g.circle(size / 2, size * 0.5, size * 0.07).fill({ color: 0xffffff, alpha: 0.85 });
  g.poly([size * 0.5, size * 0.28, size * 0.55, size * 0.38, size * 0.65, size * 0.4, size * 0.56, size * 0.46,
    size * 0.58, size * 0.56, size * 0.5, size * 0.5, size * 0.42, size * 0.56, size * 0.44, size * 0.46,
    size * 0.35, size * 0.4, size * 0.45, size * 0.38]).fill({ color: 0xffffff, alpha: 0.9 });
  root.addChild(g);
  return root;
}

function scarab(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, TEAL));
  const g = new Graphics();
  g.ellipse(size / 2, size * 0.55, size * 0.2, size * 0.26).fill(TEAL);
  g.circle(size / 2, size * 0.31, size * 0.1).fill(0x9ef7e6);
  for (const side of [-1, 1]) {
    for (const step of [0, 1]) {
      g.moveTo(size / 2 + side * size * 0.18, size * (0.46 + step * 0.16));
      g.lineTo(size / 2 + side * size * 0.34, size * (0.4 + step * 0.2));
    }
  }
  g.stroke({ width: Math.max(2, size * 0.03), color: 0x0d5b52 });
  root.addChild(g);
  return root;
}

function ankh(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, GOLD));
  const g = new Graphics();
  g.circle(size / 2, size * 0.33, size * 0.11).stroke({ width: size * 0.06, color: GOLD });
  g.rect(size * 0.46, size * 0.42, size * 0.08, size * 0.36).fill(GOLD);
  g.rect(size * 0.32, size * 0.5, size * 0.36, size * 0.07).fill(GOLD);
  root.addChild(g);
  return root;
}

function eye(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, VIOLET));
  const g = new Graphics();
  g.ellipse(size / 2, size / 2, size * 0.28, size * 0.17).fill(0xf2e9ff);
  g.circle(size / 2, size / 2, size * 0.1).fill(0x6d28d9);
  g.circle(size / 2, size / 2, size * 0.04).fill(0x1b0b2e);
  root.addChild(g);
  return root;
}

function urn(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, PINK));
  const g = new Graphics();
  g.roundRect(size * 0.34, size * 0.22, size * 0.32, size * 0.08, size * 0.03).fill(0xff9ec4);
  g.poly([size * 0.36, size * 0.32, size * 0.64, size * 0.32, size * 0.58, size * 0.66, size * 0.42, size * 0.66]).fill(PINK);
  g.rect(size * 0.44, size * 0.66, size * 0.12, size * 0.08).fill(0xff9ec4);
  root.addChild(g);
  return root;
}

const LETTERS: Readonly<Record<string, number>> = { A: GOLD, K: TEAL, Q: PINK, J: VIOLET };

/** Zeichnet ein Symbol in der Kantenlaenge `size`; unbekannte Ids werden zum Buch. */
export function drawSlotSymbol(id: string, size: number): Container {
  const asset = slotSymbolAsset(id);
  const texture = asset === null ? null : textureFor(asset);
  if (texture) {
    const sprite = new Sprite(texture);
    sprite.width = size;
    sprite.height = size;
    return sprite;
  }
  if (id === 'BOOK') return book(size);
  if (id === 'SCARAB') return scarab(size);
  if (id === 'ANKH') return ankh(size);
  if (id === 'EYE') return eye(size);
  if (id === 'URN') return urn(size);
  const extra = EXTRA_SYMBOLS[id];
  if (extra) return extra(size);
  const tint = LETTERS[id];
  if (tint === undefined) return book(size);
  const root = new Container();
  root.addChild(plate(size, tint));
  glyph(root, size, id, tint);
  return root;
}
