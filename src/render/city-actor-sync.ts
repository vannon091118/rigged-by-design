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
import { actorStateFor } from './rig-pose';

interface CityActorDeps {
  readonly renderer: Renderer;
  readonly world: Container;
  readonly depth: DepthStage;
  readonly stepMs: number;
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
      let art = this.#arts.get(actor.npcId);
      if (!art) {
        art = createGuestArt('CITY', actor.name, false, this.#arts.size * 0.9);
        art.sticker.visible = false;
        this.#arts.set(actor.npcId, art);
        world.addChild(art.root);
      }
      const x = (actor.x + 0.5) * TILE;
      const y = (actor.y + 0.8) * TILE;
      if (art.target.x !== x || art.target.y !== y) {
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

  clear(): void {
    for (const art of this.#arts.values()) art.root.destroy({ children: true });
    this.#arts.clear();
  }
}
