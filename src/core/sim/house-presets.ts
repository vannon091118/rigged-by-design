/** Haus-Vorlagen: Zonen und Moebel-Fabriken für klein, mittel, gross. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { SERVICE_FOOTPRINT } from './grid-zones';
import { getBuildDef } from './offers';
import type { Furniture, GameId, TemplateId, Zone } from './types';

const zone = (id: string, name: string, kind: Zone['kind'], x: number, y: number, w: number, h: number, color: number): Zone =>
  ({ id, name, kind, x, y, w, h, color });

const fixture = (id: number, gameId: GameId, x: number, y: number, zoneId: string): Furniture => {
  const def = getBuildDef(gameId);
  return { id, kind: def.kind, gameId, x, y, w: def.w, h: def.h, seats: def.seats, label: def.name,
    price: def.cost, quality: def.quality, condition: 100, damaged: false, dirt: 0, stock: 0,
    clog: 0, clogged: false, zoneId, occupants: [], mods: [], reels: def.reels, baseBet: def.baseBet };
};

const freeFixture = (id: number, gameId: GameId, x: number, y: number, zoneId: string): Furniture =>
  ({ ...fixture(id, gameId, x, y, zoneId), price: fromVC(0) });

const service = (id: number, kind: 'EXCHANGE' | 'BAR' | 'TOILET' | 'STORAGE', label: string, x: number, y: number, zoneId: string): Furniture => {
  const fp = SERVICE_FOOTPRINT[kind];
  return { id, kind, label, x, y, w: fp.w, h: fp.h, seats: fp.seats, price: fromVC(0), quality: 1,
    condition: 100, damaged: false, dirt: 0, clog: 0, clogged: false, stock: kind === 'BAR' ? 4 : 0,
    zoneId, occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro };
};

const decor = (id: number, label: string, x: number, y: number, w: number, h: number, seats: number, zoneId: string): Furniture =>
  ({ id, kind: 'DECOR', label, x, y, w, h, seats, price: fromVC(0), quality: 1, condition: 100, damaged: false,
    dirt: 0, stock: 0, clog: 0, clogged: false, zoneId, occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro });

const SMALL_ZONES: readonly Zone[] = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 12, 5, 6, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 7, 11, 5, 7, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 13, 3, 15, 13, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 13, 18, 9, 8, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 23, 18, 6, 8, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 6, 21, 6, 5, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 1, 25, 4, 3, 0x2a2a2a),
];

const MEDIUM_ZONES: readonly Zone[] = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 26, 8, 8, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 10, 24, 8, 9, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 20, 4, 28, 30, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 20, 38, 16, 12, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 38, 38, 10, 12, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 50, 4, 8, 14, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 50, 38, 8, 18, 0x2a2a2a),
];

const LARGE_ZONES: readonly Zone[] = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 40, 10, 10, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 13, 38, 10, 12, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 28, 8, 42, 42, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 28, 54, 22, 18, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 54, 54, 14, 18, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 74, 8, 10, 22, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 74, 58, 10, 24, 0x2a2a2a),
];

/**
 * Stufen-Korridor: eine Vorlage traegt nur Geraete, die unterhalb ihrer eigenen
 * Ausbauvoraussetzung schon freigeschaltet sind (MEDIUM: KASSE-Klasse,
 * LARGE: SAAL-Klasse). Sonst umgeht ein Umbau oder Start die Kauf-Sperren der
 * Unternehmensstufen — genau der Widerspruch aus dem Main-Audit #19.
 */
export const BLUEPRINTS: Readonly<Record<TemplateId, { size: number; zones: readonly Zone[]; furniture: () => Furniture[] }>> = {
  SMALL: {
    size: 30,
    zones: SMALL_ZONES,
    furniture: () => [
      service(1, 'EXCHANGE', 'Wechselkasse', 8, 13, 'exchange'),
      freeFixture(2, 'SLOT', 16, 6, 'gaming'),
      service(3, 'BAR', 'Theke', 14, 19, 'bar'),
      service(4, 'TOILET', 'Kabine', 24, 20, 'toilet'),
      decor(5, 'Pflanze', 10, 22, 1, 1, 0, 'lounge'),
      decor(6, 'Sofa', 7, 24, 2, 1, 2, 'lounge'),
      service(7, 'STORAGE', 'Lager', 1, 25, 'storage'),
    ],
  },
  MEDIUM: {
    size: 60,
    zones: MEDIUM_ZONES,
    furniture: () => [
      service(1, 'EXCHANGE', 'Wechselkasse', 11, 26, 'exchange'),
      fixture(2, 'SLOT', 23, 8, 'gaming'),
      fixture(3, 'SLOT', 29, 8, 'gaming'),
      fixture(4, 'SLOT', 35, 8, 'gaming'),
      fixture(5, 'PLINKO', 41, 8, 'gaming'),
      fixture(6, 'VIDEO_POKER', 23, 18, 'gaming'),
      fixture(7, 'PLINKO', 30, 18, 'gaming'),
      fixture(8, 'SLOT', 38, 18, 'gaming'),
      fixture(9, 'SHELL', 30, 27, 'gaming'),
      fixture(10, 'DICE', 38, 27, 'gaming'),
      service(11, 'BAR', 'Theke', 22, 40, 'bar'),
      service(12, 'TOILET', 'Kabine', 40, 40, 'toilet'),
      decor(13, 'Pflanze', 54, 8, 1, 1, 0, 'lounge'),
      decor(14, 'Sofa', 52, 10, 2, 1, 2, 'lounge'),
      service(15, 'STORAGE', 'Lager', 51, 40, 'storage'),
    ],
  },
  LARGE: {
    size: 90,
    zones: LARGE_ZONES,
    furniture: () => [
      service(1, 'EXCHANGE', 'Wechselkasse', 15, 41, 'exchange'),
      fixture(2, 'SLOT', 31, 12, 'gaming'),
      fixture(3, 'SLOT', 38, 12, 'gaming'),
      fixture(4, 'SLOT', 45, 12, 'gaming'),
      fixture(5, 'SLOT', 52, 12, 'gaming'),
      fixture(6, 'PLINKO', 59, 12, 'gaming'),
      fixture(7, 'BLACKJACK', 31, 22, 'gaming'),
      fixture(8, 'POKER', 39, 22, 'gaming'),
      fixture(9, 'VIDEO_POKER', 48, 22, 'gaming'),
      fixture(10, 'SHELL', 31, 32, 'gaming'),
      fixture(11, 'DICE', 38, 32, 'gaming'),
      fixture(12, 'SLOT', 48, 32, 'gaming'),
      service(13, 'BAR', 'Theke', 31, 58, 'bar'),
      service(14, 'TOILET', 'Kabine', 58, 58, 'toilet'),
      decor(15, 'Pflanze', 80, 12, 1, 1, 0, 'lounge'),
      decor(16, 'Sofa', 77, 28, 2, 1, 2, 'lounge'),
      service(17, 'STORAGE', 'Lager', 75, 60, 'storage'),
    ],
  },
};
