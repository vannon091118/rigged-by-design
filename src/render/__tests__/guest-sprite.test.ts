/** @test-target: src/render/guest-paint.ts *
 *  Gast-Bemalung nutzt echte Sprite-Bauteile aus dem Charakter-Atlas statt
 *  gezeichneter Graphics. Ohne geladenen Atlas fallt sie auf farbige Blocke
 *  zuruck. Kein Pixi-Rendering noetig. */
import { describe, expect, it } from 'vitest';
import { Container, Graphics, Sprite } from 'pixi.js';
import { GuestPaint } from '../guest-paint';
import { PERSONA_COLORS, PANTS, SHOES } from '../guest-parts';
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
  return { head, skull, face, hair, body, legs, legOther, armL, armR, footwearL, footwearR, pin };
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
      paint.setLook({ skin: '#f2d3b3', hair: '#2a1a14', outfit: '#00ffcc', accessory: 'NONE' }, 'neutral');
      expect(nodes.body.tint).toBe(0x00ffcc);
    });
  });
});

