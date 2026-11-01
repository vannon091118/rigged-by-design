/** Save v9: Welt + Ledger-Log + Journal + PRNG + Narrative-Domaene. Nichts anderes besitzt Geld. */
import { Ledger } from '../core/economy/ledger';
import { admitFiat, DEBT_ACCOUNT } from '../core/sim/money';
import { companyTier } from '../core/sim/progression';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { WorldState } from '../core/sim/types';
import { hydrateWorld, type SavedGame } from './migrate';

const SAVE_VERSION = 9;
const KEY = 'vcoin.casino.v9';
/** v8 kennt die Narrative-Domaene noch nicht; v6 weder Kisten noch Agenten; v5 trug das Fiat im Gastobjekt. */
const LEGACY_KEYS = ['vcoin.casino.v8', 'vcoin.casino.v7', 'vcoin.casino.v6', 'vcoin.casino.v5'] as const;
const OLD_KEYS = ['vcoin.casino.v3', 'vcoin.casino.v4'];

interface LoadedSave {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prngState: number;
}

export function toSavedGame(world: WorldState, ledger: Ledger, prngState: number): SavedGame {
  return {
      version: SAVE_VERSION,
      template: world.template,
      carpet: world.carpet,
      furniture: world.furniture,
      guests: world.guests,
      player: world.player,
      dirty: [...world.dirty],
      prices: world.prices,
      staff: world.staff,
      tick: world.tick,
      day: world.day,
      nextGuestId: world.nextGuestId,
      nextArrivalTick: world.nextArrivalTick,
      satisfaction: world.satisfaction,
      demandTier: world.demandTier,
      demandEvent: world.demandEvent,
      nextFurnitureId: world.nextFurnitureId,
      guardsHired: world.guardsHired,
      crates: world.crates,
      agents: world.agents,
      disputes: world.disputes,
      parts: world.parts,
      guestsServed: world.guestsServed,
      reputation: world.reputation,
      wallColor: world.wallColor,
      neonColor: world.neonColor,
      barLevel: world.barLevel,
      wcLevel: world.wcLevel,
      nextCrateId: world.nextCrateId,
      nextAgentId: world.nextAgentId,
      nextDisputeId: world.nextDisputeId,
      activePenalties: world.activePenalties,
      visitors: world.visitors,
      nextVisitorId: world.nextVisitorId,
      lastEvent: world.lastEvent,
      journal: world.journal,
      archive: world.archive,
      fightFx: world.fightFx,
      nextJournalId: world.nextJournalId,
      journaledSeq: world.journaledSeq,
      look: world.look,
      plinko: world.plinko,
      plinkoMode: world.plinkoMode,
      totalPlinkoDrops: world.totalPlinkoDrops,
      addictionScore: world.addictionScore,
      lastPlinko: world.lastPlinko,
      exclusionPact: world.exclusionPact,
      playerAddictionScore: world.playerAddictionScore,
      brokenExclusionPacts: world.brokenExclusionPacts,
      clarityBadge: world.clarityBadge,
      foreignFloors: world.foreignFloors,
      nextForeignFloorId: world.nextForeignFloorId,
      activeForeignFloorId: world.activeForeignFloorId,
      narrative: world.narrative,
      entries: ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason })),
      prngState,
  };
}

export const SAVE_FAILED_NOTICE = 'Speichern fehlgeschlagen: Browser-Speicher voll oder gesperrt. Fortschritt geht beim Neuladen verloren.';

/** Gibt false zurueck, wenn der Browser den Stand nicht speichern konnte (z. B. Speicher voll). */
export function saveWorld(world: WorldState, ledger: Ledger, prngState: number): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(toSavedGame(world, ledger, prngState)));
    return true;
  } catch {
    return false;
  }
}

/** Baut Welt und Ledger aus einem gespeicherten Stand; v5/v6 werden dabei gehoben. */
export function replaySave(raw: unknown): LoadedSave | null {
  try {
    const saved = raw as Partial<SavedGame> | null;
    if (!saved || ![5, 6, 7, 8, 9].includes(saved.version ?? 0)) return null;
    if (!saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) return null;
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    const legacyFiat = hydrateWorld(world, saved as SavedGame);
    ensureStarter(world);
    const ledger = new Ledger();
    // Schuldbuchungen duerfen beim Replay nicht als Unterdeckung gelten.
    ledger.openLiability(DEBT_ACCOUNT);
    for (const entry of saved.entries ?? []) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
    }
    for (const claim of legacyFiat) admitFiat(ledger, claim.id, claim.amount, world.tick);
    // Alte v8-Staende kennen die Nachfragestufe noch nicht: einmal aus dem Ledger nachziehen.
    if (!saved.demandTier) world.demandTier = companyTier(world, ledger);
    if (!ledger.verifyLedgerIntegrity()) return null;
    return { world, ledger, prngState: saved.prngState ?? 1 };
  } catch {
    return null;
  }
}

export function loadWorld(): LoadedSave | null {
  try {
    let raw = localStorage.getItem(KEY);
    for (const key of LEGACY_KEYS) raw = raw ?? localStorage.getItem(key);
    if (!raw) return null;
    return replaySave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearOldSave(): boolean {
  try {
    let had = false;
    for (const key of OLD_KEYS) {
      had = had || localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
    }
    return had;
  } catch { return false; }
}
