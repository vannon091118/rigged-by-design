/** Kleine Comic-Sprechblase: eine Grafik statt eines Satzes, pro Figur gepoolt. */
import { Container, Graphics, Text } from 'pixi.js';
import type { GuestEmotion } from '../core/sim/emotion';

interface ComicBubble {
  readonly container: Container;
  readonly set: (kind: GuestEmotion) => void;
}

const PAPER = 0xf8f2e8;
const INK = 0x1a1020;

function drawIcon(g: Graphics, kind: GuestEmotion): void {
  if (kind === 'SLOT') {
    g.roundRect(-9, -56, 18, 9, 2).fill(0x140a24).stroke({ width: 1, color: 0xffd166 });
    for (let i = 0; i < 3; i += 1) g.circle(-5 + i * 5, -51.5, 2).fill(i === 1 ? 0xff2e88 : 0xffd166);
    g.rect(10, -56, 1.5, 6).fill(0xffd166);
  } else if (kind === 'JACKPOT') {
    g.poly([0, -58, 8, -51, 0, -44, -8, -51]).fill(0x54e0ff).stroke({ width: 1, color: INK });
    g.moveTo(-12, -60).lineTo(-9, -57).stroke({ width: 1, color: 0xffd166 });
    g.moveTo(12, -60).lineTo(9, -57).stroke({ width: 1, color: 0xffd166 });
  } else if (kind === 'ADDICTED') {
    g.circle(-3.5, -54, 4).fill(0xff4d6d);
    g.circle(3.5, -54, 4).fill(0xff4d6d);
    g.poly([-7.5, -52, 7.5, -52, 0, -43]).fill(0xff4d6d);
    g.poly([8, -46, 12, -51, 10, -43]).fill(0xff9d3d);
  } else if (kind === 'DRINK') {
    g.roundRect(-7, -57, 12, 13, 2).fill(0xffc44d).stroke({ width: 1, color: INK });
    g.circle(7, -51, 4).stroke({ width: 2, color: 0xffc44d });
    g.rect(-7, -57, 12, 3).fill(0xfff4d0);
    g.circle(-3, -47, 1).fill(PAPER);
    g.circle(2, -49, 1).fill(PAPER);
  } else if (kind === 'TOILET') {
    g.roundRect(-7, -58, 10, 4, 1).fill(0xd8e8f0).stroke({ width: 1, color: INK });
    g.roundRect(-8, -53, 13, 7, 3).fill(0xd8e8f0).stroke({ width: 1, color: INK });
    g.ellipse(0, -51.5, 4, 2).fill(0x7fb7d8);
  } else if (kind === 'DIRTY') {
    g.moveTo(-9, -56).quadraticCurveTo(-5, -59, -2, -55).quadraticCurveTo(1, -51, 3, -54)
      .stroke({ width: 1.6, color: 0x6ac46a });
    g.circle(6, -52, 1.5).fill(0x5a9a3a);
    g.circle(-6, -48, 1.1).fill(0x5a9a3a);
    g.moveTo(8, -47).lineTo(12, -47).stroke({ width: 1.4, color: 0x8a6a4a });
  } else if (kind === 'ANGRY') {
    g.rect(-1, -58, 2.4, 7).fill(0xff4d5e);
    g.circle(0.2, -48, 1.4).fill(0xff4d5e);
    g.moveTo(-9, -57).lineTo(-4, -54).stroke({ width: 1.2, color: 0xff4d5e });
    g.moveTo(9, -57).lineTo(4, -54).stroke({ width: 1.2, color: 0xff4d5e });
  } else if (kind === 'CASH') {
    g.roundRect(-9, -56, 18, 10, 2).fill(0x7fdf9a).stroke({ width: 1, color: INK });
    g.circle(0, -51, 3).stroke({ width: 1, color: 0x214a2a });
    g.rect(-7, -54, 2, 1).fill(0x214a2a);
    g.rect(5, -48, 2, 1).fill(0x214a2a);
  } else if (kind === 'WAIT') {
    g.circle(0, -52, 7).fill(0xf5f0ff).stroke({ width: 1.2, color: INK });
    g.moveTo(0, -52).lineTo(0, -57).stroke({ width: 1.4, color: INK });
    g.moveTo(0, -52).lineTo(3.5, -50).stroke({ width: 1.4, color: INK });
  }
}

/** Eine Sprechblase mit Satz statt Icon: die Laune bekommt eine Stimme. */
interface ComicNote {
  readonly container: Container;
  readonly set: (text: string | null) => void;
}

function createComicNote(): ComicNote {
  const container = new Container();
  const bg = new Graphics();
  const label = new Text({
    text: '',
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: INK },
  });
  label.anchor.set(0.5, 0.5);
  label.position.set(0, -55);
  container.addChild(bg, label);
  container.visible = false;
  let current: string | null = null;

  const set = (text: string | null): void => {
    if (text === current) return;
    current = text;
    bg.clear();
    label.text = text ?? '';
    container.visible = text !== null;
    if (text === null) return;
    const width = label.width + 12;
    bg.roundRect(-width / 2, -64, width, 17, 6).fill(PAPER).stroke({ width: 1.2, color: INK });
    bg.poly([-3, -47, 3, -47, 0, -40]).fill(PAPER).stroke({ width: 1, color: INK });
  };

  return { container, set };
}

/** Sticker einer Figur: Icon-Bubble oder Satz bei schlechter Laune. */
interface ComicSticker {
  readonly container: Container;
  readonly set: (kind: GuestEmotion, lowMood: boolean, visible: boolean) => void;
}

export function createComicSticker(): ComicSticker {
  const container = new Container();
  const bubble = createComicBubble();
  const note = createComicNote();
  container.addChild(bubble.container, note.container);
  container.visible = false;

  const set = (kind: GuestEmotion, lowMood: boolean, visible: boolean): void => {
    note.set(lowMood ? 'Hier stimmt was nicht' : null);
    const show = visible && (lowMood || kind !== 'NONE');
    container.visible = show;
    note.container.visible = show && lowMood;
    bubble.container.visible = show && !lowMood;
    if (!lowMood) bubble.set(kind);
  };

  return { container, set };
}

function createComicBubble(): ComicBubble {
  const container = new Container();
  const bg = new Graphics();
  const icon = new Graphics();
  container.addChild(bg, icon);
  container.visible = false;
  let current: GuestEmotion | '' = '';

  const set = (kind: GuestEmotion): void => {
    if (kind === current) return;
    current = kind;
    bg.clear();
    icon.clear();
    const visible = kind !== 'NONE';
    container.visible = visible;
    if (!visible) return;
    if (kind === 'ANGRY') {
      const points: number[] = [];
      for (let i = 0; i < 14; i += 1) {
        const angle = (i / 14) * Math.PI * 2;
        const radius = i % 2 === 0 ? 22 : 16;
        points.push(Math.cos(angle) * radius, -51 + Math.sin(angle) * radius * 0.72);
      }
      bg.poly(points).fill(0xffe1e4).stroke({ width: 1.4, color: 0x8a2030 });
      bg.poly([-4, -38, 4, -38, 1, -31]).fill(0xffe1e4).stroke({ width: 1.2, color: 0x8a2030 });
    } else {
      bg.roundRect(-19, -64, 38, 25, 9).fill(PAPER).stroke({ width: 1.3, color: INK });
      bg.poly([-4, -40, 4, -40, 0, -33]).fill(PAPER).stroke({ width: 1.1, color: INK });
    }
    drawIcon(icon, kind);
  };

  return { container, set };
}
