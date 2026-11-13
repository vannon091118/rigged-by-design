/**
 * Ambient-Vertrag: Helligkeit, Sichtradius und Sonnenrichtung kommen allein aus
 * Tageszeit und Szene. Kein Zufall, keine Uhr, kein Schreibzugriff auf den
 * Spielzustand. Der Renderer liest nur diesen Plan; die Simulation kennt ihn
 * nicht und kann von ihm nicht abhaengen.
 */
import { dayPhaseOf, PHASE_BOUNDARIES, type DayPhase } from '../core/sim/day-phase';
import { TICKS_PER_DAY } from '../core/sim/clock';

type AmbientEnvironment = 'interior' | 'outdoor';

/** Flaechenband in Weltpixeln; die Strahlen liegen nur darueber. */
export interface AmbientBand {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ZoneLike {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AmbientPlan {
  readonly environment: AmbientEnvironment;
  /** Abdunklung der Welt in 0..1; 0 heisst: kein Schleier. */
  readonly shade: number;
  /** Farbe der Abdunklung. */
  readonly shadeTint: number;
  /** Dosis der statischen Sonnenstrahlen in 0..1; 0 heisst: keine Strahlen. */
  readonly rays: number;
  /** Schattenrichtung in Weltpixeln je Schattenradius. */
  readonly sunX: number;
  readonly sunY: number;
  /** Deckkraft der weichen Objektschatten am Fuss. */
  readonly shadow: number;
  /** Sichtradius in Tiles; 0 heisst: kein Radius (Innenraum oder Tageslicht). */
  readonly visionTiles: number;
  readonly visionAlpha: number;
  readonly visionTint: number;
}

const SHADE_TINT = 0x0a0f22;
const VISION_TINT = 0xffd9a0;

/** Draussen traegt die Tageszeit die Helligkeit, drinnen nur einen leisen Rest. */
const SHADE: Readonly<Record<AmbientEnvironment, Readonly<Record<DayPhase, number>>>> = {
  outdoor: { morning: 0, evening: 0.2, night: 0.42 },
  interior: { morning: 0, evening: 0.05, night: 0.12 },
};

/** Sonnenstrahlen und Schatten nur draussen; nachts uebernimmt das Kunstlicht. */
const RAYS: Readonly<Record<DayPhase, number>> = { morning: 0.16, evening: 0.1, night: 0 };
const SHADOW: Readonly<Record<DayPhase, number>> = { morning: 0.2, evening: 0.14, night: 0.06 };

/** Ein Sichtradius entsteht nur draussen in der Nacht; Abend behaelt Strahlen und Schatten. */
const VISION: Readonly<Record<DayPhase, { readonly tiles: number; readonly alpha: number }>> = {
  morning: { tiles: 0, alpha: 0 },
  evening: { tiles: 0, alpha: 0 },
  night: { tiles: 7.5, alpha: 0.22 },
};

/**
 * Das Sonnenband: der Strassenraum als Bounding-Box der Aussen-Zonen, nicht die
 * ganze Welt. Die 60x60-Stadt hat nur am oberen Rand Strassenraum; Strahlen ueber
 * die vollen 60 Kacheln lesen sich als Bodenstreifen. Ohne Zonen bleibt die
 * Weltkante der Fallback (Tests und alte Saves).
 */
export function streetBand(
  zones: readonly ZoneLike[] | null | undefined,
  bounds: { readonly width: number; readonly height: number },
  tile: number,
): AmbientBand {
  const full: AmbientBand = { x: 0, y: 0, width: bounds.width * tile, height: bounds.height * tile };
  if (!zones || zones.length === 0 || full.width <= 0 || full.height <= 0) return full;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const zone of zones) {
    left = Math.min(left, zone.x * tile);
    top = Math.min(top, zone.y * tile);
    right = Math.max(right, (zone.x + zone.w) * tile);
    bottom = Math.max(bottom, (zone.y + zone.h) * tile);
  }
  // Auf die Weltkante begrenzen: eine Zone darf das Band nie groesser machen.
  const x = Math.max(0, Math.min(left, full.width));
  const y = Math.max(0, Math.min(top, full.height));
  return {
    x,
    y,
    width: Math.max(0, Math.min(right, full.width) - x),
    height: Math.max(0, Math.min(bottom, full.height) - y),
  };
}

/**
 * Lampenflackern als reine Rechnung. Bei reduzierter Bewegung bleibt die Lampe
 * steady: derselbe Zustand, keine Animation.
 */
export function lampPulse(now: number, depth: number, intensity: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.74;
  return 0.68 + Math.sin(now / 720 + depth) * 0.12 * intensity;
}

/** Schatten fallen am Morgen nach Osten, am Abend nach Westen. */
const SUN: Readonly<Record<DayPhase, { readonly x: number; readonly y: number }>> = {
  morning: { x: 0.55, y: 0.3 },
  evening: { x: -0.55, y: 0.3 },
  night: { x: 0, y: 0 },
};

/** Ein Plan je (Umgebung, Phase); der Renderer erkennt Wechsel per Identitaet. */
const CACHE = new Map<string, AmbientPlan>();

/**
 * Laenge des Uebergangs an einer Tagesdrittel-Grenze, in Ticks. Eine Stunde
 * reicht: Der Wechsel wird lesbar, ohne dass die Stadt minutenlang daemmert.
 * Die Haelfte liegt vor, die Haelfte nach der Grenze; beide Enden treffen die
 * Nachbarphase exakt, damit davor und danach der eingefrorene Plan gilt.
 */
export const AMBIENT_TRANSITION_TICKS = 24;

export function ambientPlanFor(phase: DayPhase, scene: string): AmbientPlan {
  const environment: AmbientEnvironment = scene === 'CITY' ? 'outdoor' : 'interior';
  const key = `${environment}:${phase}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const dusk = environment === 'outdoor';
  const sun = dusk ? SUN[phase] : { x: 0, y: 0 };
  const plan: AmbientPlan = Object.freeze({
    environment,
    shade: SHADE[environment][phase],
    shadeTint: SHADE_TINT,
    rays: dusk ? RAYS[phase] : 0,
    sunX: sun.x,
    sunY: sun.y,
    shadow: dusk ? SHADOW[phase] : 0,
    visionTiles: dusk ? VISION[phase].tiles : 0,
    visionAlpha: dusk ? VISION[phase].alpha : 0,
    visionTint: VISION_TINT,
  });
  CACHE.set(key, plan);
  return plan;
}

/** Kuerzester Abstand im Tagesring, vorzeichenbehaftet in [-TICKS_PER_DAY/2, TICKS_PER_DAY/2). */
function ringDistance(tick: number, boundary: number): number {
  const half = TICKS_PER_DAY / 2;
  let distance = tick - boundary;
  if (distance > half) distance -= TICKS_PER_DAY;
  if (distance < -half) distance += TICKS_PER_DAY;
  return distance;
}

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

function mixPlans(from: AmbientPlan, to: AmbientPlan, progress: number): AmbientPlan {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return {
    environment: to.environment,
    shade: lerp(from.shade, to.shade, progress),
    shadeTint: to.shadeTint,
    rays: lerp(from.rays, to.rays, progress),
    sunX: lerp(from.sunX, to.sunX, progress),
    sunY: lerp(from.sunY, to.sunY, progress),
    shadow: lerp(from.shadow, to.shadow, progress),
    visionTiles: lerp(from.visionTiles, to.visionTiles, progress),
    visionAlpha: lerp(from.visionAlpha, to.visionAlpha, progress),
    visionTint: to.visionTint,
  };
}

/**
 * Plan zum Tick, inklusive Uebergang. Ausserhalb des Fensters ist das Ergebnis
 * identisch zum eingefrorenen Phasenplan (kein Objekt je Frame); innerhalb
 * wird zwischen beiden Nachbarphasen gemischt. Rein aus Tick und Szene: keine
 * Uhr, kein Zufall, derselbe Tick ergibt denselben Wert.
 */
export function ambientPlanAt(tick: number, scene: string): AmbientPlan {
  const period = TICKS_PER_DAY;
  const local = ((Math.floor(tick) % period) + period) % period;
  const half = AMBIENT_TRANSITION_TICKS / 2;
  for (const boundary of PHASE_BOUNDARIES) {
    const distance = ringDistance(local, boundary);
    if (Math.abs(distance) > half) continue;
    const progress = (distance + half) / AMBIENT_TRANSITION_TICKS;
    return mixPlans(
      ambientPlanFor(dayPhaseOf(boundary - 1), scene),
      ambientPlanFor(dayPhaseOf(boundary), scene),
      progress,
    );
  }
    return ambientPlanFor(dayPhaseOf(local), scene);
}

/**
 * Plan fuer einen Snapshot. Fehlt der Tick (Fixture, kaputter Save), gilt die
 * gemeldete Phase: ein Uebergang ohne Zeitachse waere NaN statt Licht.
 */
export function ambientPlanForView(
  view: { readonly tick: number; readonly dayPhase: DayPhase; readonly scene: { readonly kind: string } },
): AmbientPlan {
  if (!Number.isFinite(view.tick)) return ambientPlanFor(view.dayPhase, view.scene.kind);
  return ambientPlanAt(view.tick, view.scene.kind);
}
