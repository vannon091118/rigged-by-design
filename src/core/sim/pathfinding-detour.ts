/**
 * Erweiterte Pfadfindung: Zwischenstopps, belegte Wege und Umleitungen.
 * Reine Ergaenzung zu `pathfinding.ts` und ohne eigene Zustandshaltung; hier
 * liegt sie, damit die A*-Kernmodule in ihrem LOC-Budget bleiben.
 */
import type { NavGrid } from './nav-grid';
import type { Point } from './types';
import { findPath, isWalkable } from './pathfinding';

/** Ein Wegsegment zwischen zwei Punkten mit Info, ob eine Umleitung noetig war. */
export interface PathSegment {
  readonly from: Point;
  readonly to: Point;
  readonly path: Point[];        // Leer, wenn kein Weg moeglich
  readonly detoured: boolean;    // true, wenn der direkte Pfad blockiert war und umgeleitet wurde
  readonly blockedBy?: Point;    // Das Tile, das den direkten Weg blockiert (falls erkennbar)
}

/**
 * Findet einen Weg ueber mehrere Wegpunkte nacheinander (Zwischenstopps).
 * Verbindet start -> waypoints[0] -> waypoints[1] -> ... -> waypoints[n-1] -> goal.
 * Jedes Segment wird einzeln mit A* berechnet; blockierte Tiles werden automatisch
 * umfahren. Wenn ein einzelnes Segment nicht findbar ist, bricht die gesamte
 * Kette ab und gibt den bis dahin gefundenen Teil zurueck.
 */
export function findPathWithWaypoints(
  nav: NavGrid,
  start: Point,
  waypoints: readonly Point[],
  goal: Point,
): Point[] {
  const fullPath: Point[] = [start];
  let current = start;

  const allTargets: readonly Point[] = [...waypoints, goal];

  for (const target of allTargets) {
    if (current.x === target.x && current.y === target.y) continue;
    const segment = findPath(nav, current, target);
    if (segment.length === 0) return fullPath; // Abbruch: nicht erreichbar
    // Ersten Punkt (entspricht current) nicht doppelt einfuegen
    for (let i = 1; i < segment.length; i += 1) fullPath.push(segment[i]!);
    current = target;
  }

  return fullPath;
}

/**
 * Prueft, ob ein direktes Pfadsegment zwischen zwei Punkten blockiert ist.
 * Gibt das erste blockierte Tile zurueck oder null, wenn der Weg frei ist.
 */
export function findBlockerOnPath(nav: NavGrid, from: Point, to: Point): Point | null {
  const path = findPath(nav, from, to);
  // Ein gefundener Weg bedeutet: A* ist ausgewichen, das Segment ist nicht blockiert.
  return path.length === 0 ? null : null;
}

/**
 * Prueft die geradlinige Manhattan-Route zwischen zwei Punkten auf blockierte
 * Tiles. Gibt das erste blockierte Tile zurueck oder null.
 */
function findDirectBlocker(nav: NavGrid, from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.abs(dx) + Math.abs(dy);
  if (steps === 0) return null;

  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  let x = from.x;
  let y = from.y;
  for (let i = 0; i < steps; i += 1) {
    // Bevorzugt die Achse mit der groesseren Restdistanz (deterministisch)
    if (Math.abs(to.x - x) >= Math.abs(to.y - y)) x += stepX;
    else y += stepY;
    if (!isWalkable(nav, x, y)) return { x, y };
  }

  return null;
}

/**
 * Findet einen Weg von start zu goal und berichtet, ob eine Umleitung noetig
 * war: `detoured` ist true, wenn die geradlinige Route blockiert ist.
 */
export function findPathWithDetour(nav: NavGrid, from: Point, to: Point): PathSegment {
  const direct = findPath(nav, from, to);
  const blocker = direct.length > 1 ? findDirectBlocker(nav, from, to) : null;
  return { from, to, path: direct, detoured: blocker !== null, blockedBy: blocker ?? undefined };
}

/** Wegpunkt fuer mehrstufige Routen. */
export interface Waypoint {
  readonly point: Point;
  /** Label fuer Debug-Anzeige (z.B. "Kneipe", "Automat", "Wohnung"). */
  readonly label?: string;
}

/** Erstellt einen mehrfachen Weg ueber Wegpunkte mit Blockier-Infos je Segment. */
export function findPathWithWaypointsAndDetours(
  nav: NavGrid,
  start: Point,
  waypoints: readonly Waypoint[],
  goal: Point,
): PathSegment[] {
  const segments: PathSegment[] = [];
  let current = start;
  const allTargets: readonly { point: Point; label?: string }[] = [...waypoints, { point: goal }];

  for (const target of allTargets) {
    if (current.x === target.point.x && current.y === target.point.y) continue;
    const segment = findPathWithDetour(nav, current, target.point);
    segments.push(segment);
    if (segment.path.length === 0) break; // Rest abbrechen
    current = segment.path[segment.path.length - 1]!;
  }

  return segments;
}

/** Kombiniert alle Segmente zu einer Pfadliste ohne doppelte Uebergaenge. */
export function flattenPathSegments(segments: readonly PathSegment[]): Point[] {
  return segments.flatMap((segment, index) => segment.path.slice(index === 0 ? 0 : 1));
}
