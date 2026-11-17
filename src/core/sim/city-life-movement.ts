/**
 * @module city-life-movement — Weg, Dauer und Zwischenstand der Stadtbewohner
 *
 * Ein Ortswechsel ist keine Etikette: Der Bewohner steht auf einer Kachel, das
 * Ziel ist die Tür seines Gebäudes, der Weg kommt aus dem vorhandenen A*
 * (`findPath`) auf der echten Stadt-Navigation (`cityNav`) und wird pro Tick
 * abgelaufen. Ein unerreichbares Ziel wird protokolliert und nicht als
 * Teleport gebucht; der Bewohner bleibt stehen und versucht es später erneut.
 *
 * Welches Ziel ein Bewohner anläuft, entscheidet die Not: Hunger schickt ihn
 * zum Essen, Durst in die Kneipe, die Schicht an den Arbeitsplatz. Dieses Modul
 * kennt deshalb nur Ziele, keine Absichten — der Score bleibt die einzige
 * Entscheidungsstelle.
 */
import type { CitySceneState } from './city-scene';
import { cityNav } from './city-scene';
import { buildingById } from './city-life-venues';
import { PLAYER_HOME_BUILDING } from './city-households';
import type { BuildingState } from './building-types';
import type { CityLifePlace, CityResidentState } from './city-life-types';
import type { Point } from './types-model';
import { findPath, isWalkable, nearestWalkable } from './pathfinding';
import { ensureCityLife } from './city-life-state';
import { clampNeed, driftNeed } from './needs-core';
import { applyIntentEffects } from './city-life-effects';
import { addMemory, socialMemory } from './city-life-memory';
import { selectSocialEncounter } from './social-encounter';
import { clampInt } from './num';
import { createCityScene } from './city-scene';
import { applyPush, createOccupancy, moveOccupant, resolveStep, separatePositions } from './city-tile-occupancy';
import { NARRATIVE_LIMITS } from './narrative/types';
import type { WorldState } from './types';

/** Kacheln pro Tick: bei 25 Ticks je Stunde sind das 25 Kacheln je Stunde. */
export const TILES_PER_TICK = 1;
/**
 * Ankunft kostet Muedigkeit: je acht Kacheln ein Punkt. Der Weg ist damit
 * keine Etikette — ein weiter Umweg veraendert die naechste Entscheidung.
 * Gerechnet wird in ganzen Punkten, weil Beduerfnisse ganzzahlig gespeichert
 * werden und ein Rundungsrest sonst beim Laden verschwaende.
 */
const TILES_PER_FATIGUE = 8;
const travelFatigue = (pathLength: number): number =>
  Math.max(1, Math.round((pathLength - 1) / TILES_PER_FATIGUE));
/** Obergrenze je Aufruf, damit ein langer Tick nicht durch die Stadt springt. */
const MAX_STEPS = 8;

export interface CityTravel {
  readonly to: CityLifePlace;
  /** Weg inklusive Startkachel; `path[0]` ist die Position beim Aufbruch. */
  readonly path: readonly Point[];
  /** Index der zuletzt erreichten Kachel. */
  readonly index: number;
}

let sharedMap: CitySceneState | null = null;

/**
 * Die Stadtkarte ist statisch: Ein Bewohner, der in einem anderen Floor
 * simuliert wird, laeuft auf derselben Karte. Sie wird deshalb nicht in den
 * Weltzustand geschrieben, sondern einmal geteilt.
 */
export function cityMap(world: WorldState): CitySceneState {
  if (world.cityScene) return world.cityScene;
  sharedMap ??= createCityScene();
  return sharedMap;
}

/** Zielkachel eines Ortes: die Tür seines Gebäudes, sonst der Ort selbst. */
export function placeEntrance(
  place: CityLifePlace,
  homeBuildingId?: string | null,
  buildings?: readonly BuildingState[],
): Point | null {
  const id = place === 'HOME' ? homeBuildingId ?? PLAYER_HOME_BUILDING : placeBuildingId(place);
  const building = buildings?.find((entry) => entry.id === id) ?? buildingById(id);
  return building ? { ...building.entrance } : null;
}

function placeBuildingId(place: CityLifePlace): string {
  switch (place) {
    case 'HOME': return 'bld_player_home';
    case 'KIEZ': return 'bld_kiez_pub';
    case 'MARKT': return 'bld_corner_shop';
    case 'CASINO': return 'bld_casino_grand';
  }
}

