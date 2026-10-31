/**
 * Eine Bildsprache fuer Floor und UI: jede Farbe hat eine Bedeutung, jedes Material
 * eine Aufgabe. Pixi liest Zahlen, das CSS spiegelt dieselben Rollen als Hex.
 */

/** Kontur und Tiefe: dunkles Ink statt Regenbogen-Raender. */
export const INK = 0x0a0612;

/** Rollen, nicht Farbnamen: wer eine Rolle aendert, aendert das ganze Spiel. */
export const ROLE = {
  /** Casino-Identitaet: Spielsaal, Violett, Panels. */
  identity: 0xb06bff,
  /** Service und Interaktion: Personal, Kasse, Hinweise. */
  service: 0x00ffcc,
  /** Gaeste und Aufmerksamkeit. */
  guest: 0xff2e88,
  /** Wert: Geraete, Geld, Preise. */
  value: 0xffd166,
  /** Gefahr: Streit, Defekt, Verlust. */
  danger: 0xff4d5e,
  /** Erfolg: sauber, gedeckt, freigeschaltet. */
  success: 0x2dd4a0,
  /** Warnung: knapp, abgenutzt, bald leer. */
  warning: 0xff9a3d,
} as const;

/** Lichtfarben: warm fuer Bar und Kasse, kalt fuer Eingang und Lager. */
export const LIGHT = {
  warm: 0xffd9a0,
  cool: 0x9fe6ff,
  neon: 0x7dffd9,
} as const;

export const SHADOW = { soft: 0.16, base: 0.3, deep: 0.46 } as const;

type FloorPattern = 'polished' | 'marble' | 'carpet' | 'planks' | 'tiles' | 'rug' | 'concrete';

export interface FloorMaterial {
  readonly base: number;
  readonly grout: number;
  readonly accent: number;
  readonly pattern: FloorPattern;
  readonly light: number;
  readonly lightAlpha: number;
}

const MATERIALS: Readonly<Record<string, FloorMaterial>> = {
  ENTRANCE: { base: 0x1c1830, grout: 0x342d4c, accent: ROLE.service, pattern: 'polished', light: LIGHT.cool, lightAlpha: 0.1 },
  EXCHANGE: { base: 0x261f36, grout: 0x453b5a, accent: ROLE.value, pattern: 'marble', light: LIGHT.warm, lightAlpha: 0.1 },
  GAMING: { base: 0x1a1432, grout: 0x2f2450, accent: ROLE.identity, pattern: 'carpet', light: LIGHT.neon, lightAlpha: 0.06 },
  BAR: { base: 0x241621, grout: 0x3b2830, accent: ROLE.warning, pattern: 'planks', light: LIGHT.warm, lightAlpha: 0.14 },
  TOILET: { base: 0x16202e, grout: 0x2a3c54, accent: LIGHT.cool, pattern: 'tiles', light: LIGHT.cool, lightAlpha: 0.08 },
  LOUNGE: { base: 0x1a2224, grout: 0x2c3636, accent: ROLE.success, pattern: 'rug', light: LIGHT.neon, lightAlpha: 0.05 },
  STORAGE: { base: 0x18161f, grout: 0x2b2838, accent: 0x6a5a8a, pattern: 'concrete', light: LIGHT.cool, lightAlpha: 0.04 },
  EXPANSION: { base: 0x121019, grout: 0x221f30, accent: 0x4a3a66, pattern: 'concrete', light: LIGHT.cool, lightAlpha: 0.03 },
};

/** Unbekannte Zonen bekommen das Lager-Material: nie eine leere Flaeche. */
export const materialFor = (kind: string): FloorMaterial => MATERIALS[kind] ?? MATERIALS.STORAGE!;

interface FurnitureTone {
  /** Koerperfarbe im Detail-LOD. */
  readonly body: number;
  /** Flaeche im Uebersichts-LOD: sofort lesbar, gleiche Farbfamilie. */
  readonly block: number;
  /** Kontur, die das Material zusammenhaelt. */
  readonly edge: number;
  readonly shadow: number;
}

const FURNITURE_TONES: Readonly<Record<string, FurnitureTone>> = {
  SLOT: { body: 0x2b163d, block: 0x7a3fa8, edge: ROLE.value, shadow: 0.34 },
  TABLE: { body: 0x22301c, block: 0x7a9a4a, edge: 0x8a9a64, shadow: 0.3 },
  BAR: { body: 0x3a1926, block: 0xb0436a, edge: ROLE.warning, shadow: 0.36 },
  TOILET: { body: 0x1b2c3e, block: 0x4a7a9a, edge: LIGHT.cool, shadow: 0.28 },
  EXCHANGE: { body: 0x34260f, block: 0xc09a4a, edge: ROLE.value, shadow: 0.36 },
  DECOR: { body: 0x1b2c22, block: 0x3aa87a, edge: ROLE.success, shadow: 0.26 },
  STORAGE: { body: 0x201c29, block: 0x6a5a8a, edge: 0x8a7aa8, shadow: 0.3 },
};

export const furnitureTone = (kind: string): FurnitureTone =>
  FURNITURE_TONES[kind] ?? { body: 0x241d33, block: 0x6a5a8a, edge: 0x8a7aa8, shadow: 0.3 };

/** Kisten tragen die Farbe ihres Inhalts, nicht eine eigene Palette. */
export const crateColor = (kind: string): number =>
  kind === 'FURNITURE' ? 0xb08448 : kind === 'DRINKS' ? ROLE.success : 0x8a7aa8;

/** Einheitliche Konturbreiten: 1 px fuer Kleinteile, 2 px fuer Raumkanten. */
export const STROKE = { hair: 1, base: 2, heavy: 3 } as const;

/** Typografie im Pixi-Floor: dieselbe Hierarchie wie die Panels, nur kleiner. */
export const floorText = {
  zone: () => ({ fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0xd9cdf0, letterSpacing: 2 }),
  name: () => ({ fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: 0xcdbfd9, stroke: { color: INK, width: 2 } }),
  screen: () => ({ fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: ROLE.value, letterSpacing: 1 }),
  crate: () => ({ fontFamily: 'ui-monospace, monospace', fontSize: 6, fill: 0xffd9a0 }),
};
