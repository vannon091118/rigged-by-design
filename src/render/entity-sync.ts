/**
 * Figuren- und Möbelsync eines Frames: aus dem Snapshot in die Tiefenebene,
 * ohne Spielzustand zu halten. Culling und LOD bleiben Darstellung.
 */
import type { Container, Graphics, Renderer } from 'pixi.js';
import { dirtyNear, emotionOf } from '../core/sim/emotion';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import type { ActorPool } from './actor-pool';
import { footAnchor } from './depth';
import { createFurnitureArt, type FurnitureArt } from './furniture-art';
import { isVisible, visibleRect } from './floor-math';
import type { FloorProps } from './floor-props';
import type { GuestArt } from './guest-art';
import { actorStateFor } from './rig-pose';
import { drawPlayerMarker } from './player-marker';
import type { SceneCache } from './scene-cache';

interface EntityDeps {
  readonly renderer: Renderer;
  readonly scene: SceneCache;
  readonly actors: ActorPool;
  readonly player: GuestArt;
  readonly marker: Graphics;
  readonly props: FloorProps;
  readonly camera: Container;
  readonly screen: { readonly width: number; readonly height: number };
  readonly stepMs: number;
  readonly lod: () => number;
  readonly scale: () => number;
}

/** Spieler-ID 0, Gaeste/Personal positiv; bleibt im Tie-Break-Bereich. */
const PLAYER_ID = 0;

export class EntitySync {
  readonly #deps: EntityDeps;
  readonly #furniture = new Map<number, FurnitureArt>();
  readonly #seenFurniture = new Set<number>();
  readonly #seenGuests = new Set<number>();
  readonly #results = new Map<number, string>();
  #playerPlaced = false;

  constructor(deps: EntityDeps) {
    this.#deps = deps;
  }

  furniture(id: number): FurnitureArt | undefined {
    return this.#furniture.get(id);
  }

  sync(view: GameView, now: number): void {
    this.#syncFurniture(view);
    this.#syncGuests(view, now);
    this.#syncPlayer(view, now);
  }

