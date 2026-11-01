// @loc-exception: Pixel-Rig, Gesicht, Outfit und Sticker teilen dieselbe Figur; getrennt waeren die Zustandswechsel unsichtbar.
/** Pixel-Raster statt Vektorglanz: blockige Figur, echte Gelenke, klare Zustaende. */
import { Container, Graphics, Text } from 'pixi.js';
import type { GuestEmotion } from '../core/sim/emotion';
import type { PlayerLook } from '../core/sim/player-look';
import { INK, ROLE, SHADOW, floorText } from './art-tokens';
import { createComicBubble } from './comic-bubbles';
import { pixelHead } from './pixel-head';
import { poseFor, type ActorState } from './rig-pose';

const PERSONA_COLORS: Record<string, number> = {
  LUMPEN: 0x8d99ae, STREET: 0x00c9a7, STAMMGAST: 0xb06bff, BUSINESS: 0xd6a84b, HIGH_ROLLER: 0xff2e88,
};
const SKINS = [0xf2d3b3, 0xe0b48c, 0xb97c4b, 0x8a5a36, 0xd8a27a];
const HAIRS = [0x2a1a14, 0x5a3a22, 0xd9b35c, 0x1a1020, 0x9a5a2a];
const PANTS = 0x1c1226;
const SHOES = 0x0c0814;
type FaceKind = 'angry' | 'greedy' | 'happy' | 'meh' | 'neutral';

const hex = (value: string): number => Number.parseInt(value.replace('#', ''), 16);

export interface GuestArt {
  readonly root: Container;
  readonly sticker: Container;
  readonly from: { x: number; y: number };
  readonly target: { x: number; y: number };
  moveStart: number;
  readonly phase: number;
  readonly setEmotion: (kind: GuestEmotion) => void;
  readonly setMood: (mood: number, angry: boolean, addiction: number) => void;
  readonly setPersona: (persona: string) => void;
  readonly setName: (name: string) => void;
  readonly setLod: (detail: boolean) => void;
  readonly setState: (state: ActorState) => void;
  readonly setLook: (look: PlayerLook) => void;
  readonly animate: (nowMs: number) => void;
}

const hash = (value: string): number => {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
};

