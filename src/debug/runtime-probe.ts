/** RBD Runtime Probe — DEV-only, READ-ONLY Gameplay-Diagnose (Haupteinstieg).
 *
 * Registriert sich als `window.__rbdProbe` und liefert JSON-serialisierbare
 * Diagnoseinformationen aus dem laufenden Spielzustand (World Store) und dem
 * PixiJS Renderer. Keine Spielaktionen, keine Geldwerte, keine NPC-Teleportation,
 * keine Zustandsmanipulation. Nutzt ausschließlich existierende Store- und
 * Render-Schnittstellen.
 */

import type { Overview, PlayerState, NpcState, FurnitureState, RenderInfo } from './runtime-probe-types.js';
import {
  getOverview,
  getWorldState,
  getPlayerState,
  getNpcStates,
  getFurniture,
  getRecentEvents,
} from './runtime-probe-snapshot.js';
import { getRenderInfo, compareRenderAndSim } from './runtime-probe-render.js';

const DEV = import.meta.env.DEV;

if (!DEV) {
  // In Produktion bleibt window.__rbdProbe undefiniert; die Datei hat keine Wirkung.
  void 0;
} else {
  const probe = {
    version: '1.0.0',
    mode: 'read-only',
    env: 'development',
    getOverview,
    getWorldState,
    getPlayerState,
    getNpcStates,
    getFurniture,
    getRecentEvents,
    getRenderInfo,
    compareRenderAndSim,
  };

  (window as Window & { __rbdProbe?: typeof probe }).__rbdProbe = probe;

  console.log('[rbd-probe] Runtime Probe bereitgestellt als window.__rbdProbe (DEV-only, read-only)');
}

export type { Overview, PlayerState, NpcState, FurnitureState, RenderInfo };
export { getOverview, getWorldState, getPlayerState, getNpcStates, getFurniture, getRecentEvents, getRenderInfo, compareRenderAndSim };
