/**
 * Sichtbare Stadt: Fassaden, Strassenrequisiten und Tuerkanten aus dem einen
 * `CityRenderPlan`. Die Schicht ist ein Container in der gemeinsamen
 * Tiefenebene; sie hat keinen eigenen Ticker und keine eigene Stadtwahrheit.
 */
import { Container, Sprite, Text } from 'pixi.js';
import { TILE } from '../core/sim/types';
import { floorText, WORLD_FLATTEN } from './art-tokens';
import type { AmbientPlan } from './ambient-plan';
import type { CityRenderPlan } from './city-plan';
import type { DepthStage } from './depth';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';
import { wallBandRect } from './wall-art';

export { cityRenderPlan } from './city-plan';

interface CityEntry {
  readonly node: Container;
  readonly sprite: Sprite;
  /** Weicher Fussschatten; Tueren werfen keinen. */
  readonly shadow: Sprite | null;
  readonly shadowRadius: number;
  readonly light: boolean;
}

/** Ein fehlendes Asset wird hoechstens zweimal je Sekunde erneut versucht. */
const MISSING_TEXTURE_RETRY_MS = 500;

const HASH_SEED = 2166136261;

/** Stabile ID fuer die Tiefensortierung; kein Zufall und keine Namenssortierung. */
function stableId(value: string): number {
  let hash = HASH_SEED;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export class CityExteriorLayer {
  readonly root = new Container();
  readonly #depth: DepthStage;
  readonly #entries: CityEntry[] = [];
  #plan: CityRenderPlan | null = null;
  #ambient: AmbientPlan | null = null;
  #retryAt = 0;
  #missingTexture = false;

  constructor(depth: DepthStage) {
    this.#depth = depth;
    // Fussanker-Sortierung bleibt in der Stadtgruppe; die gemeinsame Welt
    // sortiert Figuren und Stadtgruppe als Ganzes, kein globaler Sortierlauf.
    this.root.sortableChildren = true;
    this.root.visible = false;
  }

  /**
   * Snapshot-Wechsel: die Stadt ist statisch, aber Texturen koennen beim ersten
   * Render noch laden. Fehlende Texturen werden deshalb beim naechsten Update
   * erneut versucht, statt eine Platzhalterflaeche zu zeichnen.
   */
  update(plan: CityRenderPlan | null): void {
    if (!plan) {
      this.#plan = null;
      this.#clear();
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    // Der Plan ist je Exterieur stabil: gleiche Identitaet heisst kein Rebuild.
    if (plan === this.#plan) return;
    this.#plan = plan;
    this.#rebuild(plan);
  }

  /**
   * Eine Laterne atmet pro Frame; die Szene bleibt sonst statisch. Ein
   * dauerhaft fehlendes Asset wird gedrosselt neu versucht statt pro Frame.
   */
  animate(now: number, phase: 'morning' | 'evening' | 'night'): void {
    if (!this.root.visible) return;
    if (this.#missingTexture && this.#plan && now >= this.#retryAt) {
      this.#retryAt = now + MISSING_TEXTURE_RETRY_MS;
      this.#rebuild(this.#plan);
    }
    const intensity = phase === 'night' ? 1 : phase === 'evening' ? 0.74 : 0.42;
    for (const entry of this.#entries) {
      if (!entry.light) continue;
      entry.sprite.alpha = 0.68 + Math.sin(now / 720 + entry.node.zIndex) * 0.12 * intensity;
    }
  }

  destroy(): void {
    this.#clear();
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }

  /**
   * Tageszeit ist reine Darstellung: Schatten fallen richtungsabhaengig, die
   * Stadt bleibt sonst unveraendert. Kein Rebuild, kein neues Sprite.
   */
  setAmbient(plan: AmbientPlan): void {
    if (plan === this.#ambient) return;
    this.#ambient = plan;
    this.#applyAmbient();
  }

  #applyAmbient(): void {
    const plan = this.#ambient;
    const visible = plan !== null && plan.shadow > 0;
    for (const entry of this.#entries) {
      const shadow = entry.shadow;
      if (!shadow) continue;
      shadow.visible = visible;
      if (!plan || !visible) continue;
      shadow.alpha = plan.shadow;
      shadow.position.set(
        entry.sprite.x + plan.sunX * entry.shadowRadius,
        entry.sprite.y - 2 + plan.sunY * entry.shadowRadius,
      );
    }
  }

  /** Weicher Schatten aus derselben Radialtextur wie das Licht; kein neues Asset. */
  #shadowFor(width: number, height: number): Sprite | null {
    const texture = textureFor(ASSET.lightPool);
    if (!texture) return null;
    const shadow = new Sprite(texture);
    shadow.anchor.set(0.5, 0.5);
    shadow.width = width;
    shadow.height = Math.max(4, height);
    shadow.tint = 0x000000;
    shadow.alpha = 0;
    shadow.visible = false;
    return shadow;
  }

  #rebuild(plan: CityRenderPlan): void {
    this.#clear();
    // Schatten und Licht teilen dieselbe Textur. Fehlt sie beim ersten Aufbau,
    // muss der gedrosselte Retry auch die Schatten nachziehen, nicht nur
    // fehlende Fassaden.
    this.#missingTexture = textureFor(ASSET.lightPool) === null;
    for (const door of plan.doors) this.#addDoor(plan, door);
    for (const building of plan.buildings) {
      const texture = textureFor(building.asset);
      if (!texture) {
        this.#missingTexture = true;
        continue;
      }
      const node = new Container();
      const sprite = new Sprite(texture);
      const width = building.footprint.w * TILE;
      const height = building.footprint.h * TILE;
      sprite.anchor.set(0.5, 1);
      sprite.width = width * 0.98;
      sprite.height = height * WORLD_FLATTEN;
      sprite.position.set((building.footprint.x + building.footprint.w / 2) * TILE, (building.footprint.y + building.footprint.h) * TILE);
      const shadow = this.#shadowFor(width * 0.92, height * 0.22);
      if (shadow) node.addChild(shadow);
      node.addChild(sprite);
      const sign = new Text({ text: building.name.toUpperCase(), style: floorText.name() });
      sign.anchor.set(0.5, 1);
      sign.position.set(sprite.x, sprite.y - sprite.height + 8);
      node.addChild(sign);
      this.root.addChild(node);
      this.#depth.set(node, sprite.y, 'prop', stableId(building.id));
      this.#entries.push({ node, sprite, shadow, shadowRadius: TILE * 0.7, light: false });
    }
    for (const prop of plan.props) {
      const texture = textureFor(prop.asset);
      if (!texture) {
        this.#missingTexture = true;
        continue;
      }
      const node = new Container();
      const sprite = new Sprite(texture);
      const width = prop.role === 'STREET_LIGHT' ? TILE * 0.9 : Math.max(TILE * 1.2, prop.w * TILE * 0.9);
      const height = prop.role === 'STREET_LIGHT' ? TILE * 2.1 : TILE * 1.25;
      sprite.anchor.set(0.5, 1);
      sprite.width = width;
      sprite.height = height;
      sprite.position.set((prop.x + prop.w / 2) * TILE, (prop.y + prop.h) * TILE);
      const shadow = this.#shadowFor(width * 0.8, width * 0.3);
      if (shadow) node.addChild(shadow);
      node.addChild(sprite);
      this.root.addChild(node);
      this.#depth.set(node, sprite.y, 'prop', stableId(prop.id));
      this.#entries.push({ node, sprite, shadow, shadowRadius: TILE * 0.35, light: prop.role === 'STREET_LIGHT' });
    }
    // Die Stadtgruppe hat eigene Fussanker; einmal sortieren reicht, weil sich
    // Gebaeude und Requisiten nicht bewegen.
    this.root.sortChildren();
    this.#depth.markDirty();
    this.#applyAmbient();
  }

  #addDoor(plan: CityRenderPlan, door: CityRenderPlan['doors'][number]): void {
    const texture = textureFor(door.asset);
    if (!texture) {
      this.#missingTexture = true;
      return;
    }
    const band = wallBandRect(
      { axis: door.axis, x: door.x, y: door.y, kind: 'DOOR', id: door.id, zoneId: null },
      plan.bounds.width,
      TILE,
    );
    const node = new Container();
    const sprite = new Sprite(texture);
    // Die Textur ist eine liegende Schwelle; V-Kanten drehen dieselbe Rolle
    // um 90 Grad, statt eine zweite Asset-Variante zu erfinden.
    sprite.anchor.set(0.5);
    sprite.width = Math.max(band.w, band.h);
    sprite.height = Math.min(band.w, band.h);
    if (door.axis === 'V') sprite.rotation = Math.PI / 2;
    sprite.position.set(band.x + band.w / 2, band.y + band.h / 2);
    node.addChild(sprite);
    this.root.addChild(node);
    this.#depth.set(node, band.y + band.h, 'prop', stableId(door.id));
    this.#entries.push({ node, sprite, shadow: null, shadowRadius: 0, light: false });
  }

  #clear(): void {
    for (const entry of this.#entries) entry.node.destroy({ children: true });
    this.#entries.length = 0;
    this.#missingTexture = false;
    this.#retryAt = 0;
  }
}
