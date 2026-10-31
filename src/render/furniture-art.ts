/** Moebel: statischer Korpus als GPU-Textur, nur Zustand und Sitze bleiben dynamisch. */
import { Container, Graphics, Text } from 'pixi.js';
import type { Furniture } from '../core/sim/types';
import { INK, LIGHT, ROLE, STROKE, floorText, furnitureTone } from './art-tokens';

export interface FurnitureArt {
  readonly root: Container;
  readonly setResult: (value: string) => void;
  readonly setDetail: (detail: boolean) => void;
  readonly refresh: (item: Furniture) => void;
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

export function createFurnitureArt(item: Furniture, tile: number): FurnitureArt {
  const root = new Container();
  const body = new Container();
  const w = item.w * tile;
  const h = item.h * tile;
  const tone = furnitureTone(item.kind);
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
  if (item.kind === 'SLOT') drawSlot(g, w, h);
  else if (item.kind === 'TABLE') drawTable(g, w, h, item.seats);
  else if (item.kind === 'BAR') drawBar(g, w, h);
  else if (item.kind === 'TOILET') drawToilet(g, w, h, item.seats);
  else if (item.kind === 'EXCHANGE') drawExchange(g, w, h);
  else if (item.kind === 'STORAGE') drawStorage(g, w, h);
  else if (item.kind === 'DECOR') drawDecor(g, w, h, item.label);
  // Lichtinsel unter wichtigen Objekten: das Geraet steht im Licht, nicht im Nichts.
  const pool = new Graphics();
  if (item.kind === 'EXCHANGE' || item.kind === 'BAR' || item.gameId) {
    pool.ellipse(w / 2, h / 2, w * 0.9, h * 0.85).fill({ color: tone.edge, alpha: 0.045 });
    pool.ellipse(w / 2, h / 2, w * 0.6, h * 0.55).fill({ color: LIGHT.warm, alpha: 0.04 });
  }
  body.addChild(pool, shadow, g);
  body.cacheAsTexture(true);

  // Uebersicht: dieselbe Formsprache als Block mit Lichtkante und Fuss.
  const marker = new Graphics();
  marker.roundRect(0, 0, w, h, 3).fill({ color: tone.block, alpha: 0.84 })
    .stroke({ width: 1, color: INK, alpha: 0.8 });
  marker.roundRect(1, 1, w - 2, 3, 2).fill({ color: LIGHT.warm, alpha: 0.22 });
  marker.rect(0, h - 3, w, 3).fill({ color: INK, alpha: 0.32 });
  marker.visible = false;

  const occupied = new Graphics();
  occupied.roundRect(-1, -1, w + 2, h + 2, 6).stroke({ width: STROKE.base, color: ROLE.service, alpha: 0.7 });
  occupied.visible = false;

  const status = new Graphics();
  const screen = new Text({ text: item.kind === 'SLOT' ? 'BEREIT' : item.gameId ?? '', style: floorText.screen() });
  screen.anchor.set(0.5, 0.5);
  screen.position.set(w / 2, h * 0.68);
  const label = new Text({ text: item.label, style: floorText.name() });
  label.anchor.set(0.5, 0);
  label.position.set(w / 2, h + 2);
  root.addChild(body, marker, occupied, status, screen, label);

  let lastBucket = -2;
  let lastOccupants = -1;
  let lastMods = -1;
  let lastDamaged = false;
  let rawResult = '';
  let shownResult = '';
  let detail = true;
  let wasOccupied = false;

  const refresh = (next: Furniture): void => {
    const occupiedNow = next.occupants.length > 0;
    if (occupiedNow !== wasOccupied) {
      wasOccupied = occupiedNow;
      occupied.visible = occupiedNow;
    }
    const bucket = next.damaged ? -2 : next.condition < 55 ? Math.floor(next.condition / 5) : -1;
    const occupants = next.occupants.length;
    const mods = next.mods.length;
    if (bucket === lastBucket && occupants === lastOccupants && mods === lastMods && next.damaged === lastDamaged) return;
    lastBucket = bucket;
    lastOccupants = occupants;
    lastMods = mods;
    lastDamaged = next.damaged;
    marker.tint = next.damaged ? ROLE.danger : 0xffffff;
    status.clear();
    if (next.damaged) {
      status.moveTo(w * 0.28, h * 0.28).lineTo(w * 0.72, h * 0.72).stroke({ width: 2.5, color: ROLE.danger });
      status.moveTo(w * 0.72, h * 0.28).lineTo(w * 0.28, h * 0.72).stroke({ width: 2.5, color: ROLE.danger });
    } else if (next.condition < 55) {
      status.rect(w * 0.22, h * 0.14, 2, h * 0.5).fill({ color: ROLE.warning, alpha: 0.75 });
      status.rect(w * 0.35, h * 0.28, 1.5, h * 0.22).fill({ color: ROLE.warning, alpha: 0.5 });
    }
    const seats = Math.min(6, next.seats);
    for (let seat = 0; seat < seats; seat += 1) {
      const taken = next.occupants.length > seat;
      status.circle(6 + seat * 7, h - 6, 2.2).fill(taken ? ROLE.service : 0x3a2a50);
    }
    for (let mod = 0; mod < next.mods.length; mod += 1) {
      status.circle(w - 6 - mod * 7, 6, 2.2).fill(ROLE.identity);
    }
  };

  return {
    root,
    setResult: (value) => {
      if (value === rawResult) return;
      rawResult = value;
      const next = value.toUpperCase().slice(0, 11);
      if (next === shownResult) return;
      shownResult = next;
      screen.text = next;
    },
    setDetail: (next) => {
      if (next === detail) return;
      detail = next;
      body.visible = next;
      marker.visible = !next;
      label.visible = next;
      screen.visible = next;
      status.visible = next;
    },
    refresh,
  };
}
