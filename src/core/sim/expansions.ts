/** Ausbau: das Haus waechst aus dem Bestand heraus. Nichts wird ersetzt, alles bleibt. */
import type { Ledger } from '../economy/ledger';
import { canAfford, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { areasFor, type Area } from './grid-zones';
import { BLUEPRINTS } from './house-presets';
import { HAUSKONTO, SHOP } from './money';
import { TEMPLATE_COST } from './templates';
import { TX_PREFIX } from './tx-reasons';
import type { TemplateId, WorldState, Zone } from './types';

const ORDER: Readonly<Record<TemplateId, number>> = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

export const nextTemplateId = (template: TemplateId): TemplateId | null =>
  template === 'SMALL' ? 'MEDIUM' : template === 'MEDIUM' ? 'LARGE' : null;

/** Nur ein groesseres Haus ist ein Ausbau; alles andere ist Umzug oder Rueckbau. */
export const isExpansion = (from: TemplateId, to: TemplateId): boolean => ORDER[to] > ORDER[from];

/** Ausbau kostet nur die Differenz: MEDIUM ist im LARGE-Preis bereits enthalten. */
export function expansionCost(from: TemplateId, to: TemplateId): VaCoinMicro {
  if (!isExpansion(from, to)) return ZERO_VC;
  return (TEMPLATE_COST[to] - TEMPLATE_COST[from]) as VaCoinMicro;
}

/** Himmelsrichtung des neuen 30x30-Blocks, aus der Brettmitte abgeleitet. */
function direction(area: Area, size: number): string {
  const centerX = area.x + area.w / 2;
  const centerY = area.y + area.h / 2;
  const col = centerX < size / 2 ? 'West' : centerX > size / 2 ? 'Ost' : 'Mitte';
  const row = centerY < size / 2 ? 'Nord' : centerY > size / 2 ? 'Sued' : 'Mitte';
  return `${row}-${col}`;
}

/** Der neue Block als Bauflaeche; der Brettrand bleibt Wand. */
function areaZone(area: Area, size: number): Zone {
  const x = area.x === 0 ? 1 : area.x;
  const y = area.y === 0 ? 1 : area.y;
  const endX = Math.min(area.x + area.w, size - 1);
  const endY = Math.min(area.y + area.h, size - 1);
  return {
    id: `exp-${area.index}`,
    name: `Erweiterung ${direction(area, size)}`,
    kind: 'EXPANSION',
    x, y, w: endX - x, h: endY - y,
    color: 0x2f2a3d,
  };
}

/** Nur die Bloecke, die der Zielvorlage neu sind; bestehende Zonen bleiben unberuehrt. */
export function expansionZones(from: TemplateId, to: TemplateId, size: number, existing: readonly Zone[]): Zone[] {
  const known = new Set(areasFor(from).map((area) => area.index));
  const taken = new Set(existing.map((zone) => zone.id));
  return areasFor(to)
    .filter((area) => !known.has(area.index))
    .map((area) => areaZone(area, size))
    .filter((zone) => zone.w > 2 && zone.h > 2 && !taken.has(zone.id));
}

/** Fleck-Indizes haengen an der Brettbreite; beim Wachsen muessen sie mitwandern. */
function remapDirtyTiles(dirty: ReadonlySet<number>, fromSize: number, toSize: number): Set<number> {
  if (fromSize === toSize || fromSize <= 0) return new Set(dirty);
  const next = new Set<number>();
  for (const index of dirty) {
    const x = index % fromSize;
    const y = Math.floor(index / fromSize);
    if (x < toSize && y < toSize) next.add(y * toSize + x);
  }
  return next;
}

/**
 * Erweitert das bestehende Haus auf die Zielvorlage. Moebel, Mods, IDs, Personal,
 * Kisten, Streitfaelle, Gaeste und ihre Ledger-Konten bleiben unangetastet.
 */
export function expandHouse(world: WorldState, ledger: Ledger, target: TemplateId, tick: number): WorldState {
  if (target === world.template) return world;
  if (!isExpansion(world.template, target)) {
    throw new Error('Ein kleineres Haus ist kein Ausbau. Umzug oder Rueckbau laeuft als eigener Vorgang.');
  }
  const blueprint = BLUEPRINTS[target];
  if (!blueprint) throw new Error(`Unbekannte Vorlage: ${target}`);
  const cost = expansionCost(world.template, target);
  const balance = ledger.getBalance(HAUSKONTO);
  if (!canAfford(balance, cost)) {
    throw new Error(`Ausbau auf ${target} kostet ${toVCString(cost)}, im Hauskonto liegen ${toVCString(balance)}.`);
  }
  const zones = expansionZones(world.template, target, blueprint.size, world.zones);
  const fromSize = world.size;
  if (zones.length === 0) throw new Error('Diese Vorlage bringt keine neue Flaeche.');
  // Erst buchen: scheitert die Buchung, bleibt die Welt vollstaendig unveraendert.
  if (cost > ZERO_VC) ledger.transfer(HAUSKONTO, SHOP, cost, `${TX_PREFIX.EXPANSION}${target}`, tick);
  world.template = target;
  world.size = blueprint.size;
  world.zones = [...world.zones, ...zones];
  world.dirty = remapDirtyTiles(world.dirty, fromSize, blueprint.size);
  world.lastEvent = `Ausbau auf ${blueprint.size}x${blueprint.size}: ${zones.length} neue Bauflaechen, Einrichtung und Personal bleiben.`;
  return world;
}
