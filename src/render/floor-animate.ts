/** Floor-Animation: Tick, Kamera, Figuren-Animation. */
import { TICK_MS } from '../core/sim/tick-timing';
import type { CityActorSync } from './city-actor-sync';
import type { FloorCameraRig } from './floor-camera-rig';
import type { GuestArt } from './guest-art';
import { ActorPool } from './actor-pool';
import { FloorProps } from './floor-props';
import { FloorCues } from './floor-cues';
import { gaitFor } from './locomotion';

export function animateFloor(
  now: number,
  rig: FloorCameraRig,
  actors: ActorPool,
  player: GuestArt,
  cues: FloorCues,
  props: FloorProps,
  cityActors: CityActorSync,
): void {
  rig.follow(player.root.x, player.root.y);
  // Bewohner laufen im selben Frame-Ticker wie Gaeste und Spieler (#640).
  cityActors.animate(now);
  for (const art of actors.active.values()) {
    art.animate(now);
    const t = Math.min(1, (now - art.moveStart) / TICK_MS);
    const gaitFrame = gaitFor(art.target.x - art.from.x, Math.floor(now / TICK_MS), art.phase, art.facing,
      art.target.y - art.from.y);
    const walking = t < 1 && gaitFrame.moving;
    const gait = walking ? Math.sin((now / 1000) * 12 + gaitFrame.frame) * 0.3 : 0;
    art.setFacing(gaitFrame.facing);
    art.root.x = art.from.x + (art.target.x - art.from.x) * t;
    art.root.y = art.from.y + (art.target.y - art.from.y) * t + gait + (walking ? Math.abs(gait) * 1.5 : 0);
    art.root.rotation = gait * 0.14;
    art.sticker.position.set(art.root.x, art.root.y);
  }
  player.animate(now);
  const pt = Math.min(1, (now - player.moveStart) / TICK_MS);
  const playerGait = gaitFor(player.target.x - player.from.x, Math.floor(now / TICK_MS), player.phase, player.facing,
    player.target.y - player.from.y);
  const pwalking = pt < 1 && playerGait.moving;
  player.setFacing(playerGait.facing);
  const pgait = pwalking ? Math.sin((now / 1000) * 12 + playerGait.frame) * 0.3 : 0;
  player.root.x = player.from.x + (player.target.x - player.from.x) * pt;
  player.root.y = player.from.y + (player.target.y - player.from.y) * pt + pgait + (pwalking ? Math.abs(pgait) * 1.5 : 0);
  player.root.rotation = pgait * 0.14;
  player.sticker.position.set(player.root.x, player.root.y);
  cues.animate(now, player.root);
  props.walk(now, TICK_MS);
}
