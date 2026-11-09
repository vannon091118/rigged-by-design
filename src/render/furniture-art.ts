/** Moebel: der Korpus kommt aus dem Atlas, nur Zustand und Sitze bleiben dynamisch. */
import { Container, Graphics, Sprite, Text, type Renderer } from 'pixi.js';
import { gameOf, isCabinet } from '../core/sim/device';
import type { Furniture } from '../core/sim/types';
import { ROLE, SHADOW, STROKE, WORLD_FLATTEN, floorText } from './art-tokens';
import { atlasTextureFor, glowTextureFor } from './furniture-atlas';

export interface FurnitureArt {
  readonly root: Container;
  readonly setResult: (value: string) => void;
  readonly setDetail: (detail: boolean) => void;
  /** Druck-Rueckmeldung: der Glow-Ring leuchtet 120 ms auf. */
  readonly flash: (now: number) => void;
  readonly animate: (now: number) => void;
  readonly refresh: (item: Furniture) => void;
}

export function createFurnitureArt(item: Furniture, tile: number, renderer: Renderer): FurnitureArt {
  const root = new Container();
  const w = item.w * tile;
  const h = item.h * tile;
  // Ein Sprite teilt die gebackene Textur mit jeder Instanz derselben Bauart.
  const body = new Sprite(atlasTextureFor(renderer, item, tile));

  // Koerper, Glow und Rahmen haengen an einem Fussanker: der Pivot liegt auf
  // der unteren Kante, gestaucht wird nach oben. Der Kontakt zum Boden bleibt,
  // die Kachelkante fuer Treffer und Tiefe auch.
  const visual = new Container();
  visual.pivot.set(w / 2, h);
  visual.position.set(w / 2, h);
  visual.scale.set(1, WORLD_FLATTEN);
  const contact = new Graphics();
  contact.ellipse(w / 2, h - 1, w * 0.42, Math.max(2, h * 0.12)).fill({ color: 0x000000, alpha: SHADOW.base });

  const occupied = new Graphics();
  occupied.roundRect(-1, -1, w + 2, h + 2, 6).stroke({ width: STROKE.base, color: ROLE.service, alpha: 0.7 });
  occupied.visible = false;

  const glow = new Sprite(glowTextureFor(renderer));
  glow.width = w + 10;
  glow.height = h + 10;
  glow.position.set(-5, -5);
  glow.alpha = 0;
  glow.visible = false;

  const status = new Graphics();
  const screen = new Text({ text: isCabinet(item) ? 'BEREIT' : gameOf(item) ?? '', style: floorText.screen() });
  screen.anchor.set(0.5, 0.5);
  screen.position.set(w / 2, h * 0.68 * WORLD_FLATTEN);
  const label = new Text({ text: item.label, style: floorText.name() });
  label.anchor.set(0.5, 0);
  label.position.set(w / 2, h + 2);
  visual.addChild(contact, body, glow, occupied);
  // Text bleibt ungestaucht: lesbar geht vor perspektivisch.
  root.addChild(visual, status, screen, label);

  let lastBucket = -2;
  let lastOccupants = -1;
  let lastMods = -1;
  let lastDamaged = false;
  let rawResult = '';
  let shownResult = '';
  let detail = true;
  let wasOccupied = false;
  let flashStart = -1;

  const flash = (now: number): void => { flashStart = now; glow.visible = true; glow.alpha = 0.5; };
  const animate = (now: number): void => {
    if (flashStart < 0) return;
    const t = now - flashStart;
    if (t >= 120) { flashStart = -1; glow.visible = false; glow.alpha = 0; return; }
    glow.alpha = 0.5 * (1 - t / 120);
  };

  const refresh = (next: Furniture): void => {
    const occupiedNow = next.occupants.length > 0;
    if (occupiedNow !== wasOccupied) {
      wasOccupied = occupiedNow;
      occupied.visible = occupiedNow && detail;
    }
    const bucket = next.damaged ? -2 : next.condition < 55 ? Math.floor(next.condition / 5) : -1;
    const occupants = next.occupants.length;
    const mods = next.mods.length;
    if (bucket === lastBucket && occupants === lastOccupants && mods === lastMods && next.damaged === lastDamaged) return;
    lastBucket = bucket;
    lastOccupants = occupants;
    lastMods = mods;
    lastDamaged = next.damaged;
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
      // Uebersicht: dieselbe Silhouette, nur leiser und ohne Text.
      body.alpha = next ? 1 : 0.85;
      glow.visible = next && flashStart >= 0;
      label.visible = next;
      screen.visible = next;
      status.visible = next;
      occupied.visible = next && wasOccupied;
    },
    flash,
    animate,
    refresh,
  };
}