  setDetail(detail: boolean): void {
    for (const art of this.#furniture.values()) art.setDetail(detail);
    for (const art of this.#deps.actors.active.values()) art.setLod(detail);
    this.#deps.player.setLod(detail);
  }

  setPinScale(lod: number, _scale: number): void {
    // Die Silhouette gehoert zur Welt und skaliert mit ihr; sie wird nicht
    // gegen die Kamera vergroessert. `lod` bleibt im Vertrag, damit der
    // Aufrufer nicht wissen muss, welche Darstellung gerade gilt.
    void lod;
    for (const art of this.#deps.actors.active.values()) art.root.scale.set(1);
    this.#deps.player.root.scale.set(1);
  }

  /** Sichtbarkeit folgt der Kamera; ohne Detail-LOD bleibt alles an. */
  cull(view: GameView, lod: number): void {
    const { props } = this.#deps;
    if (lod !== 1) {
      for (const art of this.#furniture.values()) art.root.visible = true;
      for (const art of this.#deps.actors.active.values()) {
        art.root.visible = true;
        art.sticker.visible = false;
      }
      this.#deps.player.root.visible = true;
      this.#deps.player.sticker.visible = false;
      props.update(view, { left: 0, top: 0, right: view.size * TILE, bottom: view.size * TILE }, lod);
      return;
    }
    const { camera, screen } = this.#deps;
    const rect = visibleRect(camera.x, camera.y, camera.scale.x, screen.width, screen.height);
    for (const item of view.furniture) {
      const art = this.#furniture.get(item.id);
      if (!art) continue;
      art.root.visible = isVisible(item.x * TILE, item.y * TILE, item.w * TILE, item.h * TILE, rect, 0);
    }
    for (const art of this.#deps.actors.active.values()) {
      const visible = isVisible(art.root.x, art.root.y, 0, 0, rect, 40);
      art.root.visible = visible;
      art.sticker.visible = visible;
    }
    const playerVisible = isVisible(this.#deps.player.root.x, this.#deps.player.root.y, 0, 0, rect, 40);
    this.#deps.player.root.visible = playerVisible;
    this.#deps.player.sticker.visible = playerVisible;
    props.update(view, rect, lod);
  }

  /** Beim Vorlagenwechsel verschwinden die alten Möbeltexte sofort. */
  resetFurniture(): void {
    for (const art of this.#furniture.values()) art.root.destroy({ children: true });
    this.#furniture.clear();
  }

  clear(): void {
    this.#furniture.clear();
    this.#results.clear();
  }

  #syncFurniture(view: GameView): void {
    this.#seenFurniture.clear();
    this.#results.clear();
    for (const guest of view.guests) {
      if (guest.targetFurniture && guest.lastResult) this.#results.set(guest.targetFurniture, guest.lastResult);
    }
    for (const item of view.furniture) {
      this.#seenFurniture.add(item.id);
      let art = this.#furniture.get(item.id);
      if (!art) {
        art = createFurnitureArt(item, TILE, this.#deps.renderer);
        this.#furniture.set(item.id, art);
        this.#deps.scene.world.addChild(art.root);
        if (this.#deps.lod() === 0) art.setDetail(false);
      }
      art.root.position.set(item.x * TILE, item.y * TILE);
      this.#deps.scene.depth.set(art.root, footAnchor(item.y, item.h, TILE), 'furniture', item.id);
      art.refresh(item);
      art.setResult(item.gameId ? this.#results.get(item.id) ?? 'BEREIT' : '');
    }
    for (const [id, art] of this.#furniture) {
      if (this.#seenFurniture.has(id)) continue;
      art.root.destroy({ children: true });
      this.#furniture.delete(id);
    }
  }

  #syncGuests(view: GameView, now: number): void {
    const { actors, scene, lod, stepMs } = this.#deps;
    this.#seenGuests.clear();
    // Nur der naechste Gast traegt ein Namensschild; der Rest bleibt Figur.
    const focusId = view.guests.reduce<number | null>((min, guest) => (min === null || guest.id < min ? guest.id : min), null);
    for (const guest of view.guests) {
      this.#seenGuests.add(guest.id);
      let art = actors.get(guest.id);
      if (!art) {
        art = actors.acquire(guest);
        art.target.x = (guest.position.x + 0.5) * TILE;
        art.target.y = (guest.position.y + 0.8) * TILE;
        art.from.x = art.target.x;
        art.from.y = art.target.y;
        art.moveStart = now - stepMs;
        art.root.position.set(art.target.x, art.target.y);
        art.root.scale.set(1);
        art.sticker.position.set(art.target.x, art.target.y);
      }
      const queue = guest.state === 'EXCHANGE' || guest.state === 'CASHOUT' ? guest.queueIndex : 0;
      const bob = Math.sin(now / 280 + art.phase) * 0.3;
      place(art, (guest.position.x + 0.5) * TILE + queue * 4, (guest.position.y + 0.8) * TILE - queue * 9, now, bob);
      art.root.alpha = guest.state === 'LEAVE' ? 0.45 : 0.72 + (guest.addiction / 100) * 0.28;
      art.setMood(guest.mood, guest.state === 'ANGRY' || guest.anger > 50, guest.addiction);
      art.setEmotion(emotionOf(guest, dirtyNear(view.dirtyTiles, view.size, guest.position.x, guest.position.y)));
      art.setState(actorStateFor({
        state: guest.state, pathLength: guest.path.length, pathIndex: guest.pathIndex,
        lastResult: guest.lastResult,
      }));
      art.setLod(lod() === 1);
      art.setNameVisible(guest.id === focusId);
      scene.depth.set(art.root, art.root.y, 'actor', guest.id);
    }
    for (const id of actors.active.keys()) {
      if (!this.#seenGuests.has(id)) actors.release(id);
    }
  }

  #syncPlayer(view: GameView, now: number): void {
    const { player, marker, scene, stepMs, lod } = this.#deps;
    const px = (view.player.position.x + 0.5) * TILE;
    const py = (view.player.position.y + 0.8) * TILE;
    if (!this.#playerPlaced) {
      this.#playerPlaced = true;
      player.target.x = px;
      player.target.y = py;
      player.from.x = px;
      player.from.y = py;
      player.moveStart = now - stepMs;
      player.root.position.set(px, py);
      player.sticker.position.set(px, py);
    } else {
      place(player, px, py, now, 0);
    }
    player.setEmotion(view.player.carrying === 'DRINK' ? 'DRINK' : 'NONE');
    player.setLook(view.look);
    const fx = view.fightFx && view.fightFx.untilTick >= view.tick ? view.fightFx : null;
    const fighting = fx !== null
      && Math.abs(fx.x - view.player.position.x) + Math.abs(fx.y - view.player.position.y) <= 2;
    player.setState(actorStateFor({
      state: 'WAIT', pathLength: view.player.path.length, pathIndex: view.player.pathIndex,
      carrying: view.player.carrying, isPlayer: true,
      injured: view.player.rpg.injuryTicks > 0, fighting,
    }));
    scene.depth.set(player.root, player.root.y, 'actor', PLAYER_ID);
    drawPlayerMarker(marker, { injured: view.player.rpg.injuryTicks > 0, fighting, won: view.fightFx?.won ?? false });
    player.setLod(lod() === 1);
  }
}

/** Weicher Schritt: Ziel setzen, Bewegung startet an der aktuellen Position. */
function place(art: GuestArt, x: number, y: number, now: number, bob: number): void {
  if (art.target.x === x && art.target.y === y) return;
  art.from.x = art.root.x;
  art.from.y = art.root.y - bob;
  art.target.x = x;
  art.target.y = y;
  art.moveStart = now;
}
