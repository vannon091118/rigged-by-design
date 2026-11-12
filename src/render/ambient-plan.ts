/**
 * Ambient-Vertrag: Helligkeit, Sichtradius und Sonnenrichtung kommen allein aus
 * Tageszeit und Szene. Kein Zufall, keine Uhr, kein Schreibzugriff auf den
 * Spielzustand. Der Renderer liest nur diesen Plan; die Simulation kennt ihn
 * nicht und kann von ihm nicht abhaengen.
 */
import type { DayPhase } from '../core/sim/day-phase';

export type AmbientEnvironment = 'interior' | 'outdoor';

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

/** Ein Sichtradius entsteht nur draussen, wenn es dunkel wird. */
const VISION: Readonly<Record<DayPhase, { readonly tiles: number; readonly alpha: number }>> = {
  morning: { tiles: 0, alpha: 0 },
  evening: { tiles: 10, alpha: 0.1 },
  night: { tiles: 7.5, alpha: 0.22 },
};

/** Schatten fallen am Morgen nach Osten, am Abend nach Westen. */
const SUN: Readonly<Record<DayPhase, { readonly x: number; readonly y: number }>> = {
  morning: { x: 0.55, y: 0.3 },
  evening: { x: -0.55, y: 0.3 },
  night: { x: 0, y: 0 },
};

/** Ein Plan je (Umgebung, Phase); der Renderer erkennt Wechsel per Identitaet. */
const CACHE = new Map<string, AmbientPlan>();

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
