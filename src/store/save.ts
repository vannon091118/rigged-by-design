/** Save v11: Welt + Layout + Ledger-Log + Journal + PRNG + Narrative-Domaene + Rivalen-Zustand. */
import { Ledger } from '../core/economy/ledger';
import { ZERO_VC } from '../core/economy/vacoin';
import { admitFiat, BUILDER_ESCROW, DEBT_ACCOUNT, EXTERNAL_WORK } from '../core/sim/money';
import { companyTier } from '../core/sim/progression';
import { ensureCityLife, ensureCityPopulationForScene } from '../core/sim/city-life-state';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { WorldState } from '../core/sim/types';
import { hydrateWorld, type SavedGame } from './migrate';
import { SAVE_VERSIONS } from '../core/io/repair';

const SAVE_VERSION = 11;
const KEY = 'vcoin.casino.v11';
/** v10 kennt keinen Layout-Vertrag; v9 den Rivalen-Zustand nicht; v8 nicht die Narrative-Domaene; v5 trug das Fiat im Gastobjekt. */
const LEGACY_KEYS = ['vcoin.casino.v10', 'vcoin.casino.v9', 'vcoin.casino.v8', 'vcoin.casino.v7', 'vcoin.casino.v6', 'vcoin.casino.v5'] as const;
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
      layout: world.layout,
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
      nextFurnitureId: world.nextFurnitureId,
      guardsHired: world.guardsHired,
      crates: world.crates,
      agents: world.agents,
      disputes: world.disputes,
      stains: world.stains,
      mops: world.mops,
      parts: world.parts,
      guestsServed: world.guestsServed,
      reputation: world.reputation,
      city: world.city,
      cityLife: world.cityLife,
      cityGrowth: world.cityGrowth,
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
      fightBets: world.fightBets,
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
      scene: world.scene,
      actionQueue: world.actionQueue,
      cityScene: world.cityScene,
      sceneReturnPosition: world.sceneReturnPosition,
      onboarding: world.onboarding,
      narrative: world.narrative,
      rivals: world.rivals,
      entries: ledger.entries.map(({ tick, from, to, amount, reason, game }) => ({ tick, from, to, amount, reason, game })),
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
    if (!saved || !SAVE_VERSIONS.has(saved.version ?? 0)) return null;
    if (!saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) return null;
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    const legacyFiat = hydrateWorld(world, saved as SavedGame);
    // Die Szene steht nach der Hydration fest: Ein alter CITY-Save wird auf
    // die Strassenbesetzung gehoben, bevor Sicht oder Begegnung ihn lesen.
    ensureCityPopulationForScene(world);
    ensureStarter(world);
    const ledger = new Ledger();
    // Schuldbuchungen duerfen beim Replay nicht als Unterdeckung gelten.
    ledger.openLiability(DEBT_ACCOUNT);
    for (const entry of saved.entries ?? []) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick, entry.game ?? null);
    }
    for (const claim of legacyFiat) admitFiat(ledger, claim.id, claim.amount, world.tick);
    // v11 legte Bautraeger-Zahlungen und Pakt-Reserve auf ein Konto. Der alte
    // Saldo wandert als eigene Zeile in den Bautraeger-Escrow; die Pakt-Reserve
    // deckt sich beim naechsten Paktstart selbst (#532).
    if (ledger.hasAccount(EXTERNAL_WORK)) {
      const legacyWork = ledger.getBalance(EXTERNAL_WORK);
      if (legacyWork > ZERO_VC) {
        ledger.transfer(EXTERNAL_WORK, BUILDER_ESCROW, legacyWork, 'Migration: Bauträger-Escrow (v11)', 0);
      }
    }
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
    const loaded = replaySave(JSON.parse(raw));
    // Auch ausserhalb der Stadt bekommen alte Saves ihre Bewohnerprofile; die
    // Stadtszene selbst ist bereits in `replaySave` auf Mindestbesetzung.
    if (loaded) ensureCityLife(loaded.world);
    return loaded;
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
