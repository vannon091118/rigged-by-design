/** Bemalung der Pixelfigur: Palette, Persona-Farben, Koerper, Beine, Arme und Pin. */
import { Graphics, Sprite, Texture } from 'pixi.js';
import type { LookAccessory, PlayerLook } from '../core/sim/player-look';
import {
  LOD_SPRITE_SHEET, drawActorSilhouette, lodHairColor, lodTextureFor, silhouetteHeadFor, type LodSpriteLayer,
} from './actor-silhouette';
import { ROLE } from './art-tokens';
import { mountHead, paintFace as drawFace, paintHair, paintLookHair, paintSkull, type FaceKind, type HeadHair } from './guest-head';
import { HAIRS, PANTS, PERSONA_COLORS, SHOES, SKINS, headFamilyFor, headTextureFor, type HeadFamily } from './guest-parts';
import { rigPartsFor } from './rig-parts';
import { textureFor } from './assets/textures';
import type { GuestRigNodes } from './guest-rig';

const hex = (value: string): number => Number.parseInt(value.replace('#', ''), 16);

/** Atlas-Teile sind etwa dreimal so gross wie die alte Graphics-Zeichnung. */
const PART_SCALE = 0.34;

interface PaintOptions {
  readonly seed: number;
  readonly isPlayer: boolean;
  readonly persona: string;
  readonly portrait: boolean;
  readonly look?: PlayerLook;
}

