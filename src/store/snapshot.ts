/** Snapshot aus Welt und Ledger; keine eigene Geldwahrheit in der UI. */
import type { Ledger } from '../core/economy/ledger';
import { addVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { fiatAccount, guestAccount, pendingAccount, HAUSKONTO, PLAYER_CASH, PORTEMONNAIE, WECHSELKASSE } from '../core/sim/money';
import { duelPreview, type DuelPreview } from '../core/sim/duel';
import { demandBreakdown } from '../core/sim/demand';
import { guardHandling } from '../core/sim/disputes';
import { talkChance } from '../core/sim/charisma-talk';
import { reputation } from '../core/sim/spawn';
import { playerCareer } from '../core/sim/player-career';
import { companyStatus } from '../core/sim/progression';
import { renovationView } from '../core/sim/renovation';
import { machineHallView } from '../core/sim/machine-hall';
import { floorWorkView } from '../core/sim/floor-work';
import { cityView } from '../core/sim/city';
import { venueView } from '../core/sim/venue-event';
import { dayPhaseOf } from '../core/sim/day-phase';
import { hasStaff } from '../core/sim/staff-queries';
import type { WorldState } from '../core/sim/types';
import { seatCount } from '../core/sim/world';
import { buildNarrativeView } from '../core/sim/narrative/view';
import { archiveSnapshot } from './archive-snapshot';
import type { GameView, StaffView } from './types';
import { queueView } from '../core/sim/action-queue';
import { playerApartmentFurniture, playerApartmentModel } from '../core/sim/player-apartment';
import type { CityExteriorModel } from '../core/sim/city-exterior';
import { cityExteriorView } from './city-exterior-view';

/** Personal-Sicht der UI: der Guard besteht, sobald sein Agent existiert. */
function staffView(world: WorldState): StaffView {
  return { ...world.staff, guard: hasStaff(world, 'guard') };
}

function worldSnapshot(world: WorldState) {
  // Eine Projektion: die aktive Szene liefert Raum, Figuren und Spieler.
  const apartment = world.scene.kind === 'APARTMENT' ? playerApartmentModel() : null;
  const city = world.scene.kind === 'CITY' ? world.cityScene ?? null : null;
  const foreign = city === null && apartment === null && world.activeForeignFloorId !== null
    ? world.foreignFloors.find((floor) => floor.id === world.activeForeignFloorId) ?? null
    : null;
  // Der Renderer bekommt das kanonische Exterieur, nicht die 30x30-Projektion:
  // dasselbe Layout wie der Floor, aber mit Gebaeuden und Requisiten.
  const cityExterior: CityExteriorModel | null = city ? cityExteriorView(city) : null;
  const furniture = apartment
    ? playerApartmentFurniture()
    : city?.furniture ?? foreign?.furniture ?? world.furniture;
  const guests = apartment || city ? [] : foreign?.guests ?? world.guests;
  return {
    template: foreign?.template ?? world.template,
    // Kanonischer Plan als Referenz: er ist unveraenderlich und wird nur als Ganzes ersetzt.
    layout: apartment?.layout ?? city?.layout ?? foreign?.layout ?? world.layout,
    size: apartment?.layout.size ?? city?.layout.size ?? foreign?.size ?? world.size,
    zones: apartment?.layout.zones ?? city?.zones ?? foreign?.zones ?? world.zones,
    cityExterior,
    furniture: furniture.map((item) => ({ ...item, occupants: [...item.occupants], mods: [...item.mods] })),
    guests: guests.map((guest) => ({ ...guest, path: [...guest.path] })),
    seats: apartment || city ? 0 : foreign
      ? foreign.furniture.reduce((sum, item) => sum + (item.gameId ? item.seats : 0), 0)
      : seatCount(world),
    demand: demandBreakdown(world),
    player: foreign
      ? {
        ...world.player,
        position: { ...(foreign.playerPosition ?? world.player.position) },
        path: [...foreign.playerPath],
        pathIndex: foreign.playerPathIndex,
        carrying: foreign.playerCarrying,
      }
      : { ...world.player, position: { ...world.player.position }, path: [...world.player.path] },
    dirtyTiles: apartment || city || foreign ? new Set<number>() : new Set(world.dirty),
    tick: world.tick,
    day: world.day,
    dayPhase: dayPhaseOf(world.tick),
    // Die UI sieht, ob ein Guard existiert – das leitet sich jetzt aus seinem
    // Agenten ab, nicht aus einem eigenen Flag.
    staff: staffView(world),
    prices: { ...world.prices },
    carpet: world.carpet,
    lastEvent: world.lastEvent,
    crates: apartment || city || foreign ? [] : world.crates.map((crate) => ({ ...crate })),
    agents: apartment || city || foreign ? [] : world.agents.map((agent) => ({ ...agent, path: [...agent.path] })),
    disputes: apartment || city || foreign ? [] : world.disputes.map((dispute) => ({ ...dispute, guestIds: [...dispute.guestIds] })),
    stains: apartment || city || foreign ? [] : world.stains.map((stain) => ({ ...stain })),
    mops: apartment || city || foreign ? [] : world.mops.map((mop) => ({ ...mop })),
    scene: apartment
      ? { key: 'APARTMENT', kind: 'APARTMENT' as const, label: 'Wohnung' }
      : city
        ? { key: 'CITY', kind: 'CITY' as const, label: 'Stadt' }
        : foreign
          ? { key: `FOREIGN:${foreign.id}`, kind: 'FOREIGN' as const, label: `Fremdes Casino: ${foreign.rivalId}` }
          : { key: 'OWN', kind: 'OWN' as const, label: 'Dein Casino' },
    queue: queueView(world),
    onboarding: world.onboarding ?? { step: 'DONE' as const },
    parts: world.parts,
    guestsServed: world.guestsServed,
    wallColor: world.wallColor,
    neonColor: world.neonColor,
    barLevel: world.barLevel,
    wcLevel: world.wcLevel,
    activePenalties: world.activePenalties.map((penalty) => ({ ...penalty })),
    journal: world.journal.map((event) => ({ ...event, refs: event.refs ? { ...event.refs } : undefined })),
    archive: archiveSnapshot(world.archive),
    fightFx: world.fightFx ? { ...world.fightFx } : null,
    look: world.look,
    plinko: world.plinko,
    plinkoMode: world.plinkoMode,
    totalPlinkoDrops: world.totalPlinkoDrops,
    addictionScore: world.addictionScore,
    lastPlinko: world.lastPlinko,
    exclusionPact: world.exclusionPact ? { ...world.exclusionPact } : null,
    playerAddictionScore: world.playerAddictionScore,
    brokenExclusionPacts: world.brokenExclusionPacts,
    clarityBadge: world.clarityBadge,
    currentForeignFloorId: world.activeForeignFloorId,
    foreignFloors: world.foreignFloors.map((floor) => ({
      id: floor.id,
      rivalId: floor.rivalId,
      size: floor.size,
      jobStations: floor.jobStations,
      playerPosition: floor.playerPosition,
      day: floor.day,
    })),
    playerJob: world.player.job,
    barPurchased: world.player.barPurchased,
  };
}

export function buildView(world: WorldState, ledger: Ledger, notice: string): GameView {
  let pending: VaCoinMicro = ZERO_VC;
  let mood = 0;
  const duels: Record<number, DuelPreview> = {};
  for (const dispute of world.disputes) {
    const preview = duelPreview(world, dispute);
    if (preview) duels[dispute.id] = preview;
  }
  const guestMoney: Record<number, { wallet: VaCoinMicro; pending: VaCoinMicro; fiat: VaCoinMicro }> = {};
  for (const guest of world.guests) {
    const wallet = ledger.getBalance(guestAccount(guest.id));
    const open = ledger.getBalance(pendingAccount(guest.id));
    guestMoney[guest.id] = { wallet, pending: open, fiat: ledger.getBalance(fiatAccount(guest.id)) };
    pending = addVC(pending, open);
    mood += guest.mood;
  }
  return {
    ...worldSnapshot(world),
    // Die Stadt ist abgeleitet: kein zweiter Zustand, keine Rechnung in React.
    city: cityView(world),
    // NAR-14: Szenen und Profile werden hier abgeleitet, nie in React nachgerechnet.
    narrative: buildNarrativeView(world, ledger),
    talkChances: Object.fromEntries(world.guests.map((guest) => [guest.id, talkChance(world, guest.id)])),
    // Restticks bis die Ansprache wieder frei ist; die UI zaehlt daraus die Sekunden.
    talkReady: Object.fromEntries(world.guests.map((guest) => [guest.id, Math.max(0, (guest.talkReadyTick ?? 0) - world.tick)])),
    // Nur ein Security vor Ort beendet den Streit; die UI folgt derselben Aussage.
    disputeGuard: Object.fromEntries(world.disputes.map((dispute) => [dispute.id, guardHandling(world, dispute)])),
    duels,
    house: ledger.getBalance(HAUSKONTO),
    // Agent 09: der Zustand der Immobilie kommt aus Belegen plus Material und Konto.
    renovation: renovationView(world, ledger),
    // Agent 10: die Halle ist die Summe der Automaten auf der eigenen Flaeche.
    machineHall: machineHallView(world, ledger),
    // Agent 11: Arbeitsqualitaet der Floor-Rollen aus den vorhandenen Skillstufen.
    floorWork: floorWorkView(world),
    wallet: ledger.getBalance(PORTEMONNAIE),
    playerCash: ledger.getBalance(PLAYER_CASH),
    // Agent 06: dieselbe Karriere-Sicht fuer Charakterfenster und Tests, kein zweiter Zaehler.
    career: playerCareer(world, ledger.getBalance(PORTEMONNAIE), ledger.getBalance(PLAYER_CASH)),
    // Agent 22: Phasen und Historie der einen Veranstaltungsinstanz, kein zweiter Kalender.
    venue: venueView(world),
    desk: ledger.getBalance(WECHSELKASSE),
    pending,
    guestMoney,
    mood: world.guests.length ? Math.round(mood / world.guests.length) : 0,
    reputation: Math.round(reputation(world)),
    // Dieselbe Stufe wie Nachfrage und Kaufsperre: eine Wahrheit, eine Anzeige.
    company: companyStatus(world, ledger),
    ledgerOk: ledger.verifyIncremental(),
    ledgerEntries: ledger.entryCount,
    ledgerLastSeq: ledger.entryCount - 1,
    ledgerCirculating: ledger.circulating,
    notice,
  };
}
