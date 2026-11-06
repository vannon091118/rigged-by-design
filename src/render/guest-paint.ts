/** Bemalung der Pixelfigur: Palette, Persona-Farben, Koerper, Beine, Arme und Pin. */
import { Graphics, type Sprite } from 'pixi.js';
import type { LookAccessory, PlayerLook } from '../core/sim/player-look';
import { INK, ROLE } from './art-tokens';
import { mountHead, paintFace as drawFace, paintHair, paintSkull, type FaceKind, type HeadHair } from './guest-head';
import { HAIRS, PANTS, PERSONA_COLORS, SHOES, SKINS } from './guest-parts';
import type { GuestRigNodes } from './guest-rig';

const hex = (value: string): number => Number.parseInt(value.replace('#', ''), 16);

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
    this.#paintLimbs();
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
    this.#paintBody();
    paintHair(this.#nodes.hair, this.#hairState());
    this.#paintPin();
    this.#paintLimbs();
    return true;
  }

  /** Look des Spielers: dieselben Flaechen, nur andere Farben und ein Accessoire. */
  setLook(next: PlayerLook, face: FaceKind | ''): void {
    this.#skin = hex(next.skin);
    this.#hairColor = hex(next.hair);
    this.#outfit = hex(next.outfit);
    this.#accessory = next.accessory;
    this.#paintHead();
    this.#paintBody();
    paintHair(this.#nodes.hair, this.#hairState());
    this.paintFace(face || 'neutral');
    this.#paintPin();
    this.#paintLimbs();
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

  #paintLimbs(): void {
    const { legs, legOther } = this.#nodes;
    legs.clear();
    legs.rect(-2, 0, 4, 9).fill(PANTS);
    legs.rect(-2, 9, 5, 3).fill(SHOES);
    legOther.clear();
    legOther.rect(-2, 0, 4, 9).fill(PANTS);
    legOther.rect(-2, 9, 5, 3).fill(SHOES);
    this.#paintArm(this.#nodes.armL);
    this.#paintArm(this.#nodes.armR);
  }

  #paintArm(graphics: Graphics): void {
    graphics.clear();
    graphics.rect(-1.5, 0, 3, 10).fill(this.#outfit);
    graphics.rect(-1.5, 9, 3, 2).fill(this.#skin);
  }

  #paintBody(): void {
    const { body } = this.#nodes;
    body.clear();
    // Blockiger Torso: breite Schulter, schmalere Huefte, kein Bogen.
    body.rect(-8, -12, 16, 4).fill(this.#outfit);
    body.rect(-7, -8, 14, 8).fill(this.#outfit);
    body.rect(-6, 0, 12, 4).fill(this.#outfit);
    body.rect(-4, -12, 8, 2).fill({ color: 0xffffff, alpha: 0.18 });
    if (this.#accessory === 'CHAIN') {
      body.rect(-5, -9, 10, 1).fill(0xffd166);
      body.rect(-2, -8, 4, 1).fill(0xffd166);
    }
    if (this.#persona === 'BUSINESS' || this.#persona === 'HIGH_ROLLER') {
      body.rect(-1, -8, 2, 8).fill(0x1a1020);
    } else if (this.#persona === 'STREET') {
      body.rect(-6, -5, 12, 1).fill({ color: 0xffffff, alpha: 0.25 });
    }
  }

  #paintPin(): void {
    const { pin } = this.#nodes;
    pin.clear();
    pin.rect(-3, 0, 6, 6).fill(this.#outfit);
    pin.rect(-2, -4, 4, 4).fill(this.#skin);
    pin.rect(-2, -3, 1, 1).fill(INK);
    pin.rect(1, -3, 1, 1).fill(INK);
    if (this.#isPlayer) pin.rect(-6, -6, 12, 14).stroke({ width: 1, color: ROLE.service, alpha: 0.95 });
  }
}
