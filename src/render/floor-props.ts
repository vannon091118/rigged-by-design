/** Requisiten: Personal, Lieferkisten, Streitmarker und Platzierungs-Geist. Liest nur Snapshots. */
import { Container, Graphics } from 'pixi.js';
import { canPlaceAt } from '../core/sim/grid-zones';
import { getBuildDef } from '../core/sim/offers';
import { TILE, type StaffRole } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ROLE, STROKE } from './art-tokens';
import { isVisible, type ViewRect } from './floor-math';
import { FloorCash } from './floor-cash';
import type { DepthStage } from './depth';
import { createGuestArt, type GuestArt } from './guest-art';
import { actorStateFor } from './rig-pose';
import { gaitFor } from './locomotion';
import { FloorCrates } from './floor-crates';

const AGENT_STYLE: Record<StaffRole, { persona: string; name: string }> = {
  guard: { persona: 'HIGH_ROLLER', name: 'Guard' },
  cleaner: { persona: 'LUMPEN', name: 'Putzkraft' },
  bartender: { persona: 'STREET', name: 'Bar' },
  cashier: { persona: 'BUSINESS', name: 'Kasse' },
  porter: { persona: 'STAMMGAST', name: 'Portier' },
};

interface Layers {
  readonly world: Container;
  readonly overhead: Container;
  readonly stickers: Container;
  readonly depth: DepthStage;
}

export class FloorProps {
  readonly #agents = new Map<number, GuestArt>();
  readonly #crates: FloorCrates;
  readonly #disputes = new Map<number, Graphics>();
  readonly #ghost = new Graphics();
  readonly #cash = new FloorCash();
  readonly #onActors: (art: GuestArt) => void;
  readonly #world: Container;
  readonly #depth: DepthStage;
  #ghostId: string | null = null;
  #view: GameView | null = null;

