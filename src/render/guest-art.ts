/** Pixel-Figur: Rig, Bemalung und Sticker hinter einer Fassade; die Buehne liest nur diese. */
import type { Container } from 'pixi.js';
import type { GuestEmotion } from '../core/sim/emotion';
import type { PlayerLook } from '../core/sim/player-look';
import { createComicSticker } from './comic-bubbles';
import type { FaceKind } from './guest-head';
import { GuestPaint } from './guest-paint';
import { GuestRig } from './guest-rig';
import { hash } from './guest-parts';
import type { ActorState } from './rig-pose';
import type { Facing } from './locomotion';

export interface GuestArt {
  readonly root: Container;
  readonly sticker: Container;
  readonly from: { x: number; y: number };
  readonly target: { x: number; y: number };
  moveStart: number;
  readonly phase: number;
  /** Letzte Blickrichtung; Stillstand behaelt sie bei. */
  readonly facing: Facing;
  readonly setEmotion: (kind: GuestEmotion) => void;
  readonly setMood: (mood: number, angry: boolean, addiction: number) => void;
  readonly setPersona: (persona: string) => void;
  readonly setName: (name: string) => void;
  /** Namensschild nur fuer den Gast, der gerade dran ist. */
  readonly setNameVisible: (visible: boolean) => void;
  readonly setLod: (detail: boolean) => void;
  readonly setState: (state: ActorState) => void;
  readonly setLook: (look: PlayerLook) => void;
  /** Blickrichtung aus der Bewegung; spiegelt nur die Figur. */
  readonly setFacing: (facing: Facing) => void;
  /** Kurzer Squash beim Antippen. */
  readonly bump: () => void;
  /** Ring am Fuss, der den Treffer zeigt. */
  readonly tapRing: () => void;
  readonly animate: (nowMs: number) => void;
}

export function createGuestArt(
  persona: string, name: string, isPlayer = false, phase = 0, look?: PlayerLook, portrait = false,
): GuestArt {
  const seed = hash(name || persona);
  const rig = new GuestRig(isPlayer, name);
  const paint = new GuestPaint(rig.nodes, { seed, isPlayer, persona, portrait, look });
  const sticker = createComicSticker();
  let currentName = name;
  let currentMood = -1;
  let currentAngry = false;
  let currentAddiction = -1;
  let currentFace: FaceKind | '' = '';
  let currentEmotion: GuestEmotion = 'NONE';
  let currentState: ActorState = 'idle';
  let currentLook = look ? `${look.skin}|${look.hair}|${look.outfit}|${look.accessory}` : '';
  let moodLow = false;
  let facing: Facing = 'right';

  /** Laune unter 40 bekommt eine Sprechblase statt einer Zahl. */
  const applySticker = (): void => sticker.set(currentEmotion, moodLow, rig.detail);

  const setMood = (mood: number, angry: boolean, addiction: number): void => {
    const kind: FaceKind = angry || mood < 25 ? 'angry' : addiction >= 60 && mood >= 40 ? 'greedy'
      : mood > 70 ? 'happy' : mood < 45 ? 'meh' : 'neutral';
    currentMood = mood;
    currentAngry = angry;
    currentAddiction = addiction; moodLow = mood < 40;
    applySticker();
    if (kind === currentFace) return;
    currentFace = kind;
    paint.paintFace(kind);
  };

  const setPersona = (next: string): void => {
    if (!paint.setPersona(next)) return;
    currentFace = '';
    if (currentMood >= 0) setMood(currentMood, currentAngry, currentAddiction);
  };

  const setEmotion = (kind: GuestEmotion): void => { currentEmotion = kind; applySticker(); };
  const setLod = (next: boolean): void => {
    if (next === rig.detail) return;
    rig.setDetail(next);
    applySticker();
  };
  const setName = (next: string): void => {
    if (next === currentName) return;
    currentName = next;
    rig.setName(next);
  };
  const setNameVisible = (next: boolean): void => { rig.setNameVisible(next); };
  const setState = (next: ActorState): void => { currentState = next; };
  const setFacing = (next: Facing): void => { facing = next; rig.setFacing(next); };
  const bump = (): void => { rig.bump(); };
  const tapRing = (): void => { rig.tapRing(); };
  const animate = (nowMs: number): void => { rig.animate(nowMs, currentState, phase); };

  setMood(60, false, 0);
  paint.paintFace('neutral');
  setEmotion('NONE');
  rig.animate(0, currentState, phase);

  return {
    root: rig.root, sticker: sticker.container, from: { x: 0, y: 0 }, target: { x: 0, y: 0 }, moveStart: 0, phase,
    setEmotion, setMood, setPersona, setName, setNameVisible, setLod, setState, setFacing, bump, tapRing, animate,
    get facing() { return facing; },
    setLook: (next) => {
      const key = `${next.skin}|${next.hair}|${next.outfit}|${next.accessory}`;
      if (key === currentLook) return;
      currentLook = key;
      paint.setLook(next, currentFace);
    },
  };
}
