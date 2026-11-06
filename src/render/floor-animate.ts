/** Floor-Animation: Tick, Kamera, Figuren-Animation. */
import { TICK_MS } from '../core/sim/tick-timing';
import type { FloorCameraRig } from './floor-camera-rig';
import type { GuestArt } from './guest-art';
import { ActorPool } from './actor-pool';
import { FloorProps } from './floor-props';
import { FloorCues } from './floor-cues';

export function animateFloor(
  now: number,
  rig: FloorCameraRig,
  actors: ActorPool,
  player: GuestArt,
  cues: FloorCues,
  props: FloorProps,
): void {
  rig.follow(player.root.x, player.root.y);
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
  const pt = Math.min(1, (now - player.moveStart) / TICK_MS);
  const pwalking = pt < 1;
  const pgait = pwalking ? Math.sin((now / 1000) * 12 + player.phase) * 0.3 : 0;
  player.root.x = player.from.x + (player.target.x - player.from.x) * pt;
  player.root.y = player.from.y + (player.target.y - player.from.y) * pt + pgait + (pwalking ? Math.abs(pgait) * 1.5 : 0);
  player.root.rotation = pgait * 0.14;
  player.sticker.position.set(player.root.x, player.root.y);
  cues.animate(now, player.root);
  props.walk(now, TICK_MS);
}
