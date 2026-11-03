import { Page, type Locator, expect } from '@playwright/test';

/**
 * FloorPage – PixiJS-Floor-Stage.
 *
 * Der Floor selbst wird in Canvas gerendert und ist nicht über DOM-Selektoren
 * direkt ansteuerbar. Interaktion erfolgt über Tastatur (WASD, Enter, +, -, 0, Escape)
 * sowie über Klicks auf Floor-Elemente, die durch React-Event-Handler (onGuest,
 * onFurniture, onEmpty, onInteract) bedient werden.
 *
 * Für reproduzierbare Tests werden Positionen und Tasten-Nutzen über die
 * Page-Objekt-API gekapselt.
 */
export class FloorPage {
  readonly page: Page;
  readonly stageWrap: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stageWrap = page.locator('.stage-wrap');
  }

  async waitForReady() {
    await expect(this.stageWrap).toBeVisible();
  }

  /** Bewegen: WASD oder Pfeiltasten */
  async move(dx: number, dy: number) {
    const key = this.directionKey(dx, dy);
    if (key) await this.page.keyboard.press(key);
  }

  /** Nach links */
  async left() { await this.page.keyboard.press('ArrowLeft'); }
  /** Nach rechts */
  async right() { await this.page.keyboard.press('ArrowRight'); }
  /** Nach oben */
  async up() { await this.page.keyboard.press('ArrowUp'); }
  /** Nach unten */
  async down() { await this.page.keyboard.press('ArrowDown'); }

  /** Getragenes hier ab-/entladen (Enter) */
  async useCarriedHere() {
    await this.page.keyboard.press('Enter');
  }

  /** Zoom rein */
  async zoomIn() {
    await this.page.keyboard.press('+');
  }

  /** Zoom raus */
  async zoomOut() {
    await this.page.keyboard.press('-');
  }

  /** Übersicht (0) */
  async overview() {
    await this.page.keyboard.press('0');
  }

  /** Build-Panel schließen (Escape) */
  async closeBuild() {
    await this.page.keyboard.press('Escape');
  }

  /** Klick auf eine Koordinatenposition im Floor (Canvas-Bereich) */
  async clickAt(x: number, y: number) {
    await this.page.click('.stage-wrap', { position: { x, y } });
  }

  /** Klick auf einen Gast (über das Floor-Event onGuest) */
  async clickGuestAt(x: number, y: number) {
    await this.clickAt(x, y);
  }

  /** Klick auf ein Möbelstück (über onFurniture) */
  async clickFurnitureAt(x: number, y: number) {
    await this.clickAt(x, y);
  }

  /** Leeren Bereich anklicken (Bewegung dorthin oder Platzierung) */
  async clickEmptyAt(x: number, y: number) {
    await this.clickAt(x, y);
  }

  private directionKey(dx: number, dy: number): string | null {
    if (dx === -1 && dy === 0) return 'ArrowLeft';
    if (dx === 1 && dy === 0) return 'ArrowRight';
    if (dx === 0 && dy === -1) return 'ArrowUp';
    if (dx === 0 && dy === 1) return 'ArrowDown';
    return null;
  }
}
