/** Floor-Animation: Tick, Kamera, Figuren-Animation. */
import type { Application } from 'pixi.js';
import type { WorldState } from '../core/sim/types';
import { TICK_MS } from '../core/sim/tick-timing';
import type { FloorCamera } from './floor-camera';
import type { GuestArt } from './guest-art';
import { ActorPool } from './actor-pool';
import { FloorProps } from './floor-props';
import { FloorCues } from './floor-cues';

export function animateFloor(
  now: number,
  app: Application,
  cam: FloorCamera,
  view: WorldState,
  camDirty: boolean,
  actors: ActorPool,
  player: GuestArt,
  cues: FloorCues,
  props: FloorProps,
): void {
  cam.keepInView(player.root.x, player.root.y, app.screen.width, app.screen.height, view.size);
  const moving = cam.step();
  if (moving || camDirty) {
    // Kamera-Update erfolgt extern über FloorView.applyCamera
  }
  for (const art of actors.active.values()) {
    art.animate(now);
    const t = Math.min(1, (now - art.moveStart) / TICK_MS);
    const walking = t < 1;
    const gait = walking ? Math.sin((now / 1000) * 12 + art.phase) * 0.3 : 0;
    art.root.x = art.from.x + (art.target.x - art.from.x) * t;
    art.root.y = art.from.y + (art.target.y - art.from.y) * t + gait + (walking ? Math.abs(gait) * 1.5 : 0);
    art.root.rotation = gait * 0.14;
    art.sticker.position.set(art.root.x, art.root.y);
  }
  player.animate(now);
  cues.animate(now, player.root);
  props.walk(now, TICK_MS);
}
