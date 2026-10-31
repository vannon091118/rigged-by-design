// @loc-exception: Der eine Store buendelt alle Commands auf denselben Weltzustand; Aufteilen wuerde die Eigentumsgarantie verwischen.
/** Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. */
import { Ledger, type LedgerDiagnosis } from '../core/economy/ledger';
import { fromVC, toVCString } from '../core/economy/vacoin';
import type { GameExtras, GameResult } from '../core/games/contracts';
import { createShellRound, type ShellRound } from '../core/games/shell-round';
import { deployGate, type GateResult } from '../core/games/plinko-sandbox';
import { normalizePlinkoConfig, plinkoProgress, type PlinkoConfig, type PlinkoMode } from '../core/games/plinko-config';
import { honorExclusionPact, startExclusionPact } from '../core/sim/self-exclusion-bet';
import { cleanAll, cleanTile, installMod, repair, setBaseBet, setCarpet, setPrice, testSpin, upgradeReels } from '../core/sim/actions';
import { payGuest } from '../core/sim/service-actions';
import { openHouse } from '../core/sim/money';
import { deployHeldCrate, movePlayer, pickupCrate, serveDesk, serveDrink, setNeonColor, setWallColor, storeHeldCrate, takeDrink, upgradeBar, upgradeWc } from '../core/sim/player';
import { buyCrate, orderDrinks, orderParts } from '../core/sim/deliveries';
import { calmDispute } from '../core/sim/disputes';
import { talkToGuest } from '../core/sim/charisma-talk';
import { spendPoint, type RpgAttribute } from '../core/sim/player-rpg';
import { resolveDuel } from '../core/sim/duel';
import { fireAgent, hireAgent } from '../core/sim/staff';
import type { BuildId } from '../core/sim/offers';
import { remodel } from '../core/sim/remodel';
import type { RivalId } from '../core/sim/rivals';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import { bookCardRound, riskRivalWin, visitRivalWithJournal, type ForeignOutcome } from './foreign-play';
import { settleMoneyJournal } from '../core/sim/journal';
import type { PlayerLook } from '../core/sim/player-look';
import { deployAtPlayer, saveLook, stepPlayer, takeHomeToWallet, useCarriedAtPlayer } from './player-tools';
import { createWorld, ensureStarter } from '../core/sim/templates';
import { tickWorld } from '../core/sim/tick';
import type { CarpetId, ModId, Point, StaffRole, TemplateId, WorldState } from '../core/sim/types';
import { Prng } from '../core/rng/prng';
import { buildView } from './snapshot';
import { clearOldSave, loadWorld, saveWorld } from './save';
import type { GameView } from './types';
const TICK_MS = 520;
class WorldStore {
  #ledger = new Ledger();
  #prng = new Prng(Date.now() >>> 0); // @seed-initializer
  #world: WorldState = createWorld('SMALL');
  #view: GameView;
  #notice = '0,00 VC im Hauskonto. Dein erster Automat steht gratis. Gäste kommen zum Eingang.';
  #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #savedTick = 0;
  constructor() {
    const hadOld = clearOldSave();
    const loaded = loadWorld();
    if (loaded) {
      this.#world = loaded.world;
      this.#ledger = loaded.ledger;
      this.#prng = new Prng(loaded.prngState);
      this.#notice = 'Spielstand geladen.';
    } else {
      ensureStarter(this.#world);
      this.#notice = hadOld
        ? 'Alter Spielstand verworfen. Neues Casino, neuer Gratis-Automat.'
        : this.#notice;
    }
    this.#view = buildView(this.#world, this.#ledger, this.#notice);
  }
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (this.#timer === null) this.#timer = setInterval(this.#advance, TICK_MS);
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0 && this.#timer !== null) {
        clearInterval(this.#timer);
        this.#timer = null;
      }
    };
  };
  getSnapshot = (): GameView => this.#view;
  newGame(template: TemplateId = 'SMALL'): void {
    this.#world = createWorld(template);
    this.#ledger = new Ledger();
    openHouse(this.#ledger, 0);
    this.#prng = new Prng((Date.now() ^ 0x9e3779b9) >>> 0); // @seed-initializer
    this.#notice = 'Neues Casino. Ein Automat steht gratis.';
    this.#emit();
  }
  setTemplate(template: TemplateId): void {
    if (template === this.#world.template) return;
    try {
      this.#world = remodel(this.#world, this.#ledger, template, this.#world.tick);
      this.#notice = this.#world.lastEvent;
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Umbau fehlgeschlagen.';
    }
    this.#emit();
  }
  buy(id: BuildId): void {
    this.#event(() => buyCrate(this.#world, this.#ledger, id));
  }
  orderDrinks(count: number): void {
    this.#event(() => orderDrinks(this.#world, this.#ledger, count));
  }
  orderParts(count: number): void {
    this.#event(() => orderParts(this.#world, this.#ledger, count));
  }
  pickup(crateId: number): void {
    this.#event(() => pickupCrate(this.#world, crateId));
  }
  deploy(x: number, y: number): void {
    this.#event(() => deployHeldCrate(this.#world, x, y));
  }
  unloadHere(): void {
    this.#guard(() => {
      const pos = this.#world.player.position;
      const bar = this.#world.furniture.find((item) => item.kind === 'BAR'
        && Math.abs(item.x - pos.x) + Math.abs(item.y - pos.y) <= 3);
      storeHeldCrate(this.#world, pos.x, pos.y, bar?.id);
      this.#notice = this.#world.lastEvent;
    });
  }
  storeDeposit(x: number, y: number, barId?: number): void {
    this.#guard(() => {
      storeHeldCrate(this.#world, x, y, barId);
      this.#notice = this.#world.lastEvent;
    });
  }
  calm(disputeId: number): void {
    this.#guard(() => {
      if (!calmDispute(this.#world, disputeId)) throw new Error('Zu weit weg. Geh zum Streit.');
      this.#notice = this.#world.lastEvent;
    });
  }
  talk(guestId: number): void {
    this.#guard(() => { if (!talkToGuest(this.#world, this.#prng, guestId)) throw new Error('Gast gerade nicht ansprechbar.'); this.#notice = this.#world.lastEvent; });
  }
  fightBrawl(disputeId: number): void {
    this.#guard(() => { this.#notice = resolveDuel(this.#world, this.#ledger, this.#prng, disputeId).outcome === 'NONE' ? 'Kein Streit mehr da.' : this.#world.lastEvent; });
  }
  spendSkill(attribute: RpgAttribute): void {
    this.#guard(() => { if (!spendPoint(this.#world.player.rpg, attribute)) throw new Error('Kein Skillpunkt frei.'); this.#notice = 'Skill verbessert.'; });
  }
  serveDesk(): void {
    this.#guard(() => {
      const served = serveDesk(this.#world, this.#ledger, this.#prng);
      this.#notice = served ? 'Gast gewechselt.' : 'Niemand wartet an der Kasse.';
    });
  }
  setWall(color: string): void {
    this.#guard(() => {
      setWallColor(this.#world, color);
      this.#notice = 'Wand gestrichen.';
    });
  }
  setNeon(color: string): void {
    this.#guard(() => {
      setNeonColor(this.#world, color);
      this.#notice = 'Neon neu gefärbt.';
    });
  }
  upgradeBar(): void {
    this.#guard(() => {
      upgradeBar(this.#world, this.#ledger);
      this.#notice = this.#world.lastEvent;
    });
  }
  upgradeWc(): void {
    this.#guard(() => {
      upgradeWc(this.#world, this.#ledger);
      this.#notice = this.#world.lastEvent;
    });
  }
  repair(itemId: number): void {
    this.#guard(() => {
      repair(this.#world, this.#ledger, itemId);
      this.#notice = 'Reparatur bezahlt.';
    });
  }
  clean(tile?: number): void {
    this.#guard(() => {
      if (tile === undefined) {
        const count = cleanAll(this.#world, this.#ledger);
        this.#notice = count ? `${count} Flecken weg.` : 'Alles sauber.';
      } else {
        cleanTile(this.#world, this.#ledger, tile);
        this.#notice = 'Fleck weg.';
      }
    });
  }
  hire(role: StaffRole): void {
    this.#guard(() => {
      hireAgent(this.#world, this.#ledger, role);
      this.#notice = this.#world.lastEvent;
    });
  }
  fire(role: StaffRole): void {
    this.#guard(() => {
      fireAgent(this.#world, role);
      this.#notice = 'Personal entlassen.';
    });
  }
  setPrice(key: 'drinkPrice' | 'slotMinBet', vc: number): void {
    this.#guard(() => {
      setPrice(this.#world, key, fromVC(vc));
      this.#notice = 'Preis geändert.';
    });
  }
  setCarpet(carpet: CarpetId): void {
    setCarpet(this.#world, carpet);
    this.#notice = 'Teppich verlegt.';
    this.#emit();
  }
  installMod(itemId: number, mod: ModId): void {
    this.#guard(() => { installMod(this.#world, this.#ledger, itemId, mod); this.#notice = 'Mod verbaut.'; });
  }
  addReel(itemId: number): void {
    this.#guard(() => { upgradeReels(this.#world, this.#ledger, itemId); this.#notice = 'Walze eingebaut.'; });
  }
  setBet(itemId: number, vc: number): void {
    this.#guard(() => { setBaseBet(this.#world, itemId, fromVC(vc)); this.#notice = 'Mindesteinsatz geändert.'; });
  }
  /** Risiko-Karte nach einem fremden Gewinn: verdoppeln oder zurueckbuchen. */
  riskCard(rivalId: RivalId, color: RiskColor, stakeVC: number): RiskOutcome | null {
    const booking = riskRivalWin(this.#world, this.#ledger, rivalId, fromVC(stakeVC), color, this.#prng);
    this.#notice = booking.notice;
    this.#emit(booking.outcome !== null);
    return booking.outcome;
  }
  takeHome(amountVC = 5): void {
    this.#guard(() => { this.#notice = takeHomeToWallet(this.#world, this.#ledger, amountVC); });
  }
  pay(guestId: number): void {
    this.#guard(() => {
      const paid = payGuest(this.#world, this.#ledger, guestId, this.#world.tick);
      this.#notice = paid > 0 ? `${toVCString(paid)} an Gast ausgezahlt.` : 'Keine offene Auszahlung.';
    });
  }
  takeDrink(): void { this.#event(() => takeDrink(this.#world)); }
  serveDrink(guestId: number): void { this.#event(() => serveDrink(this.#world, this.#ledger, guestId)); }
  moveTo(point: Point): void { movePlayer(this.#world, point); this.#emit(false); }
  /** Kartenrunde: Schuh aus dem Welt-PRNG, gebucht wird erst das Ergebnis. */
  cardSeed(): number { return this.#prng.nextInt(1, 2_147_483_646); }
  settleCard(rivalId: RivalId, machineIndex: number, stakeVC: number, bps: number, label: string): GameResult | null {
    return this.#foreign(() => bookCardRound(this.#world, this.#ledger, rivalId, machineIndex, fromVC(stakeVC), bps, label));
  }
  /** Huetchen: die Runde steht vor der Wahl fest, gebucht wird erst der Griff. */
  shellRound(cups = 3): ShellRound { return createShellRound(this.#prng, cups); }
  playRival(rivalId: RivalId, machineIndex: number, betVC: number, options?: GameExtras): GameResult | null {
    const result = this.#foreign(() => visitRivalWithJournal(this.#world, this.#ledger, rivalId, machineIndex, betVC, this.#prng, options));
    if (result) this.#emit(false);
    return result;
  }
  /** Volle Ledger-Pruefung nur auf Klick; der Tickpfad bleibt inkrementell. */
  auditLedger(): LedgerDiagnosis {
    return this.#ledger.diagnose();
  }
  setLook(patch: Partial<PlayerLook>): void {
    this.#guard(() => { this.#notice = saveLook(this.#world, patch); });
  }
  moveStep(dx: number, dy: number): void {
    stepPlayer(this.#world, dx, dy);
    this.#emit(false);
  }
  deployHere(): void {
    this.#guard(() => { this.#notice = deployAtPlayer(this.#world); });
  }
  useCarriedHere(): void {
    this.#guard(() => { this.#notice = useCarriedAtPlayer(this.#world) ?? this.#notice; });
  }
  /** Ein Pfad fuer alle fremden Haeuser: gleiche Notiz, gleiche Fehlerbehandlung. */
  #foreign(run: () => ForeignOutcome): GameResult | null {
    try {
      const { result, notice } = run();
      this.#notice = notice;
      this.#emit();
      return result;
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Fremdes Spiel fehlgeschlagen.';
      this.#emit(false);
      return null;
    }
  }
  spinTest(itemId: number): GameResult | null {
    const item = this.#world.furniture.find((entry) => entry.id === itemId);
    if (!item) return null;
    const result = testSpin(item, this.#prng, this.#world);
    if (item.gameId === 'PLINKO' || item.gameId === 'SLOT') {
      this.#notice = item.gameId === 'SLOT' ? 'Slot-Telemetrie aktualisiert.' : 'Plinko-Bahn gespielt.';
      this.#emit();
    }
    return result;
  }
  deployPlinko(input: PlinkoConfig): GateResult {
    try {
      const config = normalizePlinkoConfig(input);
      const gate = deployGate(config, plinkoProgress(this.#world.totalPlinkoDrops, this.#world.addictionScore, config).rows);
      if (gate.ok) this.#world.plinko = config;
      this.#notice = gate.reason;
      this.#emit(gate.ok);
      return gate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Board ungueltig.';
      this.#notice = reason;
      this.#emit(false);
      return { ok: false, measuredRtp: 0, reason };
    }
  }
  setPlinkoMode(mode: PlinkoMode): void {
    this.#guard(() => {
      if (mode !== 'SINGLE' && plinkoProgress(this.#world.totalPlinkoDrops, this.#world.addictionScore, this.#world.plinko).rows < (mode === 'TWIN' ? 9 : 12)) throw new Error(`${mode} ist noch nicht freigeschaltet.`);
      this.#world.plinkoMode = mode;
      this.#notice = `Plinko-Modus: ${mode}.`;
    });
  }
  exclusion(command: 'START' | 'HONOR', limitVC = 100): void {
    this.#guard(() => {
      const result = command === 'START'
        ? startExclusionPact(this.#world, this.#ledger, fromVC(limitVC), this.#world.tick)
        : honorExclusionPact(this.#world, this.#ledger, this.#world.tick);
      this.#notice = result.notice;
    });
  }
  dismiss(): void {
    this.#notice = '';
    this.#emit(false);
  }
  #advance = (): void => {
    tickWorld(this.#world, this.#ledger, this.#prng);
    this.#savedTick += 1;
    this.#emit(this.#savedTick % 6 === 0);
  };
  /** Wie #guard, uebernimmt aber die Ereignismeldung der Welt. */
  #event(run: () => void): void {
    this.#guard(() => {
      run();
      this.#notice = this.#world.lastEvent;
    });
  }
  #guard(action: () => void): void {
    try {
      action();
      this.#emit();
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.';
      this.#emit(false);
    }
  }
  #emit(save = true): void {
    settleMoneyJournal(this.#world, this.#ledger);
    this.#view = buildView(this.#world, this.#ledger, this.#notice);
    if (save) saveWorld(this.#world, this.#ledger, this.#prng.getState());
    for (const listener of this.#listeners) listener();
  }
}
export const worldStore = new WorldStore();
