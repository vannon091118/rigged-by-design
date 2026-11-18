/**
 * Auswahl der NPC-Rig-Teile aus dem vorhandenen Charakter-Atlas.
 *
 * Die vier Bauteile liegen als PNG-Frames im Manifest und im Atlas; dieses
 * Modul waehlt je Figur eine Variante. Es laedt nichts und kennt kein Pixi,
 * damit die Auswahl ohne Engine testbar bleibt.
 */

/** Vorhandene Varianten je Bauteil; die Zahl ist der Deckel der Auswahl. */
export const RIG_PART_VARIANTS = Object.freeze({
  torso: 8,
  arm: 14,
  leg: 15,
  footwear: 14,
});

export interface RigPartSet {
  readonly torso: string;
  readonly arm: string;
  readonly leg: string;
  readonly footwear: string;
}

/**
 * 32-Bit-Mixer: benachbarte Namen (Hash +/- 1) sollen nicht dieselben
 * Gliedmassen tragen. Ohne Mischung wuerde ein zweiter Gast mit fast gleichem
 * Namen nur den Torso wechseln.
 */
function mix(value: number, salt: number): number {
  let x = (value ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function frame(stem: string, index: number, total: number): string {
  const variant = (index % total) + 1;
  return `characters/${stem}-${String(variant).padStart(2, '0')}.png`;
}

/** Seed-stabil: derselbe Name ergibt dieselbe Figur, auch nach einem Reload. */
export function rigPartsFor(seed: number): RigPartSet {
  const value = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return {
    torso: frame('torso-outfit', mix(value, 0x1f), RIG_PART_VARIANTS.torso),
    arm: frame('arm-segment', mix(value, 0x2f), RIG_PART_VARIANTS.arm),
    leg: frame('leg-segment', mix(value, 0x3f), RIG_PART_VARIANTS.leg),
    footwear: frame('footwear-part', mix(value, 0x4f), RIG_PART_VARIANTS.footwear),
  };
}
