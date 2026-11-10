/**
 * Arbeitsqualitaet auf dem Floor: welches Attribut welche Arbeit traegt.
 *
 * Die Rollen selbst sind aelter als dieses Modul: Bedienen, Schlichten,
 * Kasse, Reinigen und Reparieren laufen laengst ueber `actions`, `desk-service`
 * und die Interaktionskarte. Was fehlte, war der Leser fuer Wahrnehmung und
 * Technik - beide standen im Charakterfenster als "noch ohne Wirkung". Hier
 * bekommen sie genau eine Wirkung an genau einer vorhandenen Stelle:
 * Wahrnehmung weitet die Reinigung, Technik hebt die Wartung. Es gibt keinen
 * zweiten Faehigkeitszaehler; gelesen werden die vorhandenen Stufen aus
 * `player.rpg`.
 */
import type { RpgAttribute, PlayerRpgState } from './player-rpg';
import type { WorldState } from './types';

/** Rolle, die der Spieler auf dem Floor selbst ausfuellt. */
export type FloorRole = 'SERVE' | 'REPAIR' | 'CLEAN' | 'CASH' | 'SECURITY';

export interface FloorWorkRow {
  readonly role: FloorRole;
  readonly label: string;
  /** Attribut, das diese Arbeit traegt. */
  readonly attribute: RpgAttribute;
  readonly attributeLabel: string;
  readonly level: number;
  /** 0..100: wie gut dieselbe Arbeit mit dieser Stufe gelingt. */
  readonly quality: number;
  /** Die konkrete Wirkung im Spiel, aus derselben Formel wie die Aktion. */
  readonly effect: string;
}

export interface FloorWorkView {
  readonly rows: readonly FloorWorkRow[];
  /** Reinigungsradius in Tiles ab der eigenen Kachel. */
  readonly cleaningReach: number;
  /** Zustandspunkte, die eine Wartung mit dieser Technik gutschreibt. */
  readonly maintenanceGain: number;
  readonly note: string;
}

/** Basis fuer eine ungeuebte Hand; jede Stufe legt 5 Punkte drauf. */
const QUALITY_BASE = 50;
const QUALITY_PER_LEVEL = 5;
/** Ab dieser Wahrnehmung reinigt eine Handbewegung auch die Nachbarkacheln. */
const REACH_PERCEPTION = 4;
const REACH_MAX = 2;
/** Wartung: 20 Punkte Basis, 2 je Technikstufe, maximal 40. */
export const MAINTENANCE_BASE_GAIN = 20;
const MAINTENANCE_GAIN_PER_LEVEL = 2;
const MAINTENANCE_GAIN_MAX = 40;

function levelOf(rpg: PlayerRpgState, attr: RpgAttribute): number {
  if (attr === 'speed') return rpg.speedLevel;
  if (attr === 'charisma') return rpg.charismaLevel;
  if (attr === 'brawl') return rpg.brawlLevel;
  if (attr === 'perception') return rpg.perceptionLevel;
  if (attr === 'technique') return rpg.techniqueLevel;
  if (attr === 'endurance') return rpg.enduranceLevel;
  return rpg.luckLevel;
}

/** Dieselbe Formel fuer Anzeige und Wirkung; 0..100. */
export function workQuality(rpg: PlayerRpgState, attr: RpgAttribute): number {
  return Math.max(0, Math.min(100, QUALITY_BASE + levelOf(rpg, attr) * QUALITY_PER_LEVEL));
}

/** Wahrnehmung weitet die Reinigung; ohne Stufe bleibt es bei der eigenen Kachel. */
export function cleaningReach(world: WorldState): number {
  const perception = Math.max(0, world.player.rpg.perceptionLevel);
  return Math.max(1, Math.min(REACH_MAX, 1 + Math.floor(perception / REACH_PERCEPTION)));
}

/** Technik hebt die Wartung; Agent 10 bucht weiter nur den Preis, nicht den Gewinn. */
export function maintenanceGain(world: WorldState): number {
  const technique = Math.max(0, world.player.rpg.techniqueLevel);
  return Math.min(MAINTENANCE_GAIN_MAX, MAINTENANCE_BASE_GAIN + technique * MAINTENANCE_GAIN_PER_LEVEL);
}

/**
 * Kacheln, die eine Reinigung an dieser Stelle erwischt: die eigene zuerst,
 * dann die Nachbarn im Radius. Nur Kacheln im Raster; die Bezahlung richtet
 * sich nach der Anzahl der tatsaechlich schmutzigen Kacheln.
 */
export function cleaningArea(world: WorldState, tile: number, reach: number = cleaningReach(world)): readonly number[] {
  const size = world.size;
  const x = tile % size;
  const y = Math.floor(tile / size);
  if (!Number.isInteger(tile) || x < 0 || y < 0 || y >= size) return [];
  const tiles: number[] = [tile];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > reach) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      tiles.push(ny * size + nx);
    }
  }
  return tiles;
}

/** Eine Sicht fuer Charakterfenster und Tests; sie rechnet nichts nach. */
export function floorWorkView(world: WorldState): FloorWorkView {
  const rpg = world.player.rpg;
  const reach = cleaningReach(world);
  const gain = maintenanceGain(world);
  const rows: readonly FloorWorkRow[] = [
    { role: 'SERVE', label: 'Bedienen', attribute: 'charisma', attributeLabel: 'Charisma',
      level: levelOf(rpg, 'charisma'), quality: workQuality(rpg, 'charisma'),
      effect: `${40 + rpg.charismaLevel * 10} % Ansprech-Chance, Getraenke und Schlichten` },
    { role: 'REPAIR', label: 'Reparieren', attribute: 'technique', attributeLabel: 'Technik',
      level: levelOf(rpg, 'technique'), quality: workQuality(rpg, 'technique'),
      effect: `Wartung +${gain} Zustandspunkte je Einsatz` },
    { role: 'CLEAN', label: 'Reinigen', attribute: 'perception', attributeLabel: 'Wahrnehmung',
      level: levelOf(rpg, 'perception'), quality: workQuality(rpg, 'perception'),
      effect: `Reinigung im Radius ${reach}` },
    { role: 'CASH', label: 'Kasse', attribute: 'speed', attributeLabel: 'Speed',
      level: levelOf(rpg, 'speed'), quality: workQuality(rpg, 'speed'),
      effect: 'Wechseln und Auszahlung am Desk' },
    { role: 'SECURITY', label: 'Sicherheit', attribute: 'brawl', attributeLabel: 'Brawl',
      level: levelOf(rpg, 'brawl'), quality: workQuality(rpg, 'brawl'),
      effect: `${6 + rpg.brawlLevel * 2} Schaden, ${60 + rpg.brawlLevel * 6} LP` },
  ];
  const note = reach > 1 || gain > MAINTENANCE_BASE_GAIN
    ? `Wahrnehmung reinigt im Radius ${reach}, Technik hebt die Wartung auf +${gain}.`
    : 'Noch ohne Uebung: Reinigung nur auf der eigenen Kachel, Wartung bei +20.';
  return { rows, cleaningReach: reach, maintenanceGain: gain, note };
}