  constructor(
    layers: Layers,
    camera: Container,
    onActors: (art: GuestArt) => void,
  ) {
    this.#world = layers.world;
    this.#depth = layers.depth;
    // Der Platzierungs-Geist ist Bedienoberflaeche und liegt ueber der Welt.
    layers.overhead.addChild(this.#ghost);
    this.#world.addChild(this.#cash.root);
    this.#ghost.visible = false;
    this.#crates = new FloorCrates(layers.world, layers.depth);
    this.#onActors = onActors;
    camera.on('pointermove', (event) => this.#hover(event.getLocalPosition(camera)));
  }

  /** Nur fuer Tests und Inspektion: gerenderte Figur einer Personal-ID. */
  agentArt(id: number): GuestArt | undefined {
    return this.#agents.get(id);
  }

  /** Nur fuer Tests und Inspektion: gerenderte Kiste. */
  crateRoot(id: number): Container | undefined {
    return this.#crates.crateRoot(id);
  }

  setGhost(buildId: string | null): void {
    this.#ghostId = buildId;
    if (!buildId) this.#ghost.visible = false;
  }

  update(view: GameView, rect: ViewRect, lod: number): void {
    this.#view = view;
    const cashAnchor = this.#cash.sync(view);
    // Am Fusspunkt des Tisches, aber nach ihm: die Chips liegen sichtbar auf der Platte, Gäste bleiben davor.
    if (cashAnchor !== null) this.#depth.set(this.#cash.root, cashAnchor, 'furniture', 999);
    this.#syncAgents(view, rect, lod);
    this.#crates.sync(view, rect, this.#agents);
    this.#syncDisputes(view, rect);
  }

  walk(now: number, stepMs: number): void {
    this.#cash.pulse(now);
    for (const art of this.#agents.values()) {
      // Personal laeuft im selben Rig-Vertrag wie Gaeste: Animation, Facing und
      // Gang statt eines nur verschobenen Wurzelknotens (#514).
      art.animate(now);
      const t = Math.min(1, (now - art.moveStart) / stepMs);
      const frame = gaitFor(art.target.x - art.from.x, Math.floor(now / stepMs), art.phase, art.facing,
        art.target.y - art.from.y);
      const walking = t < 1 && frame.moving;
      art.setFacing(frame.facing);
      const gait = walking ? Math.sin((now / 1000) * 12 + frame.frame) * 0.3 : 0;
      art.root.x = art.from.x + (art.target.x - art.from.x) * t;
      art.root.y = art.from.y + (art.target.y - art.from.y) * t + gait + (walking ? Math.abs(gait) * 1.5 : 0);
      art.root.rotation = gait * 0.14;
      art.sticker.position.set(art.root.x, art.root.y);
    }
    this.#crates.walk(this.#agents);
  }

  destroy(layers: Layers): void {
    for (const art of this.#agents.values()) {
      layers.world.removeChild(art.root);
      layers.stickers.removeChild(art.sticker);
      art.root.destroy({ children: true });
      art.sticker.destroy({ children: true });
    }
    this.#agents.clear();
    this.#crates.destroy();
    for (const marker of this.#disputes.values()) marker.destroy();
    this.#disputes.clear();
    this.#ghost.destroy();
    this.#cash.destroy();
  }

  #syncAgents(view: GameView, rect: ViewRect, lod: number): void {
    const seen = new Set<number>();
    for (const agent of view.agents) {
      seen.add(agent.id);
      let art = this.#agents.get(agent.id);
      if (!art) {
        const style = AGENT_STYLE[agent.role];
        art = createGuestArt(style.persona, style.name, false, agent.id * 1.3, undefined, true);
        // Bodenring in der Service-Farbe: Personal ist auf dichtem Floor sofort zuordenbar.
        const ring = new Graphics()
          .ellipse(0, 12, 9, 4).stroke({ width: STROKE.hair, color: ROLE.service, alpha: 0.55 });
        art.root.addChildAt(ring, 0);
        art.root.position.set((agent.x + 0.5) * TILE, (agent.y + 0.8) * TILE);
        art.target.x = art.root.x;
        art.target.y = art.root.y;
        art.from.x = art.root.x;
        art.from.y = art.root.y;
        this.#agents.set(agent.id, art);
        this.#onActors(art);
      }
      const tx = (agent.x + 0.5) * TILE;
      const ty = (agent.y + 0.8) * TILE;
      if (art.target.x !== tx || art.target.y !== ty) {
        art.from.x = art.root.x;
        art.from.y = art.root.y;
        art.target.x = tx;
        art.target.y = ty;
        art.moveStart = performance.now();
      }
      this.#depth.set(art.root, art.root.y, 'actor', agent.id);
      art.setMood(70, false, 0);
      // Task und Tragezustand sind Renderzustand, nicht nur Snapshot-Daten.
      art.setState(actorStateFor({
        state: agent.pathIndex < agent.path.length ? 'ENTER' : 'WAIT',
        pathLength: agent.path.length, pathIndex: agent.pathIndex,
        carrying: agent.carryingCrate !== null ? 'KRATE:1' : undefined,
      }));
      art.setLod(lod === 1);
      const visible = isVisible(art.root.x, art.root.y, 0, 0, rect, 40);
      art.root.visible = visible;
      art.sticker.visible = false;
    }
    for (const [id, art] of this.#agents) {
      if (seen.has(id)) continue;
      art.root.destroy({ children: true });
      art.sticker.destroy({ children: true });
      this.#agents.delete(id);
    }
  }

  #syncDisputes(view: GameView, rect: ViewRect): void {
    const seen = new Set<number>();
    for (const dispute of view.disputes) {
      seen.add(dispute.id);
      let marker = this.#disputes.get(dispute.id);
      if (!marker) {
        marker = new Graphics();
        marker.circle(0, 0, TILE * (dispute.level > 1 ? 1.2 : 0.8)).stroke({ width: STROKE.heavy, color: ROLE.danger });
        marker.circle(0, 0, 4).fill(ROLE.danger);
        marker.star(0, 0, 8, TILE * 0.7, TILE * 0.45).fill({ color: ROLE.value, alpha: 0.55 });
        marker.position.set((dispute.x + 0.5) * TILE, (dispute.y + 0.5) * TILE);
        this.#disputes.set(dispute.id, marker);
        this.#world.addChild(marker);
      }
      marker.visible = isVisible(dispute.x * TILE, dispute.y * TILE, TILE, TILE, rect, TILE);
      this.#depth.set(marker, (dispute.y + 1) * TILE, 'prop', dispute.id);
    }
    for (const [id, marker] of this.#disputes) {
      if (seen.has(id)) continue;
      marker.destroy();
      this.#disputes.delete(id);
    }
  }

  #hover(local: { x: number; y: number }): void {
    if (!this.#ghostId || !this.#view) {
      this.#ghost.visible = false;
      return;
    }
    const x = Math.floor(local.x / TILE);
    const y = Math.floor(local.y / TILE);
    const view = this.#view;
    if (x < 0 || y < 0 || x >= view.size || y >= view.size) {
      this.#ghost.visible = false;
      return;
    }
    try {
      const def = getBuildDef(this.#ghostId as never);
      const blockers = [view.player.position, ...view.guests.map((guest) => guest.position)];
      const ok = canPlaceAt(view.size, view.furniture, blockers, x, y, def.w, def.h, def.seats > 0, view.layout);
      this.#ghost.clear();
      this.#ghost.roundRect(x * TILE, y * TILE, def.w * TILE, def.h * TILE, 4)
        .fill({ color: ok ? ROLE.service : ROLE.danger, alpha: 0.28 })
        .stroke({ width: STROKE.base, color: ok ? ROLE.service : ROLE.danger });
      this.#ghost.visible = true;
    } catch {
      this.#ghost.visible = false;
    }
  }
}
