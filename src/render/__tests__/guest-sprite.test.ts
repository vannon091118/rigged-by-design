/** @test-target: src/render/guest-paint.ts *
 *  @error-code: ERR-3001
 *  Gast-Bemalung nutzt echte Sprite-Bauteile aus dem Charakter-Atlas statt
 *  gezeichneter Graphics. Ohne geladenen Atlas fallt sie auf farbige Blocke
 *  zuruck. Kein Pixi-Rendering noetig. */
import { describe, expect, it } from 'vitest';
import { Container, Graphics, Sprite } from 'pixi.js';
import { GuestPaint } from '../guest-paint';
import { LOOK_HAIR_RECTS } from '../guest-head';
import { HEAD_FAMILIES, PERSONA_COLORS, PANTS, SHOES, headTextureForFamily } from '../guest-parts';
import type { GuestRigNodes } from '../guest-rig';

function makeNodes(): GuestRigNodes {
  const body = new Sprite();
  const legs = new Sprite();
  const legOther = new Sprite();
  const armL = new Sprite();
  const armR = new Sprite();
  const footwearL = new Sprite();
  const footwearR = new Sprite();
  const head = new Container();
  const skull = new Graphics();
  const face = new Graphics();
  const hair = new Graphics();
  const pin = new Graphics();
  const lod = new Container();
  return { head, skull, face, hair, body, legs, legOther, armL, armR, footwearL, footwearR, pin, lod };
}

describe('Gast-Bemalung mit Sprite-Bauteilen', () => {
  it('legt Koerper, Beine und Arme als Sprite an', () => {
    const nodes = makeNodes();
    new GuestPaint(nodes, { seed: 7, isPlayer: false, persona: 'STREET', portrait: false });
    expect(nodes.body).toBeInstanceOf(Sprite);
    expect(nodes.legs).toBeInstanceOf(Sprite);
    expect(nodes.armL).toBeInstanceOf(Sprite);
    expect(nodes.armR).toBeInstanceOf(Sprite);
    expect(nodes.footwearL).toBeInstanceOf(Sprite);
    expect(nodes.footwearR).toBeInstanceOf(Sprite);
  });

  it('farbt Bauteile in die Persona-Farbe ein', () => {
    const nodes = makeNodes();
    new GuestPaint(nodes, { seed: 1, isPlayer: false, persona: 'BUSINESS', portrait: false });
    expect(nodes.body.tint).toBe(PERSONA_COLORS.BUSINESS);
    expect(nodes.armL.tint).toBe(PERSONA_COLORS.BUSINESS);
    expect(nodes.armR.tint).toBe(PERSONA_COLORS.BUSINESS);
    expect(nodes.legs.tint).toBe(PANTS);
    expect(nodes.legOther.tint).toBe(PANTS);
    expect(nodes.footwearL.tint).toBe(SHOES);
    expect(nodes.footwearR.tint).toBe(SHOES);
  });

  describe('setPersona', () => {
    it('aendert die Koerperfarbe auf die neue Persona', () => {
      const nodes = makeNodes();
      const paint = new GuestPaint(nodes, { seed: 3, isPlayer: false, persona: 'LUMPEN', portrait: false });
      expect(nodes.body.tint).toBe(PERSONA_COLORS.LUMPEN);
      paint.setPersona('HIGH_ROLLER');
      expect(nodes.body.tint).toBe(PERSONA_COLORS.HIGH_ROLLER);
      expect(nodes.legs.tint).toBe(PANTS);
    });

    it('gibt false zuruck, wenn die Persona unveraendert bleibt', () => {
      const nodes = makeNodes();
      const paint = new GuestPaint(nodes, { seed: 3, isPlayer: false, persona: 'LUMPEN', portrait: false });
      expect(paint.setPersona('LUMPEN')).toBe(false);
    });
  });

  describe('setLook', () => {
    it('uebernimmt Spielerfarben aus dem Look', () => {
      const nodes = makeNodes();
      const paint = new GuestPaint(nodes, { seed: 0, isPlayer: true, persona: 'STREET', portrait: false });
      paint.setLook({ skin: '#f2d3b3', hair: '#2a1a14', head: 'head-01', outfit: '#00ffcc', accessory: 'NONE', wardrobe: [], equippedItemId: null }, 'neutral');
      expect(nodes.body.tint).toBe(0x00ffcc);
    });

    it('wechselt die Kopffamilie ohne die Spielerfarben zu verlieren', () => {
      const nodes = makeNodes();
      const paint = new GuestPaint(nodes, { seed: 0, isPlayer: true, persona: 'STREET', portrait: false });
      paint.setLook({ skin: '#e0b48c', hair: '#d9b35c', head: 'head-03', outfit: '#ff2e88', accessory: 'NONE', wardrobe: [], equippedItemId: null }, 'neutral');
      expect(nodes.body.tint).toBe(0xff2e88);
      expect(LOOK_HAIR_RECTS['head-03']).not.toEqual(LOOK_HAIR_RECTS['head-01']);
    });
  });

  it('haelt das LOD-Sprite-Set ohne Atlas unsichtbar und zeichnet den Fallback', () => {
    const nodes = makeNodes();
    new GuestPaint(nodes, { seed: 0, isPlayer: true, persona: 'STREET', portrait: false });
    const lod = nodes.lod.children.filter((child) => child instanceof Sprite);
    expect(lod).toHaveLength(3);
    expect(lod.every((sprite) => !sprite.visible)).toBe(true);
  });

  it('gibt jeder Kopffamilie eine eigene Atlastextur', () => {
    const paths = HEAD_FAMILIES.map((head) => headTextureForFamily(head));
    expect(paths).toEqual(['characters/head-01-01.png', 'characters/head-02-01.png', 'characters/head-03-01.svg']);
    expect(new Set(paths).size).toBe(3);
  });
});

