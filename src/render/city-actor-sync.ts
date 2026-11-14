/**
 * Stadtbewohner als Straßenfiguren.
 *
 * Die Simulation liefert Position und Reisestatus (`GameView.cityActors`);
 * hier entsteht daraus je NPC genau eine Figur. Die Karte haengt an der
 * Kennung, nicht am Array-Index: Ein Bewohner bleibt ueber Ticks dieselbe
 * Figur, auch wenn die Liste waechst (#505).
 */
import type { Container, Renderer } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import type { DepthStage } from './depth';
import { createGuestArt, type GuestArt } from './guest-art';
import { gaitFor } from './locomotion';
import { actorStateFor } from './rig-pose';

interface CityActorDeps {
  readonly renderer: Renderer;
  readonly world: Container;
  readonly depth: DepthStage;
  readonly stepMs: number;
}

/**
 * Fortschritt eines Figurenzugs zwischen zwei Snapshot-Punkten.
 *
 * Reine Funktion und ohne Pixi testbar: `0` heisst Start, `1` heisst Ziel.
 * `stepMs` ist der vorhandene Tick; eine zweite Uhr gibt es nicht.
 */
export function actorProgress(moveStart: number, now: number, stepMs: number): number {
  if (!Number.isFinite(stepMs) || stepMs <= 0) return 1;
  const raw = (now - moveStart) / stepMs;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(1, raw);
}

/** Stabile Zahlenkennung fuer die Tiefenebene; Bewohner-IDs sind Strings. */
function actorKey(npcId: string): number {
  let hash = 0;
  for (let index = 0; index < npcId.length; index += 1) {
    hash = (Math.imul(hash, 31) + npcId.charCodeAt(index)) | 0;
  }
  return 1_000_000 + Math.abs(hash) % 100_000;
}

export class CityActorSync {
  readonly #deps: CityActorDeps;
  readonly #arts = new Map<string, GuestArt>();

  constructor(deps: CityActorDeps) {
    this.#deps = deps;
  }

  sync(view: GameView, now: number, lod: number): void {
    const { world, depth, stepMs } = this.#deps;
    if (view.scene.kind !== 'CITY') {
      this.clear();
      return;
    }
    const seen = new Set<string>();
    for (const actor of view.cityActors) {
      seen.add(actor.npcId);
      const x = (actor.x + 0.5) * TILE;
      const y = (actor.y + 0.8) * TILE;
      let art = this.#arts.get(actor.npcId);
      if (!art) {
        art = createGuestArt('CITY', actor.name, false, this.#arts.size * 0.9);
        art.sticker.visible = false;
        this.#arts.set(actor.npcId, art);
        world.addChild(art.root);
        // Neue Figur sofort an die Snapshot-Position setzen; sonst erscheint
        // sie einen Tick lang am Ursprung (#640).
        art.root.x = x;
        art.root.y = y;
        art.from.x = x;
        art.from.y = y;
        art.target.x = x;
        art.target.y = y;
        art.moveStart = now - stepMs;
      } else if (art.target.x !== x || art.target.y !== y) {
        art.from.x = art.root.x;
        art.from.y = art.root.y;
        art.target.x = x;
        art.target.y = y;
        art.moveStart = now - stepMs;
      }
      art.root.visible = true;
      art.setMood(62, false, 0);
      art.setState(actorStateFor({
        state: actor.traveling ? 'ENTER' : 'WAIT',
        pathLength: actor.traveling ? 1 : 0, pathIndex: 0,
      }));
      art.setNameVisible(false);
      art.setLod(lod === 1);
      depth.set(art.root, art.root.y, 'actor', actorKey(actor.npcId));
    }
    for (const [id, art] of this.#arts) {
      if (seen.has(id)) continue;
      art.root.destroy({ children: true });
      this.#arts.delete(id);
    }
  }

  /**
   * Schreibt dieselben Figuren ueber den vorhandenen Floor-Ticker fort.
   *
   * Position, Blickrichtung, Sticker und Tiefe kommen aus der tatsaechlich
   * gerenderten Position; kein zweiter Ticker und keine neue NPC-Wahrheit.
   */
  animate(now: number): void {
    const { depth, stepMs } = this.#deps;
    for (const [npcId, art] of this.#arts) {
      const t = actorProgress(art.moveStart, now, stepMs);
      const gaitFrame = gaitFor(
        art.target.x - art.from.x, Math.floor(now / stepMs), art.phase, art.facing,
        art.target.y - art.from.y,
      );
      const walking = t < 1 && gaitFrame.moving;
      const gait = walking ? Math.sin((now / 1000) * 12 + gaitFrame.frame) * 0.3 : 0;
      art.animate(now);
      art.setFacing(gaitFrame.facing);
      art.root.x = art.from.x + (art.target.x - art.from.x) * t;
      art.root.y = art.from.y + (art.target.y - art.from.y) * t + gait + (walking ? Math.abs(gait) * 1.5 : 0);
      art.root.rotation = gait * 0.14;
      art.sticker.position.set(art.root.x, art.root.y);
      depth.set(art.root, art.root.y, 'actor', actorKey(npcId));
    }
  }

  clear(): void {
    for (const art of this.#arts.values()) art.root.destroy({ children: true });
    this.#arts.clear();
  }
}
