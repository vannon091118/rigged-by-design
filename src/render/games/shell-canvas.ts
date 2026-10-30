// @loc-exception: Die Buehne haelt Matte, Becher, Perle und die drei Phasen (zeigen, mischen, waehlen) in einem Ticker; getrennt muessten Positionen und Kugelbesitz doppelt gefuehrt werden.
/** Huetchenspiel in Pixi: erst zeigt der Geber die Perle, dann mischt er, dann waehlt der Spieler. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { ShellMove } from '../../core/games/shell-round';

const W = 520;
const H = 210;
const SLOT_X = [150, 260, 370];
const CUP_Y = 118;
const LIFT = 46;
const SHOW_MS = 1500;
const MOVE_MS = 340;
const REVEAL_MS = 1500;

type Phase = 'IDLE' | 'SHOW' | 'SHUFFLE' | 'PICK' | 'REVEAL';

interface Cup {
  readonly gfx: Container;
  hover: boolean;
}

function drawCup(colour: number): Container {
  const gfx = new Container();
  const body = new Graphics()
    .moveTo(-27, 26)
    .lineTo(-27, -4)
    .quadraticCurveTo(0, -32, 27, -4)
    .lineTo(27, 26)
    .closePath()
    .fill({ color: colour });
  body.moveTo(-27, 26).lineTo(-27, -4).quadraticCurveTo(0, -32, 27, -4).lineTo(27, 26).closePath()
    .stroke({ width: 2, color: 0xc9a227, alpha: 0.9 });
  body.ellipse(0, 26, 29, 5).fill({ color: 0x0d0a12, alpha: 0.55 });
  body.moveTo(-18, 20).lineTo(-18, -2).quadraticCurveTo(-6, -22, 6, -14)
    .stroke({ width: 3, color: 0xffffff, alpha: 0.16 });
  gfx.addChild(body);
  return gfx;
}

export class ShellCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #pearl = new Graphics();
  readonly #caption = new Text({
    text: '',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: '800', fill: 0xffd166 },
  });
  readonly #cups: Cup[] = [];
  /** slots[platz] = Becher-ID, die gerade auf diesem Platz steht. */
  #slots = [0, 1, 2];
  #ballCup = 0;
  #moves: readonly ShellMove[] = [];
  #committed = 0;
  #pickedSlot = 0;
  #phase: Phase = 'IDLE';
  #time = 0;
  #onReady: (() => void) | null = null;
  #onDone: (() => void) | null = null;
  onPick: ((slot: number) => void) | null = null;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#drawMat();
    for (let index = 0; index < 3; index += 1) {
      const gfx = drawCup(index === 1 ? 0x7a1f2b : 0x5c1a25);
      gfx.position.set(SLOT_X[index]!, CUP_Y);
      const cup: Cup = { gfx, hover: false };
      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';
      gfx.on('pointerover', () => { cup.hover = true; });
      gfx.on('pointerout', () => { cup.hover = false; });
      gfx.on('pointertap', () => {
        if (this.#phase !== 'PICK') return;
        this.onPick?.(this.#slots.indexOf(index));
      });
      this.#cups.push(cup);
      this.#root.addChild(gfx);
    }
    this.#pearl.circle(0, 0, 8).fill({ color: 0xffd166 });
    this.#pearl.circle(0, 0, 8).stroke({ width: 1.2, color: 0x7a5a00 });
    this.#pearl.circle(-2.5, -2.5, 2.4).fill({ color: 0xfff6d4, alpha: 0.9 });
    this.#pearl.visible = false;
    this.#root.addChild(this.#pearl);
    this.#caption.anchor.set(0.5);
    this.#caption.position.set(W / 2, H - 18);
    this.#root.addChild(this.#caption);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #drawMat(): void {
    const mat = new Graphics()
      .roundRect(0, 0, W, H, 14).fill({ color: 0x11301f })
      .roundRect(0, 0, W, H, 14).stroke({ width: 3, color: 0x8a6a2f })
      .roundRect(10, 10, W - 20, H - 20, 10).stroke({ width: 1, color: 0x1f6b48, alpha: 0.85 })
      .ellipse(W / 2, CUP_Y + 12, 195, 64).stroke({ width: 0.8, color: 0x2f8a63, alpha: 0.45 });
    this.#root.addChild(mat);
    const label = new Text({
      text: 'HUETCHENSPIEL',
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, fontWeight: '700', fill: 0x7fd8b3, letterSpacing: 3 },
    });
    label.anchor.set(0.5);
    label.position.set(W / 2, 24);
    this.#root.addChild(label);
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / (W + 8), screen.height / (H + 8));
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - W * scale) / 2, (screen.height - H * scale) / 2);
  }

  #slotOf(cupId: number): number {
    const slot = this.#slots.indexOf(cupId);
    return slot < 0 ? 0 : slot;
  }

  #swap(move: ShellMove): void {
    const from = this.#slots[move.left];
    const to = this.#slots[move.right];
    if (from === undefined || to === undefined) return;
    this.#slots[move.left] = to;
    this.#slots[move.right] = from;
  }

  /** Phase 1 und 2: Perle zeigen, Becher senken, dann mischen. Danach darf der Spieler waehlen. */
  begin(ballCup: number, moves: readonly ShellMove[], onReady: () => void): void {
    this.#ballCup = ballCup;
    this.#moves = moves;
    this.#slots = [0, 1, 2];
    this.#committed = 0;
    this.#phase = 'SHOW';
    this.#time = 0;
    this.#onReady = onReady;
    this.#onDone = null;
    this.#pearl.visible = false;
    this.#caption.text = 'DIE PERLE LIEGT BEREIT';
    this.#cups.forEach((cup, index) => {
      cup.gfx.position.set(SLOT_X[index]!, CUP_Y);
      cup.gfx.rotation = 0;
    });
  }

  /** Phase 3: der gewaehlte Becher hebt sich zuerst, danach alle anderen zur Kontrolle. */
  reveal(slot: number, onDone: () => void): void {
    this.#pickedSlot = slot;
    this.#phase = 'REVEAL';
    this.#time = 0;
    this.#onDone = onDone;
    this.#onReady = null;
    const ballSlot = this.#slotOf(this.#ballCup);
    this.#pearl.position.set(SLOT_X[ballSlot]!, CUP_Y + 20);
    this.#pearl.visible = true;
    this.#caption.text = slot === ballSlot ? 'PERLE GEFUNDEN' : 'LEER - DA LAG SIE';
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    if (this.#phase === 'IDLE') return;
    this.#time += dt;

    if (this.#phase === 'SHOW') {
      const t = Math.min(1, this.#time / SHOW_MS);
      const lift = t < 0.3 ? t / 0.3 : t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
      this.#cups[this.#ballCup]!.gfx.y = CUP_Y - LIFT * lift;
      this.#pearl.position.set(SLOT_X[this.#slotOf(this.#ballCup)]!, CUP_Y + 20);
      this.#pearl.visible = lift > 0.6;
      if (t >= 1) {
        this.#pearl.visible = false;
        this.#cups[this.#ballCup]!.gfx.y = CUP_Y;
        this.#phase = 'SHUFFLE';
        this.#time = 0;
        this.#caption.text = 'DERGEBER MISCHT';
      }
      return;
    }

    if (this.#phase === 'SHUFFLE') {
      const due = Math.min(this.#moves.length, Math.floor(this.#time / MOVE_MS));
      while (this.#committed < due) {
        this.#swap(this.#moves[this.#committed]!);
        this.#committed += 1;
      }
      this.#cups.forEach((cup, cupId) => {
        cup.gfx.x = SLOT_X[this.#slotOf(cupId)]!;
        cup.gfx.y = CUP_Y;
      });
      const step = Math.floor(this.#time / MOVE_MS);
      const move = this.#moves[step];
      if (move && due < this.#moves.length) {
        const local = Math.min(1, (this.#time - step * MOVE_MS) / MOVE_MS);
        const eased = local < 0.5 ? 2 * local * local : 1 - ((-2 * local + 2) ** 2) / 2;
        const leftCup = this.#cups[this.#slots[move.left]!]!;
        const rightCup = this.#cups[this.#slots[move.right]!]!;
        leftCup.gfx.x = SLOT_X[move.left]! + (SLOT_X[move.right]! - SLOT_X[move.left]!) * eased;
        rightCup.gfx.x = SLOT_X[move.right]! + (SLOT_X[move.left]! - SLOT_X[move.right]!) * eased;
        leftCup.gfx.y = CUP_Y - Math.sin(eased * Math.PI) * 14;
        rightCup.gfx.y = CUP_Y - Math.sin(eased * Math.PI) * 14;
      }
      if (this.#time >= this.#moves.length * MOVE_MS) {
        this.#cups.forEach((cup, cupId) => cup.gfx.position.set(SLOT_X[this.#slotOf(cupId)]!, CUP_Y));
        this.#phase = 'PICK';
        this.#time = 0;
        this.#caption.text = 'WELCHER BECHER? KLICKE!';
        const ready = this.#onReady;
        this.#onReady = null;
        ready?.();
      }
      return;
    }

    if (this.#phase === 'PICK') {
      const wobble = Math.sin(this.#time / 140) * 0.04;
      this.#cups.forEach((cup) => {
        cup.gfx.rotation = cup.hover ? wobble : 0;
        cup.gfx.y = CUP_Y - (cup.hover ? 4 : 0);
      });
      return;
    }

    const t = Math.min(1, this.#time / REVEAL_MS);
    const chosenCup = this.#slots[this.#pickedSlot];
    this.#cups.forEach((cup, cupId) => {
      const delay = cupId === chosenCup ? 0 : 0.22;
      const local = Math.max(0, Math.min(1, (t - delay) / 0.22));
      cup.gfx.y = CUP_Y - LIFT * local;
      cup.gfx.rotation = 0;
    });
    if (t >= 1 && this.#onDone) {
      const done = this.#onDone;
      this.#onDone = null;
      this.#phase = 'IDLE';
      done();
    }
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#root.destroy({ children: true });
  }
}
