/** Zustandsmarker ueber dem Spieler: Verletzung und Handgemenge auf dem Floor. */
import type { Graphics } from 'pixi.js';
import { ROLE } from './art-tokens';

interface PlayerMarkerState {
  readonly injured: boolean;
  readonly fighting: boolean;
  readonly won: boolean;
}

/** Roter Balken fuer die Verletzung, Treffersterne fuer das Handgemenge; sonst nichts. */
export function drawPlayerMarker(marker: Graphics, state: PlayerMarkerState): void {
  if (!state.injured && !state.fighting) {
    marker.visible = false;
    return;
  }
  marker.visible = true;
  marker.clear();
  if (state.fighting) {
    marker.star(0, -36, 6, 9, 4).fill(state.won ? ROLE.service : ROLE.danger);
    marker.star(11, -30, 5, 5, 2.5).fill(ROLE.value);
    return;
  }
  marker.rect(-2, -38, 4, 12).fill(ROLE.danger);
  marker.rect(-2, -24, 4, 4).fill(ROLE.danger);
}
