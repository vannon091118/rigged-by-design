/** Zusatz-Symbole aus dem Pre-Alpha Pixel-Paket: gezeichnete Fallbacks, wenn die Textur nicht geladen ist. */
import { Container, Graphics } from 'pixi.js';
import { plate } from './slot-symbols-art';

const RED = 0xff4444;
const GREEN = 0x4ade80;
const ORANGE = 0xfb923c;

function cherries(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, RED));
  const g = new Graphics();
  g.circle(size * 0.35, size * 0.35, size * 0.13).fill(0xff2e88);
  g.circle(size * 0.55, size * 0.32, size * 0.13).fill(0xff2e88);
  g.moveTo(size * 0.35, size * 0.22).lineTo(size * 0.33, size * 0.08).stroke({ width: size * 0.03, color: GREEN });
  g.moveTo(size * 0.55, size * 0.19).lineTo(size * 0.53, size * 0.06).stroke({ width: size * 0.03, color: GREEN });
  g.moveTo(size * 0.33, size * 0.08).lineTo(size * 0.44, size * 0.06).stroke({ width: size * 0.03, color: GREEN });
  root.addChild(g);
  return root;
}

function lemon(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  g.ellipse(size / 2, size / 2, size * 0.24, size * 0.16).fill(0xffd166);
  g.rect(size * 0.47, size * 0.12, size * 0.06, size * 0.24).fill(0xb07a1f);
  g.circle(size * 0.42, size * 0.38, size * 0.05).fill({ color: 0xffffff, alpha: 0.6 });
  root.addChild(g);
  return root;
}

function orange(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, ORANGE));
  const g = new Graphics();
  g.circle(size / 2, size / 2, size * 0.2).fill(ORANGE);
  g.circle(size / 2, size / 2, size * 0.12).fill(0xffb84d);
  g.rect(size * 0.46, size * 0.14, size * 0.08, size * 0.16).fill(0xd45a1e);
  root.addChild(g);
  return root;
}

function grape(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0x8b5cf6));
  const g = new Graphics();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      g.circle(size * 0.36 + col * size * 0.09, size * 0.42 + row * size * 0.07, size * 0.05).fill(0x7c3aed);
    }
  }
  g.rect(size * 0.46, size * 0.14, size * 0.08, size * 0.16).fill(GREEN);
  root.addChild(g);
  return root;
}

function watermelon(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, GREEN));
  const g = new Graphics();
  g.circle(size / 2, size / 2, size * 0.22).fill(GREEN);
  g.circle(size / 2, size / 2, size * 0.14).fill(RED);
  g.circle(size / 2, size / 2, size * 0.04).fill({ color: 0xffffff, alpha: 0.9 });
  root.addChild(g);
  return root;
}

function seven(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  g.moveTo(size * 0.3, size * 0.25).lineTo(size * 0.5, size * 0.15).lineTo(size * 0.52, size * 0.85).stroke({ width: size * 0.08, color: 0xffd166 });
  root.addChild(g);
  return root;
}

function bell(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  g.arc(size / 2, size * 0.5, size * 0.18, 0, Math.PI * 2, false).fill(0xb07a1f);
  g.rect(size * 0.42, size * 0.68, size * 0.16, size * 0.2).fill(0xffd166);
  g.rect(size * 0.47, size * 0.84, size * 0.06, size * 0.1).fill(0xb07a1f);
  g.circle(size / 2, size * 0.42, size * 0.03).fill({ color: 0xffffff, alpha: 0.8 });
  root.addChild(g);
  return root;
}

function clover(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, GREEN));
  const g = new Graphics();
  g.circle(size * 0.38, size * 0.42, size * 0.09).fill(GREEN);
  g.circle(size * 0.52, size * 0.42, size * 0.09).fill(GREEN);
  g.circle(size * 0.38, size * 0.32, size * 0.09).fill(GREEN);
  g.circle(size * 0.52, size * 0.32, size * 0.09).fill(GREEN);
  g.rect(size * 0.45, size * 0.22, size * 0.1, size * 0.12).fill(0x2d6a4f);
  root.addChild(g);
  return root;
}