export class GuestPaint {
  readonly #nodes: GuestRigNodes;
  #seed: number;
  readonly #isPlayer: boolean;
  #headSprite: Sprite | null;
  #hairMask: Sprite | null = null;
  readonly #lodBody = new Sprite();
  readonly #lodHead = new Sprite();
  readonly #lodHair = new Sprite();
  readonly #lodSprites = [this.#lodBody, this.#lodHead, this.#lodHair] as const;
  #headFamily: HeadFamily;
  readonly #hairTone = new Graphics();
  readonly #portrait: boolean;
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
    this.#portrait = portrait;
    this.#skin = isPlayer ? 0xf2d3b3 : SKINS[seed % SKINS.length]!;
    this.#hairColor = isPlayer ? 0x2a1a14 : HAIRS[(seed >> 3) % HAIRS.length]!;
    this.#outfit = isPlayer ? 0x00ffcc : PERSONA_COLORS[persona] ?? 0x9a86b8;
    this.#accessory = look?.accessory ?? 'NONE';
    this.#headFamily = look?.head ?? headFamilyFor(headTextureFor(seed)) ?? 'head-01';
    this.#headSprite = mountHead(nodes.head, [nodes.skull, nodes.face, nodes.hair], seed, portrait,
      isPlayer ? this.#headFamily : null);
    for (const sprite of this.#lodSprites) {
      sprite.anchor.set(0, 1);
      sprite.visible = false;
      nodes.lod.addChild(sprite);
    }
    nodes.head.addChild(this.#hairTone);
    this.#syncHairMask();
    this.#applyParts(seed);

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

  /**
   * Pool-Figuren starten ohne Gastnamen; erst beim Ausleihen bekommt der Gast
   * seinen Namens-Seed und damit Kopftextur, Haarton und Fernsilhouette.
   */
  setSeed(seed: number): void {
    if (seed === this.#seed) return;
    this.#seed = seed;
    this.#headFamily = headFamilyFor(headTextureFor(seed)) ?? 'head-01';
    this.#remountHead();
    if (!this.#isPlayer) {
      this.#skin = SKINS[seed % SKINS.length]!;
      this.#hairColor = HAIRS[(seed >> 3) % HAIRS.length]!;
    }
    this.#applyParts(seed);
    this.#paintHead();
    this.#applyBodyColors();
    paintHair(this.#nodes.hair, this.#hairState());
    this.#paintPin();
  }

  /** Rig-Teile folgen dem Seed; Atlastausch nur beim Ausleihen, nicht im Frame. */
  #applyParts(seed: number): void {
    const nodes = this.#nodes;
    const parts = rigPartsFor(seed);
    this.#setupPart(nodes.body, parts.torso, 0.5, 0.5, 4, 4);
    this.#setupPart(nodes.legs, parts.leg, 0.5, 0, 4, 9);
    this.#setupPart(nodes.legOther, parts.leg, 0.5, 0, 4, 9);
    this.#setupPart(nodes.armL, parts.arm, 0.5, 0, 3, 10);
    this.#setupPart(nodes.armR, parts.arm, 0.5, 0, 3, 10);
    this.#setupPart(nodes.footwearL, parts.footwear, 0.5, 0.5, 3, 2);
    this.#setupPart(nodes.footwearR, parts.footwear, 0.5, 0.5, 3, 2);
  }

  /** Look des Spielers: dieselben Flaechen, nur andere Farben und ein Accessoire. */
  setLook(next: PlayerLook, face: FaceKind | ''): void {
    const familyChanged = next.head !== this.#headFamily;
    this.#headFamily = next.head;
    this.#skin = hex(next.skin);
    this.#hairColor = hex(next.hair);
    this.#outfit = hex(next.outfit);
    this.#accessory = next.accessory;
    if (familyChanged) this.#remountHead();
    else this.#paintHead();
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

  /** Kopf-Textur oder Pixelkopf liegt ueber dem Schaedel; der Spieler bekommt seinen Haarton darueber. */
  #paintHead(): void {
    this.#hairTone.clear();
    if (!this.#headSprite) {
      paintSkull(this.#nodes.skull, this.#skin);
      return;
    }
    if (this.#isPlayer) paintLookHair(this.#hairTone, this.#headFamily, this.#hairColor);
  }

  /** Nur ein Familienwechsel tauscht die Textur; Farbwechsel bleiben im Frame. */
  #remountHead(): void {
    const nodes = this.#nodes;
    this.#headSprite?.destroy();
    this.#headSprite = mountHead(nodes.head, [nodes.skull, nodes.face, nodes.hair], this.#seed, this.#portrait,
      this.#isPlayer ? this.#headFamily : null);
    nodes.head.addChild(this.#hairTone);
    this.#syncHairMask();
    this.#paintHead();
  }

  /** Eigene Maske statt der sichtbaren Kopf-Sprite: die Silhouette clippt den Haarton. */
  #syncHairMask(): void {
    this.#hairMask?.destroy();
    this.#hairMask = null;
    this.#hairTone.mask = null;
    if (!this.#headSprite || !this.#isPlayer) return;
    const mask = new Sprite(this.#headSprite.texture);
    mask.width = 14;
    mask.height = 14;
    mask.position.set(-7, -7);
    this.#nodes.head.addChild(mask);
    this.#hairMask = mask;
    this.#hairTone.mask = mask;
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
    const base = textureFor(LOD_SPRITE_SHEET);
    if (base) {
      this.#setLodSprite(this.#lodBody, base, 'body', this.#outfit);
      this.#setLodSprite(this.#lodHead, base, 'head', this.#skin);
      this.#setLodSprite(this.#lodHair, base, 'hair', lodHairColor(this.#hairColor));
    } else {
      for (const sprite of this.#lodSprites) sprite.visible = false;
      drawActorSilhouette(pin, {
        outfit: this.#outfit,
        skin: this.#skin,
        hair: this.#hairColor,
        head: silhouetteHeadFor(this.#headFamily),
      });
    }
    if (this.#isPlayer) pin.circle(0, -8, 9).stroke({ width: 1, color: ROLE.service, alpha: 0.95 });
  }

  /** Weisses Alpha-Frame aus dem Sheet, per Tint auf den Look-Farbton gelegt. */
  #setLodSprite(sprite: Sprite, base: Texture, layer: LodSpriteLayer, tint: number): void {
    sprite.texture = lodTextureFor(base, silhouetteHeadFor(this.#headFamily), layer);
    sprite.tint = tint;
    sprite.visible = true;
  }
}
