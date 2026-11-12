/** Bemalung der Pixelfigur: Palette, Persona-Farben, Koerper, Beine, Arme und Pin. */
import { Sprite, Texture } from 'pixi.js';
import type { LookAccessory, PlayerLook } from '../core/sim/player-look';
import { drawActorSilhouette } from './actor-silhouette';
import { ROLE } from './art-tokens';
import { mountHead, paintFace as drawFace, paintHair, paintSkull, type FaceKind, type HeadHair } from './guest-head';
import { HAIRS, PANTS, PERSONA_COLORS, SHOES, SKINS } from './guest-parts';
import { textureFor } from './assets/textures';
import type { GuestRigNodes } from './guest-rig';

const hex = (value: string): number => Number.parseInt(value.replace('#', ''), 16);

/** Atlas-Teile sind etwa dreimal so gross wie die alte Graphics-Zeichnung. */
const PART_SCALE = 0.34;
const BODY_FRAME = 'characters/torso-outfit-01.png';
const ARM_FRAME = 'characters/arm-segment-01.png';
const LEG_FRAME = 'characters/leg-segment-01.png';
const FOOTWEAR_FRAME = 'characters/footwear-part-01.png';

interface PaintOptions {
  readonly seed: number;
  readonly isPlayer: boolean;
  readonly persona: string;
  readonly portrait: boolean;
  readonly look?: PlayerLook;
}

export class GuestPaint {
  readonly #nodes: GuestRigNodes;
  readonly #seed: number;
  readonly #isPlayer: boolean;
  readonly #headSprite: Sprite | null;
  #skin: number;
  #hairColor: number;
  #outfit: number;
  #accessory: LookAccessory;
  #persona = '';

  constructor(nodes: GuestRigNodes, options: PaintOptions) {
    const { seed, isPlayer, persona, portrait, look } = options;
    this.#nodes = nodes;
    this.#seed = seed;
    this.#isPlayer = isPlayer;
    this.#skin = isPlayer ? 0xf2d3b3 : SKINS[seed % SKINS.length]!;
    this.#hairColor = isPlayer ? 0x2a1a14 : HAIRS[(seed >> 3) % HAIRS.length]!;
    this.#outfit = isPlayer ? 0x00ffcc : PERSONA_COLORS[persona] ?? 0x9a86b8;
    this.#accessory = look?.accessory ?? 'NONE';
    this.#headSprite = mountHead(nodes.head, [nodes.skull, nodes.face, nodes.hair], seed, portrait);

    this.#setupPart(nodes.body, BODY_FRAME, 0.5, 0.5, 4, 4);
    this.#setupPart(nodes.legs, LEG_FRAME, 0.5, 0, 4, 9);
    this.#setupPart(nodes.legOther, LEG_FRAME, 0.5, 0, 4, 9);
    this.#setupPart(nodes.armL, ARM_FRAME, 0.5, 0, 3, 10);
    this.#setupPart(nodes.armR, ARM_FRAME, 0.5, 0, 3, 10);
    this.#setupPart(nodes.footwearL, FOOTWEAR_FRAME, 0.5, 0.5, 3, 2);
    this.#setupPart(nodes.footwearR, FOOTWEAR_FRAME, 0.5, 0.5, 3, 2);

    this.setPersona(persona);
    if (look) this.setLook(look, 'neutral');
  }

  /** Liefert false, wenn die Persona schon stand; das Gesicht bleibt dann Sache des Aufrufers. */
  setPersona(next: string): boolean {
    if (next === this.#persona) return false;
    this.#persona = next;
    if (!this.#isPlayer) {
      this.#outfit = PERSONA_COLORS[next] ?? 0x9a86b8;
      this.#hairColor = HAIRS[(this.#seed >> 3) % HAIRS.length]!;
      this.#skin = SKINS[this.#seed % SKINS.length]!;
    }
    this.#paintHead();
    this.#applyBodyColors();
    paintHair(this.#nodes.hair, this.#hairState());
    this.#paintPin();
    return true;
  }

  /** Look des Spielers: dieselben Flaechen, nur andere Farben und ein Accessoire. */
  setLook(next: PlayerLook, face: FaceKind | ''): void {
    this.#skin = hex(next.skin);
    this.#hairColor = hex(next.hair);
    this.#outfit = hex(next.outfit);
    this.#accessory = next.accessory;
    this.#paintHead();
    this.#applyBodyColors();
    paintHair(this.#nodes.hair, this.#hairState());
    this.paintFace(face || 'neutral');
    this.#paintPin();
  }

  paintFace(kind: FaceKind): void {
    drawFace(this.#nodes.face, kind, this.#skin, this.#accessory);
  }

  #hairState(): HeadHair {
    return {
      hair: this.#hairColor, outfit: this.#outfit, persona: this.#persona,
      accessory: this.#accessory, isPlayer: this.#isPlayer,
    };
  }

  /** Kopf-Textur oder Pixelkopf liegt ueber dem Schaedel; dann bleibt er leer. */
  #paintHead(): void {
    if (this.#headSprite) return;
    paintSkull(this.#nodes.skull, this.#skin);
  }

  /** Koerper- und Gliedmasse-Farben auf die Sprite-Tinte uebertragen. */
  #applyBodyColors(): void {
    this.#nodes.body.tint = this.#outfit;
    this.#nodes.armL.tint = this.#outfit;
    this.#nodes.armR.tint = this.#outfit;
    this.#nodes.legs.tint = PANTS;
    this.#nodes.legOther.tint = PANTS;
    this.#nodes.footwearL.tint = SHOES;
    this.#nodes.footwearR.tint = SHOES;
  }

  /** Baut ein Sprite-Teil aus dem Charakter-Atlas; ohne Textur bleibt ein farbiger Block. */
  #setupPart(node: Sprite, path: string, ax: number, ay: number, fbW: number, fbH: number): void {
    const texture = textureFor(path);
    node.texture = texture ?? Texture.WHITE;
    node.anchor.set(ax, ay);
    if (texture) {
      node.scale.set(PART_SCALE);
    } else {
      node.scale.set(fbW, fbH);
    }
  }

  #paintPin(): void {
    const { pin } = this.#nodes;
    pin.clear();
    drawActorSilhouette(pin, this.#outfit, this.#skin);
    if (this.#isPlayer) pin.circle(0, -8, 9).stroke({ width: 1, color: ROLE.service, alpha: 0.95 });
  }
}