function crown(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  g.moveTo(size * 0.3, size * 0.5).lineTo(size * 0.35, size * 0.2).lineTo(size * 0.4, size * 0.5).lineTo(size * 0.45, size * 0.2).lineTo(size * 0.5, size * 0.5).lineTo(size * 0.55, size * 0.2).lineTo(size * 0.6, size * 0.5).lineTo(size * 0.65, size * 0.2).lineTo(size * 0.7, size * 0.5).stroke({ width: size * 0.05, color: 0xffd166 });
  g.circle(size * 0.36, size * 0.2, size * 0.03).fill(0xffd166);
  g.circle(size * 0.46, size * 0.2, size * 0.03).fill(0xffd166);
  g.circle(size * 0.56, size * 0.2, size * 0.03).fill(0xffd166);
  g.circle(size * 0.64, size * 0.2, size * 0.03).fill(0xffd166);
  root.addChild(g);
  return root;
}

function wild(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0x8b5cf6));
  const g = new Graphics();
  g.moveTo(size * 0.35, size * 0.3).lineTo(size * 0.5, size * 0.5).lineTo(size * 0.65, size * 0.3).stroke({ width: size * 0.06, color: 0xffd166 });
  g.moveTo(size * 0.5, size * 0.5).lineTo(size * 0.35, size * 0.7).lineTo(size * 0.65, size * 0.7).stroke({ width: size * 0.06, color: 0xffd166 });
  root.addChild(g);
  return root;
}

function star(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.18;
  const points: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  g.poly(points).fill(0xffd166);
  root.addChild(g);
  return root;
}

function diamond(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0x2ee6c8));
  const g = new Graphics();
  g.moveTo(size / 2, size * 0.25).lineTo(size * 0.75, size / 2).lineTo(size / 2, size * 0.75).lineTo(size * 0.25, size / 2).stroke({ width: size * 0.05, color: 0x2ee6c8 });
  g.moveTo(size / 2, size * 0.25).lineTo(size / 2, size * 0.75).stroke({ width: size * 0.03, color: 0xffffff, alpha: 0.5 });
  g.moveTo(size * 0.25, size / 2).lineTo(size * 0.75, size / 2).stroke({ width: size * 0.03, color: 0xffffff, alpha: 0.5 });
  root.addChild(g);
  return root;
}

function horseshoe(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0xffd166));
  const g = new Graphics();
  g.arc(size / 2, size * 0.62, size * 0.2, 0.2 * Math.PI, 0.8 * Math.PI, false).stroke({ width: size * 0.08, color: 0xffd166, cap: 'round' });
  g.circle(size * 0.32, size * 0.45, size * 0.02).fill(0xffd166);
  g.circle(size * 0.68, size * 0.45, size * 0.02).fill(0xffd166);
  root.addChild(g);
  return root;
}

function plum(size: number): Container {
  const root = new Container();
  root.addChild(plate(size, 0x8b5cf6));
  const g = new Graphics();
  g.ellipse(size / 2, size / 2, size * 0.18, size * 0.22).fill(0x6b21a8);
  g.circle(size * 0.42, size * 0.38, size * 0.03).fill({ color: 0xffffff, alpha: 0.8 });
  root.addChild(g);
  return root;
}

export const EXTRA_SYMBOLS: Readonly<Record<string, (size: number) => Container>> = {
  CHERRIES: cherries,
  LEMON: lemon,
  ORANGE: orange,
  GRAPE: grape,
  WATERMELON: watermelon,
  SEVEN: seven,
  BELL: bell,
  CLOVER: clover,
  CROWN: crown,
  WILD: wild,
  STAR: star,
  DIAMOND: diamond,
  HORSESHOE: horseshoe,
  PLUM: plum,
};
