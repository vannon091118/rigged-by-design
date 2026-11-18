/** @test-target: src/render/guest-rig.ts | @error-code: ERR-3001
 *
 *  Der Fern-Pin darf nicht am Rig haengen bleiben: `setDetail(false)` zeigt
 *  Pin und LOD-Sprites, `setDetail(true)` holt die gezeichnete Figur zurueck.
 *  Kein Pixi-Rendering noetig.
 */
import { describe, expect, it } from 'vitest';
import { Texture, type Renderer } from 'pixi.js';
import { primeGuestShadow } from '../guest-parts';
import { GuestRig } from '../guest-rig';

// Der Schatten kommt sonst aus dem Renderer; fuer den Stufentest reicht eine leere Textur.
primeGuestShadow({ generateTexture: () => Texture.EMPTY } as unknown as Renderer);

/** Zeichenreihenfolge im Root: Pin, Figur, LOD, Namensschild. */
const figureOf = (rig: GuestRig): { visible: boolean } => rig.root.children[1] as { visible: boolean };

describe('GuestRig: Detail-Stufe schaltet Pin und Figur', () => {
  it('zeigt in der Uebersicht den Pin statt der Figur', () => {
    const rig = new GuestRig(false, 'Test');
    expect(rig.detail).toBe(true);
    rig.setDetail(false);
    expect(rig.detail).toBe(false);
    expect(rig.nodes.pin.visible).toBe(true);
    expect(rig.nodes.lod.visible).toBe(true);
    expect(figureOf(rig).visible).toBe(false);
  });

  it('holt bei Detail die Figur zurueck und blendet den Pin aus', () => {
    const rig = new GuestRig(false, 'Test');
    rig.setDetail(false);
    rig.setDetail(true);
    expect(rig.detail).toBe(true);
    expect(rig.nodes.pin.visible).toBe(false);
    expect(rig.nodes.lod.visible).toBe(false);
    expect(figureOf(rig).visible).toBe(true);
  });

  it('bleibt bei wiederholter gleicher Stufe stabil', () => {
    const rig = new GuestRig(false, 'Test');
    rig.setDetail(false);
    rig.setDetail(false);
    expect(rig.nodes.pin.visible).toBe(true);
    expect(figureOf(rig).visible).toBe(false);
  });
});