export function createGuestArt(
  persona: string, name: string, isPlayer = false, phase = 0, look?: PlayerLook, portrait = false,
): GuestArt {
  const seed = hash(name || persona);
  let skin = isPlayer ? 0xf2d3b3 : SKINS[seed % SKINS.length]!;
  let hairColor = isPlayer ? 0x2a1a14 : HAIRS[(seed >> 3) % HAIRS.length]!;
  let outfit = isPlayer ? 0x00ffcc : PERSONA_COLORS[persona] ?? 0x9a86b8;
  let accessory = look?.accessory ?? 'NONE';
  const root = new Container();
  const figure = new Container();
  const shadow = new Graphics()
    .ellipse(0, 15, 11, 4).fill({ color: 0x000000, alpha: SHADOW.soft })
    .rect(-9, 14, 18, 2.5).fill({ color: 0x000000, alpha: SHADOW.deep });
  const legs = new Graphics();
  const body = new Graphics();
  const armL = new Graphics();
  const armR = new Graphics();
  const head = new Container();
  const skull = new Graphics();
  const face = new Graphics();
  const hair = new Graphics();
  const legL = new Container();
  const legR = new Container();
  const armLPivot = new Container();
  const armRPivot = new Container();
  legL.position.set(-4, 3);
  legR.position.set(4, 3);
  legL.addChild(legs);
  legR.addChild(new Graphics());
  armLPivot.position.set(-8, -10);
  armRPivot.position.set(8, -10);
  armLPivot.addChild(armL);
  armRPivot.addChild(armR);
  head.position.set(0, -19);
  head.addChild(skull, face, hair);
  const pixel = portrait ? pixelHead(seed, 13) : null;
  if (pixel) {
    pixel.position.set(0, 1);
    head.addChild(pixel);
    skull.visible = false;
    face.visible = false;
    hair.visible = false;
  }
  figure.addChild(shadow, legL, legR, body, armLPivot, armRPivot, head);
  const pin = new Graphics();
  pin.visible = false;
  const nameplate = new Text({ text: isPlayer ? 'DU' : name, style: floorText.name() });
  nameplate.anchor.set(0.5, 0);
  nameplate.position.set(0, 18);
  root.addChild(pin, figure, nameplate);
  const sticker = new Container();
  const bubble = createComicBubble();
  sticker.addChild(bubble.container);
  sticker.visible = false;
  let currentPersona = '';
  let currentName = name;
  let currentMood = -1;
  let currentAngry = false;
  let currentAddiction = -1;
  let currentFace: FaceKind | '' = '';
  let currentEmotion: GuestEmotion = 'NONE';
  let currentState: ActorState = 'idle';
  let currentLook = look ? `${look.skin}|${look.hair}|${look.outfit}|${look.accessory}` : '';
  let detail = true;

  const paintPin = (color: number): void => {
    pin.clear();
    pin.rect(-3, 0, 6, 6).fill(color);
    pin.rect(-2, -4, 4, 4).fill(skin);
    pin.rect(-2, -3, 1, 1).fill(INK);
    pin.rect(1, -3, 1, 1).fill(INK);
    if (isPlayer) pin.rect(-6, -6, 12, 14).stroke({ width: 1, color: ROLE.service, alpha: 0.95 });
  };

  const paintHead = (): void => {
    skull.clear();
    skull.rect(-5, -10, 10, 3).fill(skin);
    skull.rect(-7, -7, 14, 10).fill(skin);
    skull.rect(-5, 3, 10, 2).fill(skin);
  };

  const paintArm = (graphics: Graphics): void => {
    graphics.clear();
    graphics.rect(-1.5, 0, 3, 10).fill(outfit);
    graphics.rect(-1.5, 9, 3, 2).fill(skin);
  };

  const paintLegs = (): void => {
    legs.clear();
    legs.rect(-2, 0, 4, 9).fill(PANTS);
    legs.rect(-2, 9, 5, 3).fill(SHOES);
    const other = legR.children[0] as Graphics;
    other.clear();
    other.rect(-2, 0, 4, 9).fill(PANTS);
    other.rect(-2, 9, 5, 3).fill(SHOES);
  };

  const paintBody = (): void => {
    body.clear();
    // Blockiger Torso: breite Schulter, schmalere Huefte, kein Bogen.
    body.rect(-8, -12, 16, 4).fill(outfit);
    body.rect(-7, -8, 14, 8).fill(outfit);
    body.rect(-6, 0, 12, 4).fill(outfit);
    body.rect(-4, -12, 8, 2).fill({ color: 0xffffff, alpha: 0.18 });
    if (accessory === 'CHAIN') {
      body.rect(-5, -9, 10, 1).fill(0xffd166);
      body.rect(-2, -8, 4, 1).fill(0xffd166);
    }
    if (currentPersona === 'BUSINESS' || currentPersona === 'HIGH_ROLLER') {
      body.rect(-1, -8, 2, 8).fill(0x1a1020);
    } else if (currentPersona === 'STREET') {
      body.rect(-6, -5, 12, 1).fill({ color: 0xffffff, alpha: 0.25 });
    }
  };

  const paintHair = (): void => {
    hair.clear();
    const block = (x: number, y: number, w: number, h: number): void => { hair.rect(x, y, w, h).fill(hairColor); };
    if (accessory === 'CAP') {
      block(-7, -10, 14, 4);
      hair.rect(2, -8, 8, 2).fill(outfit);
    } else if (currentPersona === 'BUSINESS') {
      block(-7, -10, 14, 4);
      block(-4, -12, 8, 2);
    } else if (currentPersona === 'HIGH_ROLLER') {
      hair.rect(-8, -13, 16, 4).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
      hair.rect(-9, -10, 18, 2).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
    } else if (currentPersona === 'STAMMGAST') {
      block(-7, -11, 14, 5);
      block(-8, -8, 3, 4);
    } else if (currentPersona === 'STREET') {
      block(-7, -11, 3, 4);
      block(-2, -12, 3, 3);
      block(3, -11, 4, 4);
    } else {
      block(-7, -10, 14, 3);
      block(-5, -12, 8, 2);
    }
    if (isPlayer && accessory !== 'CAP') {
      hair.rect(-8, -10, 16, 2).fill(outfit);
    }
  };

  const paintFace = (kind: FaceKind): void => {
    face.clear();
    const eye = (x: number): void => {
      face.rect(x - 2, -3, 4, 4).fill(0xffffff);
      face.rect(x - 1, -2, 2, 2).fill(0x171020);
    };
    eye(-3);
    eye(4);
    if (accessory === 'GLASSES') {
      face.rect(-6, -4, 12, 1).fill(0x1a1020);
      face.rect(-6, 0, 12, 1).fill(0x1a1020);
      face.rect(-6, -4, 1, 5).fill(0x1a1020);
      face.rect(5, -4, 1, 5).fill(0x1a1020);
    }
    if (kind === 'angry') {
      face.rect(-6, -6, 5, 1).fill(0x1a1020);
      face.rect(2, -6, 5, 1).fill(0x1a1020);
      face.rect(-2, 2, 5, 1).fill(0x4a1420);
    } else if (kind === 'greedy') {
      face.rect(-6, -6, 4, 1).fill(0x1a1020);
      face.rect(3, -6, 4, 1).fill(0x1a1020);
      face.rect(-1, 2, 4, 2).fill(0x4a1420);
      face.rect(1, 2, 1, 1).fill(0xff6b81);
    } else if (kind === 'happy') {
      face.rect(-2, 2, 5, 1).fill(0x6a2030);
      face.rect(-1, 3, 3, 1).fill(0x6a2030);
    } else if (kind === 'meh') {
      face.rect(-6, -6, 11, 1).fill(skin);
      face.rect(-2, 3, 4, 1).fill(0x5a2030);
    } else {
      face.rect(-2, 3, 5, 1).fill(0x6a2030);
    }
  };

  const paintLook = (next: PlayerLook): void => {
    skin = hex(next.skin);
    hairColor = hex(next.hair);
    outfit = hex(next.outfit);
    accessory = next.accessory;
    currentLook = `${next.skin}|${next.hair}|${next.outfit}|${next.accessory}`;
    paintHead();
    paintBody();
    paintHair();
    paintFace(currentFace || 'neutral');
    paintPin(outfit);
    paintArm(armL);
    paintArm(armR);
  };

  const setPersona = (next: string): void => {
    if (next === currentPersona) return;
    currentPersona = next;
    if (!isPlayer) {
      outfit = PERSONA_COLORS[next] ?? 0x9a86b8;
      hairColor = HAIRS[(seed >> 3) % HAIRS.length]!;
      skin = SKINS[seed % SKINS.length]!;
    }
    paintHead();
    paintBody();
    paintHair();
    paintPin(outfit);
    paintArm(armL);
    paintArm(armR);
    currentFace = '';
    if (currentMood >= 0) setMood(currentMood, currentAngry, currentAddiction);
  };

  const setMood = (mood: number, angry: boolean, addiction: number): void => {
    const kind: FaceKind = angry || mood < 25 ? 'angry' : addiction >= 60 && mood >= 40 ? 'greedy'
      : mood > 70 ? 'happy' : mood < 45 ? 'meh' : 'neutral';
    currentMood = mood;
    currentAngry = angry;
    currentAddiction = addiction;
    if (kind === currentFace) return;
    currentFace = kind;
    paintFace(kind);
  };

  const setEmotion = (kind: GuestEmotion): void => {
    currentEmotion = kind;
    bubble.set(kind);
    sticker.visible = detail && kind !== 'NONE';
  };

  const setLod = (next: boolean): void => {
    if (next === detail) return;
    detail = next;
    figure.visible = next;
    pin.visible = !next;
    nameplate.visible = next;
    sticker.visible = next && currentEmotion !== 'NONE';
    if (!next) bubble.container.visible = false;
    else { bubble.set(currentEmotion); bubble.container.visible = currentEmotion !== 'NONE'; }
  };

  const setName = (next: string): void => {
    if (next === currentName) return;
    currentName = next;
    nameplate.text = next.length > 16 ? `${next.slice(0, 15)}…` : next;
  };

  const setState = (next: ActorState): void => { currentState = next; };

  const animate = (nowMs: number): void => {
    const pose = poseFor(currentState, nowMs, phase);
    figure.y = pose.bob;
    figure.rotation = pose.lean;
    head.y = -19 + pose.headY;
    head.rotation = pose.headRot;
    armLPivot.rotation = pose.armL;
    armRPivot.rotation = pose.armR;
    legL.rotation = pose.legL;
    legR.rotation = pose.legR;
    figure.y -= pose.hop;
  };

  paintLegs();
  paintArm(armL);
  paintArm(armR);
  setPersona(persona);
  if (look) paintLook(look);
  setMood(60, false, 0);
  paintFace('neutral');
  setLod(true);
  setEmotion('NONE');
  animate(0);

  return {
    root, sticker, from: { x: 0, y: 0 }, target: { x: 0, y: 0 }, moveStart: 0, phase,
    setEmotion, setMood, setPersona, setName, setLod, setState, animate,
    setLook: (next) => {
      const key = `${next.skin}|${next.hair}|${next.outfit}|${next.accessory}`;
      if (key === currentLook) return;
      paintLook(next);
    },
  };
}
