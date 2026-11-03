/**
 * Context-Radius-Menü (RadialMenu) als PixiJS-Komponente.
 * Kreis-Menü um den Charakter, erscheint im Interaktionsradius.
 * Wird der Standard-Weg für alle Interaktionen (Phase C).
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export interface RadialAction {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly targetId?: number;
}

export class RadialMenu {
  private readonly root: Container;
  private readonly buttons: Map<string, Graphics> = new Map();
  private readonly labels: Map<string, Text> = new Map();
  private onSelect?: (actionId: string, targetId?: number) => void;

  private static readonly RADIUS = 60;
  private static readonly BUTTON_RADIUS = 14;
  private static readonly MAX_ACTIONS = 6;

  constructor() {
    this.root = new Container();
    this.root.visible = false;
  }

  /** Gibt das PixiJS Container-Element zurück (vom Renderer eingebunden). */
  get container(): Container {
    return this.root;
  }

  /** Öffnet das Menü mit den angegebenen Aktionen um den gegebenen Mittelpunkt. */
  show(actions: RadialAction[], centerX: number, centerY: number): void {
    this.root.removeChildren();
    this.buttons.clear();
    this.labels.clear();

    const count = Math.min(actions.length, RadialMenu.MAX_ACTIONS);
    const step = (2 * Math.PI) / count;

    for (let i = 0; i < count; i += 1) {
      const action = actions[i];
      const angle = i * step - Math.PI / 2;
      const x = Math.cos(angle) * RadialMenu.RADIUS;
      const y = Math.sin(angle) * RadialMenu.RADIUS;

      const button = new Graphics();
      button.circle(0, 0, RadialMenu.BUTTON_RADIUS);
      button.fill(action.enabled ? 0x00ffcc : 0x555555);
      button.stroke({ width: 2, color: 0xffffff });
      button.interactive = true;
      button.cursor = 'pointer';
      button.x = x;
      button.y = y;

      const label = new Text(action.label, new TextStyle({
        fontSize: 10,
        fill: 0xffffff,
        align: 'center',
      }));
      label.anchor.set(0.5);
      label.x = x;
      label.y = y + RadialMenu.BUTTON_RADIUS + 8;

      button.on('pointerdown', () => {
        if (action.enabled && this.onSelect) {
          this.onSelect(action.id, action.targetId);
          this.hide();
        }
      });

      this.root.addChild(button);
      this.root.addChild(label);
      this.buttons.set(action.id, button);
      this.labels.set(action.id, label);
    }

    this.root.visible = true;
    this.root.x = centerX;
    this.root.y = centerY;
  }

  /** Versteckt das Menü. */
  hide(): void {
    this.root.visible = false;
    this.root.removeChildren();
    this.buttons.clear();
    this.labels.clear();
  }

  /** Registriert einen Callback für Auswahl-Events. */
  setOnSelect(callback: (actionId: string) => void): void {
    this.onSelect = callback;
  }

  /** Gibt zurück, ob das Menü gerade geöffnet ist. */
  get isOpen(): boolean {
    return this.root.visible;
  }
}
