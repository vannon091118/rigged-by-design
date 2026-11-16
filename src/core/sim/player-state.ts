import type { OwnedSite } from './sites';
import type { Point, PlayerNeeds } from './types-model';
import type { PlayerRpgState } from './player-rpg';
import type { PlayerJobState } from './job-types';
import type { PlayerSkillState } from './player-skills';

export interface Player {
  position: Point; path: Point[]; pathIndex: number; carrying: string; rpg: PlayerRpgState;
  /** Persistente Spielerbeduerfnisse; Teil desselben Zustands wie Position und RPG. */
  needs: PlayerNeeds;
  job: PlayerJobState | null; barPurchased: boolean;
  /** Eigene Standorte; der Progressionspfad beginnt beim ersten gekauften Standort. */
  properties: OwnedSite[];
  /** Spieler-Fach-Skills (Learn-by-Doing); separat von den RPG-Attributen. */
  skills: PlayerSkillState;
}
