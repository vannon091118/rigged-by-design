/** Drei Floor-Blueprints: klein, mittel, gross. Jeder Bereich ist 30x30 Kacheln. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { defaultPlinkoConfig } from '../games/plinko-config';
import { getBuildDef } from './offers';
import { newPlayerRpg } from './player-rpg';
import { DEFAULT_LOOK } from './player-look';
import { BLUEPRINTS } from './house-presets';
import type { CarpetId, PriceBook, TemplateId, WorldState } from './types';

const PRICES: PriceBook = {
  entryFee: fromVC(0),
  drinkPrice: fromVC(0.4),
  slotMinBet: fromVC(0.05),
  staffWage: fromVC(4),
  guardWage: fromVC(6),
  cashierWage: fromVC(5),
  porterWage: fromVC(3),
  cleaningCost: fromVC(0.8),
  repairCost: fromVC(2),
  partCost: fromVC(1.5),
  drinkCrateCost: fromVC(0.6),
  barUpgrade: fromVC(30),
  wcUpgrade: fromVC(15),
};

export const TEMPLATE_COST: Readonly<Record<TemplateId, VaCoinMicro>> = {
  SMALL: fromVC(30),
  MEDIUM: fromVC(120),
  LARGE: fromVC(600),
};

export function createWorld(template: TemplateId, carpet: CarpetId = 'VIOLET'): WorldState {
  const blueprint = BLUEPRINTS[template];
  if (!blueprint) throw new Error(`Unbekannte Vorlage: ${template}`);
  const entrance = blueprint.zones.find((zone) => zone.kind === 'ENTRANCE');
  return {
    template,
    size: blueprint.size,
    zones: blueprint.zones,
    furniture: blueprint.furniture(),
    guests: [],
    player: { position: { x: entrance ? entrance.x + 2 : 2, y: entrance ? entrance.y + 2 : 15 }, path: [], pathIndex: 0, carrying: '', rpg: newPlayerRpg() },
    dirty: new Set<number>(),
    prices: { ...PRICES },
    staff: { guard: false, cleaner: false, bartender: false, cashier: false, porter: false },
    carpet,
    tick: 0,
    day: 1,
    nextGuestId: 1,
    nextFurnitureId: 100,
    crates: [],
    agents: [],
    disputes: [],
    parts: 2,
    guestsServed: 0,
    reputation: 0,
    wallColor: '#241a35',
    neonColor: '#00ffcc',
    barLevel: 1,
    wcLevel: 1,
    nextCrateId: 1,
    nextAgentId: 1,
    nextDisputeId: 1,
    activePenalties: [],
    visitors: [],
    nextVisitorId: 1,
    journal: [],
    nextJournalId: 1,
    journaledSeq: 0,
    look: DEFAULT_LOOK,
    plinko: defaultPlinkoConfig(),
    plinkoMode: 'SINGLE',
    totalPlinkoDrops: 0,
    addictionScore: 0,
    lastPlinko: null,
    exclusionPact: null,
    playerAddictionScore: 0,
    brokenExclusionPacts: 0,
    clarityBadge: false,
    lastEvent: template === 'SMALL' ? 'Kleine Bude eröffnet. Ein Automat steht gratis.' : 'Neues Haus eröffnet.',
    guardsHired: 0,
  };
}

/** Nach dem Laden: ein Casino ohne Spielgeraet bekommt seinen Gratis-Startautomaten zurueck. */
export function ensureStarter(world: WorldState): void {
  if (world.furniture.some((item) => item.gameId)) return;
  const def = getBuildDef('SLOT');
  world.furniture.push({
    id: world.nextFurnitureId++, kind: 'SLOT', gameId: 'SLOT', x: 16, y: 6, w: def.w, h: def.h, seats: def.seats,
    label: def.name, price: fromVC(0), quality: def.quality, condition: 100, damaged: false, dirt: 0,
    stock: 0, clog: 0, clogged: false,
    zoneId: 'gaming', occupants: [], mods: [], reels: 3, baseBet: def.baseBet,
  });
}
