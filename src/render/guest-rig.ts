/** Skelett der Pixelfigur: Container, Gelenke, Pin, Namensschild, Squash und Tap-Ring. */
import { Container, Graphics, Text } from 'pixi.js';
import { ROLE, floorText } from './art-tokens';
import { poseFor, type ActorState } from './rig-pose';
import { shadowSprite } from './guest-parts';

/** Flaeche, die das Rig bereitstellt und das Paint-Modul bemalt. */
export interface GuestRigNodes {
  readonly head: Container;
  readonly skull: Graphics;
  readonly face: Graphics;
  readonly hair: Graphics;
  readonly body: Graphics;
  readonly legs: Graphics;
  readonly legOther: Graphics;
  readonly armL: Graphics;
  readonly armR: Graphics;
  readonly pin: Graphics;
}

/** Squash beim Antippen und der Ring am Fuss; beides reine Darstellung. */
export class GuestRig {
  readonly root = new Container();
  readonly nodes: GuestRigNodes;
  readonly #figure = new Container();
  readonly #tap = new Graphics();
  readonly #head = new Container();
  readonly #legL = new Container();
  readonly #legR = new Container();
  readonly #armL = new Container();
  readonly #armR = new Container();
  readonly #nameplate: Text;
  #detail = true;
  #nameVisible = true;
  #bumpQueued = false;
  #bumpStart = -1000;
  #tapQueued = false;
  #tapStart = -1000;

  constructor(isPlayer: boolean, name: string) {
    const legs = new Graphics();
    const body = new Graphics();
    const armL = new Graphics();
    const armR = new Graphics();
    const skull = new Graphics();
    const face = new Graphics();
    const hair = new Graphics();
    const pin = new Graphics();
    pin.visible = false;
    this.#tap.ellipse(0, 15, 13, 5.5).stroke({ width: 2, color: ROLE.service, alpha: 0.9 });
    this.#tap.visible = false;
    this.#legL.position.set(-4, 3);
    this.#legR.position.set(4, 3);
    this.#legL.addChild(legs);
    this.#legR.addChild(new Graphics());
    this.#armL.position.set(-8, -10);
    this.#armR.position.set(8, -10);
    this.#armL.addChild(armL);
    this.#armR.addChild(armR);
    this.#head.position.set(0, -19);
    this.#head.addChild(skull, face, hair);
    // Reihenfolge ist die Zeichenreihenfolge: Ring, Schatten, Beine, Koerper, Arme, Kopf.
    this.#figure.addChild(this.#tap, shadowSprite(), this.#legL, this.#legR, body, this.#armL, this.#armR, this.#head);
    this.#nameplate = new Text({ text: isPlayer ? 'DU' : name, style: floorText.name() });
    this.#nameplate.anchor.set(0.5, 0);
    this.#nameplate.position.set(0, 18);
    this.root.addChild(pin, this.#figure, this.#nameplate);
    this.nodes = {
      head: this.#head, skull, face, hair, body, legs,
      legOther: this.#legR.children[0] as Graphics, armL, armR, pin,
    };
  }

  /** Detail heisst gezeichnete Figur; die Uebersicht zeigt nur den Pin. */
  get detail(): boolean {
    return this.#detail;
  }

  setName(next: string): void {
    this.#nameplate.text = next.length > 16 ? `${next.slice(0, 15)}…` : next;
  }

  setDetail(next: boolean): void {
    if (next === this.#detail) return;
    this.#detail = next;
    this.#figure.visible = next;
    this.nodes.pin.visible = !next;
    this.#nameplate.visible = next && this.#nameVisible;
  }

  setNameVisible(next: boolean): void {
    if (next === this.#nameVisible) return;
    this.#nameVisible = next;
    this.#nameplate.visible = this.#detail && next;
  }

  bump(): void {
    this.#bumpQueued = true;
  }

  tapRing(): void {
    this.#tapQueued = true;
  }

  animate(nowMs: number, state: ActorState, phase: number): void {
    if (this.#bumpQueued) { this.#bumpQueued = false; this.#bumpStart = nowMs; }
    const squash = nowMs - this.#bumpStart;
    const k = squash >= 0 && squash < 90 ? Math.sin((squash / 90) * Math.PI) : 0;
    this.#figure.scale.set(1 + k * 0.1, 1 - k * 0.14);
    if (this.#tapQueued) { this.#tapQueued = false; this.#tapStart = nowMs; }
    const ring = nowMs - this.#tapStart;
    if (ring >= 0 && ring < 240) {
      this.#tap.visible = true;
      this.#tap.scale.set(0.6 + (ring / 240) * 1.2);
      this.#tap.alpha = 1 - ring / 240;
    } else if (this.#tap.visible) this.#tap.visible = false;
    const pose = poseFor(state, nowMs, phase);
    this.#figure.y = pose.bob;
    this.#figure.rotation = pose.lean;
    this.#head.y = -19 + pose.headY;
    this.#head.rotation = pose.headRot;
    this.#armL.rotation = pose.armL;
    this.#armR.rotation = pose.armR;
    this.#legL.rotation = pose.legL;
    this.#legR.rotation = pose.legR;
    this.#figure.y -= pose.hop;
  }
}
