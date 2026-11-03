/**
 * Charakter-Rendering und Context-Radius-Menü.
 * Rendert den Spielercharakter und das RadialMenu als Overlay.
 * Liest ausschließlich GameView-Snapshots, kein Spielzustand im Renderer.
 */

import { Container, Graphics } from 'pixi.js';
import { RadialMenu } from './radial-menu';
import { FloorCues } from './floor-cues';

export interface CharacterViewCallbacks {
  readonly onInteract: (actionId: string, targetId?: number) => void;
  readonly onMoveTo: (x: number, y: number) => void;
}

export class CharacterView {
  readonly root: Container;
  readonly radialMenu: RadialMenu;
  readonly cues: FloorCues;
  private readonly callbacks: CharacterViewCallbacks;
  private playerMarker: Graphics | null = null;

  constructor(appCanvas: HTMLCanvasElement, callbacks: CharacterViewCallbacks) {
    this.callbacks = callbacks;
    this.root = new Container();
    this.radialMenu = new RadialMenu();
    this.radialMenu.setOnSelect((id) => this.callbacks.onInteract(id));
    this.cues = new FloorCues(appCanvas, (clientX, clientY) => {
      // Tile-Berechnung erfolgt durch FloorCues intern; MoveTo wird über Callbacks gesteuert
      this.callbacks.onMoveTo(clientX, clientY);
    });
    this.root.addChild(this.radialMenu.container);
    this.root.addChild(this.cues.root);
  }

  /** Aktualisiert die Charakter-Position aus dem GameView-Snapshot. */
  updatePlayerPosition(x: number, y: number): void {
    if (!this.playerMarker) {
      this.playerMarker = new Graphics();
      this.playerMarker.circle(0, 0, 6);
      this.playerMarker.fill(0xff00ff);
      this.root.addChild(this.playerMarker);
    }
    this.playerMarker.x = x;
    this.playerMarker.y = y;
  }

  /** Öffnet das Context-Radius-Menü mit den verfügbaren Aktionen. */
  openMenu(actions: { id: string; label: string; enabled: boolean; targetId?: number }[], x: number, y: number): void {
    this.radialMenu.show(actions, x, y);
  }

  /** Schließt das Menü. */
  closeMenu(): void {
    this.radialMenu.hide();
  }

  get isMenuOpen(): boolean {
    return this.radialMenu.isOpen;
  }
}