/**
 * Route zu einem Ort. Ist die Tür versperrt, geht der Weg zur nächsten freien
 * Kachel davor; ist auch das unmöglich, gibt es keinen Weg (kein Teleport).
 */
export function routeTo(
  city: CitySceneState, from: Point, place: CityLifePlace, homeBuildingId?: string | null,
): Point[] {
  const nav = cityNav(city);
  const start = isWalkable(nav, from.x, from.y) ? from : nearestWalkable(nav, from);
  if (!start) return [];
  const entrance = placeEntrance(place, homeBuildingId, city.exterior.buildings);
  if (!entrance) return [];
  const goal = nearestWalkable(nav, entrance);
  if (!goal) return [];
  return findPath(nav, start, goal);
}

/**
 * Aufbruch zu einem Ort. `here` heisst: schon an der Tür, der Ort gilt sofort.
 * `travel: null` ohne `here` heisst: kein Weg, also kein Teleport.
 */
export function startTravel(
  position: Point, city: CitySceneState, place: CityLifePlace, homeBuildingId?: string | null,
): { readonly travel: CityTravel | null; readonly here: boolean } {
  const path = routeTo(city, position, place, homeBuildingId);
  if (path.length === 0) return { travel: null, here: false };
  if (path.length === 1) return { travel: null, here: true };
  return { travel: { to: place, path, index: 0 }, here: false };
}

/**
 * Ein Tick Bewegung. Rückgabe ist der neue Stand; `arrived` sagt, ob der Weg in
 * diesem Tick zu Ende ging. Es wird nie mehr als `steps` Kacheln gesprungen.
 */
export function advanceTravel(
  travel: CityTravel, steps = TILES_PER_TICK,
): { readonly travel: CityTravel | null; readonly position: Point; readonly arrived: boolean } {
  const limit = travel.path.length - 1;
  const index = Math.min(limit, travel.index + Math.max(1, Math.min(MAX_STEPS, Math.floor(steps))));
  const position = travel.path[index]!;
  if (index >= limit) return { travel: null, position, arrived: true };
  return { travel: { ...travel, index }, position, arrived: false };
}

/** Restweg in Kacheln; 0 heisst angekommen. */
export function remainingTiles(travel: CityTravel | null): number {
  if (!travel) return 0;
  return Math.max(0, travel.path.length - 1 - travel.index);
}

/**
 * Ankunft bucht die ortsgebundene Wirkung: Geld, Faehigkeit, Beduerfnisse und
 * — bei Kneipe oder Besuch — den Kontakt mit einer nahen Person am selben Ort.
 * Der Kontakt kommt aus `selectSocialEncounter`; ohne nahen Partner am Ort wird
 * nichts gebucht und keine Erinnerung geschrieben.
 */
function settleArrival(
  resident: CityResidentState, peers: readonly CityResidentState[],
  tick: number, nextMemoryId: number,
): { readonly resident: CityResidentState; readonly nextMemoryId: number } {
  const effects = applyIntentEffects(resident.needs, resident.intent, 1, resident.skills);
  const selection = resident.intent === 'PUB' || resident.intent === 'VISIT_FRIEND'
    ? selectSocialEncounter(
      { npcId: resident.npcId, place: resident.location, position: resident.position },
      peers.map((peer) => ({ npcId: peer.npcId, place: peer.location, position: peer.position })),
    )
    : null;
  const target = selection ? peers.find((peer) => peer.npcId === selection.partnerId) : undefined;
  const delta = resident.intent === 'VISIT_FRIEND' ? 6 : 4;
  const relationships = target
    ? { ...resident.relationships, [target.npcId]: clampInt((resident.relationships[target.npcId] ?? 0) + delta, -100, 100) }
    : resident.relationships;
  const memories = target
    ? addMemory(resident.memories, socialMemory(target.npcId, tick, nextMemoryId, relationships))
    : resident.memories;
  return {
    resident: {
      ...resident, travel: null,
      needs: {
        hunger: clampNeed(effects.hunger), thirst: clampNeed(effects.thirst),
        fatigue: clampNeed(effects.fatigue), social: clampNeed(effects.social),
        mood: clampNeed(effects.mood), money: Math.max(0, Math.round(effects.money)),
      },
      skills: { cooking: effects.cooking, work: effects.work, social: effects.socialSkill },
      relationships, memories,
    },
    nextMemoryId: target ? nextMemoryId + 1 : nextMemoryId,
  };
}

