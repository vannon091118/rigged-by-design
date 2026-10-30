/** Requisiten: Personal, Lieferkisten, Streitmarker und Platzierungs-Geist. Liest nur Snapshots. */
import { Container, Graphics, Text } from 'pixi.js';
import { canPlaceAt } from '../core/sim/grid-zones';
import { getBuildDef } from '../core/sim/offers';
import { TILE, type StaffRole } from '../core/sim/types';
import type { GameView } from '../store/types';
import { isVisible, type ViewRect } from './floor-math';
import { createGuestArt, type GuestArt } from './guest-art';

const AGENT_STYLE: Record<StaffRole, { persona: string; name: string }> = {
  guard: { persona: 'HIGH_ROLLER', name: 'Guard' },
  cleaner: { persona: 'LUMPEN', name: 'Putzkraft' },
  bartender: { persona: 'STREET', name: 'Bar' },
  cashier: { persona: 'BUSINESS', name: 'Kasse' },
  porter: { persona: 'STAMMGAST', name: 'Portier' },
};

const CRATE_COLOR: Record<string, number> = { FURNITURE: 0x8a6a3a, DRINKS: 0x2e8a6a, PARTS: 0x6a5a8a };

interface Layers {
  readonly props: Container;
  readonly actors: Container;
  readonly stickers: Container;
}

export class FloorProps {
  readonly #agents = new Map<number, GuestArt>();
  readonly #crates = new Map<number, { root: Container; hidden: boolean }>();
  readonly #disputes = new Map<number, Graphics>();
  readonly #ghost = new Graphics();
  readonly #onActors: (art: GuestArt) => void;
  readonly #props: Container;
  #ghostId: string | null = null;
  #view: GameView | null = null;

  constructor(
    layers: Layers,
    camera: Container,
    onActors: (art: GuestArt) => void,
  ) {
    this.#props = layers.props;
    this.#props.addChild(this.#ghost);
    this.#ghost.visible = false;
    this.#onActors = onActors;
    camera.on('pointermove', (event) => this.#hover(event.getLocalPosition(camera)));
  }

  setGhost(buildId: string | null): void {
    this.#ghostId = buildId;
    if (!buildId) this.#ghost.visible = false;
  }

  update(view: GameView, rect: ViewRect, lod: number): void {
    this.#view = view;
    this.#syncAgents(view, rect, lod);
    this.#syncCrates(view, rect);
    this.#syncDisputes(view, rect);
  }

  walk(now: number, stepMs: number): void {
    for (const art of this.#agents.values()) {
      const t = Math.min(1, (now - art.moveStart) / stepMs);
      if (t >= 1) continue;
      const gait = Math.sin((now / 1000) * 12 + art.phase);
      art.root.x = art.from.x + (art.target.x - art.from.x) * t;
      art.root.y = art.from.y + (art.target.y - art.from.y) * t + Math.abs(gait) * 1.5;
      art.root.rotation = gait * 0.14;
      art.sticker.position.set(art.root.x, art.root.y);
    }
    for (const [id, marker] of this.#disputes) {
      const pulse = 1 + Math.sin(now / 300 + id) * 0.12;
      marker.scale.set(pulse);
    }
  }

  destroy(layers: Layers): void {
    for (const art of this.#agents.values()) {
      layers.actors.removeChild(art.root);
      layers.stickers.removeChild(art.sticker);
      art.root.destroy({ children: true });
      art.sticker.destroy({ children: true });
    }
    this.#agents.clear();
    for (const crate of this.#crates.values()) crate.root.destroy({ children: true });
    this.#crates.clear();
    for (const marker of this.#disputes.values()) marker.destroy();
    this.#disputes.clear();
    this.#ghost.destroy();
  }

  #syncAgents(view: GameView, rect: ViewRect, lod: number): void {
    const seen = new Set<number>();
    for (const agent of view.agents) {
      seen.add(agent.id);
      let art = this.#agents.get(agent.id);
      if (!art) {
        const style = AGENT_STYLE[agent.role];
        art = createGuestArt(style.persona, style.name, false, agent.id * 1.3);
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
      art.setMood(70, false, 0);
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

  #syncCrates(view: GameView, rect: ViewRect): void {
    const seen = new Set<number>();
    for (const crate of view.crates) {
      seen.add(crate.id);
      let entry = this.#crates.get(crate.id);
      if (!entry) {
        const root = new Container();
        const g = new Graphics();
        const kind = crate.payload.kind;
        g.roundRect(0, 0, TILE, TILE, 3).fill(0x2a1c10).stroke({ width: 2, color: CRATE_COLOR[kind] ?? 0x8a6a3a });
        g.moveTo(0, TILE / 2).lineTo(TILE, TILE / 2).stroke({ width: 1, color: 0x8a6a3a });
        g.moveTo(TILE / 2, 0).lineTo(TILE / 2, TILE).stroke({ width: 1, color: 0x8a6a3a });
        const tag = new Text({
          text: kind === 'FURNITURE' ? 'MÖBEL' : kind === 'DRINKS' ? 'GLAS' : 'TEILE',
          style: { fontFamily: 'ui-monospace, monospace', fontSize: 6, fill: 0xffd9a0 },
        });
        tag.anchor.set(0.5, 0.5);
        tag.position.set(TILE / 2, TILE / 2);
        root.addChild(g, tag);
        root.position.set(crate.x * TILE, crate.y * TILE);
        entry = { root, hidden: false };
        this.#crates.set(crate.id, entry);
        this.#props.addChild(root);
      }
      const hidden = crate.carriedBy !== null;
      entry.hidden = hidden;
      entry.root.visible = !hidden && isVisible(crate.x * TILE, crate.y * TILE, TILE, TILE, rect, 0);
    }
    for (const [id, entry] of this.#crates) {
      if (seen.has(id)) continue;
      entry.root.destroy({ children: true });
      this.#crates.delete(id);
    }
  }

  #syncDisputes(view: GameView, rect: ViewRect): void {
    const seen = new Set<number>();
    for (const dispute of view.disputes) {
      seen.add(dispute.id);
      let marker = this.#disputes.get(dispute.id);
      if (!marker) {
        marker = new Graphics();
        marker.circle(0, 0, TILE * (dispute.level > 1 ? 1.2 : 0.8)).stroke({ width: 3, color: 0xff4d5e });
        marker.circle(0, 0, 4).fill(0xff4d5e);
        marker.star(0, 0, 8, TILE * 0.7, TILE * 0.45).fill({ color: 0xffd23f, alpha: 0.6 });
        marker.position.set((dispute.x + 0.5) * TILE, (dispute.y + 0.5) * TILE);
        this.#disputes.set(dispute.id, marker);
        this.#props.addChild(marker);
      }
      marker.visible = isVisible(dispute.x * TILE, dispute.y * TILE, TILE, TILE, rect, TILE);
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
      const ok = canPlaceAt(view.size, view.furniture, blockers, x, y, def.w, def.h, def.seats > 0);
      this.#ghost.clear();
      this.#ghost.roundRect(x * TILE, y * TILE, def.w * TILE, def.h * TILE, 4)
        .fill({ color: ok ? 0x00ffcc : 0xff4d5e, alpha: 0.3 })
        .stroke({ width: 2, color: ok ? 0x00ffcc : 0xff4d5e });
      this.#ghost.visible = true;
    } catch {
      this.#ghost.visible = false;
    }
  }
}
