/** Lieferkisten: am Boden abgelegt oder sichtbar am Traeger. Liest nur Snapshots. */
import { Container, Graphics, Text } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { STROKE, crateColor, floorText } from './art-tokens';
import { isVisible, type ViewRect } from './floor-math';
import type { DepthStage } from './depth';
import type { GuestArt } from './guest-art';

interface CrateEntry {
  root: Container;
  carriedBy: number | null;
}

/** Eigene Ownership fuer Kistenbild und Tragebezug; der FloorProps-Layer delegiert nur. */
export class FloorCrates {
  readonly #world: Container;
  readonly #depth: DepthStage;
  readonly #crates = new Map<number, CrateEntry>();

  constructor(world: Container, depth: DepthStage) {
    this.#world = world;
    this.#depth = depth;
  }

  /** Nur fuer Tests und Inspektion: gerenderte Kiste. */
  crateRoot(id: number): Container | undefined {
    return this.#crates.get(id)?.root;
  }

  sync(view: GameView, rect: ViewRect, agents: ReadonlyMap<number, GuestArt>): void {
    const seen = new Set<number>();
    for (const crate of view.crates) {
      seen.add(crate.id);
      let entry = this.#crates.get(crate.id);
      if (!entry) {
        const root = this.#create(crate.payload.kind);
        root.position.set(crate.x * TILE, crate.y * TILE);
        entry = { root, carriedBy: null };
        this.#crates.set(crate.id, entry);
        this.#world.addChild(root);
      }
      // Der Spieler traegt visuell selbst; nur Personal-IDs haengen hier.
      const carrierId = typeof crate.carriedBy === 'number' ? crate.carriedBy : null;
      entry.carriedBy = carrierId;
      this.#placeAt(entry, crate, carrierId !== null ? agents.get(carrierId) : undefined, rect);
    }
    for (const [id, entry] of this.#crates) {
      if (seen.has(id)) continue;
      entry.root.destroy({ children: true });
      this.#crates.delete(id);
    }
  }

  /** Getragene Kisten folgen dem Traeger zwischen zwei Snapshots. */
  walk(agents: ReadonlyMap<number, GuestArt>): void {
    for (const [id, entry] of this.#crates) {
      if (entry.carriedBy === null) continue;
      const carrier = agents.get(entry.carriedBy);
      if (!carrier) continue;
      entry.root.position.set(carrier.root.x - TILE / 2, carrier.root.y - TILE * 0.9);
      entry.root.visible = carrier.root.visible;
      this.#depth.set(entry.root, carrier.root.y, 'prop', id);
    }
  }

  destroy(): void {
    for (const entry of this.#crates.values()) entry.root.destroy({ children: true });
    this.#crates.clear();
  }

  #create(kind: GameView['crates'][number]['payload']['kind']): Container {
    const root = new Container();
    const g = new Graphics();
    const edge = crateColor(kind);
    g.roundRect(0, 3, TILE, TILE, 3).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(0, 0, TILE, TILE, 3).fill(0x241a12).stroke({ width: STROKE.base, color: edge });
    g.moveTo(2, TILE / 2).lineTo(TILE - 2, TILE / 2).stroke({ width: 1, color: edge, alpha: 0.7 });
    const tag = new Text({
      text: kind === 'FURNITURE' ? 'MÖBEL' : kind === 'DRINKS' ? 'GLAS' : 'TEILE',
      style: floorText.crate(),
    });
    tag.anchor.set(0.5, 0.5);
    tag.position.set(TILE / 2, TILE / 2);
    root.addChild(g, tag);
    return root;
  }

  #placeAt(
    entry: CrateEntry,
    crate: GameView['crates'][number],
    carrier: GuestArt | undefined,
    rect: ViewRect,
  ): void {
    // Getragen heisst: sichtbar beim Traeger. Nur ohne Traeger (kaputter
    // Verweis) bleibt sie verborgen.
    if (crate.carriedBy === null) {
      this.#depth.set(entry.root, (crate.y + 1) * TILE, 'prop', crate.id);
      entry.root.visible = isVisible(crate.x * TILE, crate.y * TILE, TILE, TILE, rect, 0);
      return;
    }
    if (!carrier) {
      entry.root.visible = false;
      return;
    }
    entry.root.position.set(carrier.root.x - TILE / 2, carrier.root.y - TILE * 0.9);
    entry.root.visible = carrier.root.visible;
    this.#depth.set(entry.root, carrier.root.y, 'prop', crate.id);
  }
}