/**
 * Ein Tick für alle Bewohner. Der Ort wechselt erst bei Ankunft; bis dahin
 * bleibt der alte Ort stehen und die Sicht meldet „unterwegs nach X".
 */
export function tickCityMovement(world: WorldState): void {
  const life = ensureCityLife(world);
  const unique = new Set(life.residents.map((resident) => `${resident.position.x},${resident.position.y}`));
  if (unique.size === life.residents.length && !life.residents.some((resident) => resident.travel !== null)) return;
  let memorySeq = life.memorySeq ?? 1;
  const nextTiles = new Map(life.residents.filter((resident) => resident.travel)
    .map((resident) => [resident.npcId, advanceTravel(resident.travel!).position] as const));
  const ordered = separatePositions(life.residents, cityMap(world), nextTiles);
  const residentsById = new Map(ordered.map((resident) => [resident.npcId, resident]));
  const occupancy = createOccupancy([...residentsById.values()], nextTiles);
  for (const id of ordered.map((resident) => resident.npcId)) {
    const resident = residentsById.get(id)!;
    if (!resident.travel) continue;
    const step = advanceTravel(resident.travel);
    // Bleibt der Schritt auf der eigenen Kachel (degenerierter Ein-Kachel-Weg),
    // wird keine neue Kachel beansprucht.
    const stays = step.position.x === resident.position.x && step.position.y === resident.position.y;
    const blocked = stays ? null : resolveStep(occupancy, id, resident.position, step.position, step.arrived);
    if (blocked && !blocked.canMove) continue;
    if (blocked?.push) applyPush(occupancy, blocked.push, residentsById);
    if (!stays) moveOccupant(occupancy, resident.position, step.position, id);
    if (!step.arrived) {
      residentsById.set(id, { ...resident, position: step.position, travel: step.travel });
      continue;
    }
    const fatigue = driftNeed(resident.needs.fatigue, travelFatigue(resident.travel.path.length));
    const arrived = settleArrival({ ...resident, position: step.position, travel: null, location: resident.travel.to },
      life.residents, world.tick, memorySeq);
    memorySeq = arrived.nextMemoryId;
    projectNewMemories(world, resident, arrived.resident);
    residentsById.set(id, { ...arrived.resident, needs: { ...arrived.resident.needs, fatigue } });
  }
  world.cityLife = { ...life, residents: ordered.map((resident) => residentsById.get(resident.npcId)!), memorySeq };
}

/**
 * Neue Stadterinnerungen eines Bewohners ins kanonische Gast-Gedaechtnis
 * projizieren (selbe NPC-Identitaet via visitorId). Wird sowohl nach der
 * entschiedenen Wirkung als auch nach der Ankunft gerufen; ein Erinnerungs-
 * Eintrag landet also maximal einmal im Gast-Profil.
 */
export function projectNewMemories(
  world: WorldState,
  before: CityResidentState,
  after: CityResidentState,
): void {
  const beforeIds = new Set(before.memories.map((memory) => memory.id));
  const visitorId = after.visitorId ?? before.visitorId;
  if (!visitorId) return;
  const visitor = world.visitors.find((entry) => entry.id === visitorId);
  if (!visitor) return;
  let memories = visitor.memories ?? [];
  let changed = false;
  for (const memory of after.memories) {
    if (beforeIds.has(memory.id)) continue;
    if (memories.some((entry) => entry.factId === memory.id)) continue;
    memories = [
      ...memories,
      {
        factId: memory.id,
        tick: memory.tick,
        score: memory.sentiment >= 1 ? 70 : memory.sentiment <= -1 ? 30 : 50,
        valence: memory.sentiment >= 1 ? 'GOOD' : memory.sentiment <= -1 ? 'BAD' : 'NEUTRAL',
      },
    ];
    changed = true;
  }
  if (!changed) return;
  if (memories.length > NARRATIVE_LIMITS.memories) {
    memories = memories.slice(-NARRATIVE_LIMITS.memories);
  }
  visitor.memories = memories;
}
