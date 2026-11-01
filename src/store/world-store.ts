/** Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. Commands delegiert an Module. */
import { Ledger, type LedgerDiagnosis } from '../core/economy/ledger';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { ShellRound } from '../core/games/shell-round';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import { openHouse } from '../core/sim/money';
import { remodel } from '../core/sim/remodel';
import type { BuildId } from '../core/sim/offers';
import type { CarpetId, ModId, Point, StaffRole, TemplateId, WorldState, PlayerJobId, RivalId } from '../core/sim/types';
import type { RpgAttribute } from '../core/sim/player-rpg';
import { Prng } from '../core/rng/prng';
import { buildView } from './snapshot';
import { clearOldSave, loadWorld, SAVE_FAILED_NOTICE, saveWorld } from './save';
import { createWorld, ensureStarter } from '../core/sim/templates';
import { tickWorld } from '../core/sim/tick';
import { settleMoneyJournal } from '../core/sim/journal';
import type { PlayerLook } from '../core/sim/player-look';
import { deployAtPlayer, saveLook, stepPlayer, useCarriedAtPlayer } from './player-tools';
import type { CardDeal } from './foreign-play';
import type { GameView } from './types';
import { acceptJobCmd, quitJobCmd, requestJobTaskCmd, buyBarCmd, visitForeignCmd, leaveForeignCmd } from './foreign-floor-commands';
import { riskCardCmd, dealCardCmd, settleCardCmd, additionalBetCmd, playRivalCmd, shellRoundCmd, takeHomeCmd } from './rival-play-commands';
import { buyCmd, orderDrinksCmd, orderPartsCmd, pickupCmd, deployCmd, unloadHereCmd, storeDepositCmd, calmCmd, talkCmd, fightBrawlCmd, spendSkillCmd, serveDeskCmd, setWallCmd, setNeonCmd, upgradeBarCmd, upgradeWcCmd, repairCmd, cleanCmd, hireCmd, fireCmd, setPriceCmd, setCarpetCmd, installModCmd, addReelCmd, setBetCmd, setSlotOddsCmd } from './venue-commands';
import { takeDrinkCmd, serveDrinkCmd, moveToCmd, payCmd } from './service-commands';
import { spinTestCmd, deployPlinkoCmd, setPlinkoModeCmd, exclusionCmd } from './game-commands';
const TICK_MS = 520;
class WorldStore {
  #ledger = new Ledger();
  #prng = new Prng(Date.now() >>> 0); // @seed-initializer
  #world: WorldState = createWorld('SMALL');
  #view: GameView;
  #notice = '150 VC Startkapital. Dein erster Automat steht gratis. Gäste kommen zum Eingang.';
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
      openHouse(this.#ledger, 0);
      this.#notice = hadOld ? 'Alter Spielstand verworfen. Neues Casino, 150 VC Startkapital.' : this.#notice;
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
  buy(id: BuildId): void { this.#event(() => buyCmd(this.#world, this.#ledger, id)); }
  orderDrinks(count: number): void { this.#event(() => { this.#notice = orderDrinksCmd(this.#world, this.#ledger, count); }); }
  orderParts(count: number): void { this.#event(() => { this.#notice = orderPartsCmd(this.#world, this.#ledger, count); }); }
  pickup(crateId: number): void { this.#event(() => { this.#notice = pickupCmd(this.#world, crateId); }); }
  deploy(x: number, y: number): void { this.#event(() => { this.#notice = deployCmd(this.#world, x, y); }); }
  unloadHere(): void { this.#guard(() => { this.#notice = unloadHereCmd(this.#world); }); }
  storeDeposit(x: number, y: number, barId?: number): void { this.#guard(() => { this.#notice = storeDepositCmd(this.#world, x, y, barId); }); }
  calm(disputeId: number): void { this.#guard(() => { this.#notice = calmCmd(this.#world, disputeId); }); }
  talk(guestId: number): void { this.#guard(() => { this.#notice = talkCmd(this.#world, this.#prng, guestId); }); }
  fightBrawl(disputeId: number): void { this.#guard(() => { this.#notice = fightBrawlCmd(this.#world, this.#ledger, this.#prng, disputeId); }); }
  spendSkill(attribute: RpgAttribute): void { this.#guard(() => { this.#notice = spendSkillCmd(this.#world, attribute); }); }
  serveDesk(): void { this.#guard(() => { this.#notice = serveDeskCmd(this.#world, this.#ledger, this.#prng); }); }
  setWall(color: string): void { this.#guard(() => { this.#notice = setWallCmd(this.#world, color); }); }
  setNeon(color: string): void { this.#guard(() => { this.#notice = setNeonCmd(this.#world, color); }); }
  upgradeBar(): void { this.#guard(() => { this.#notice = upgradeBarCmd(this.#world, this.#ledger); }); }
  upgradeWc(): void { this.#guard(() => { this.#notice = upgradeWcCmd(this.#world, this.#ledger); }); }
  repair(itemId: number): void { this.#guard(() => { this.#notice = repairCmd(this.#world, this.#ledger, itemId); }); }
  clean(tile?: number): void { this.#guard(() => { this.#notice = cleanCmd(this.#world, this.#ledger, tile); }); }
  hire(role: StaffRole): void { this.#guard(() => { this.#notice = hireCmd(this.#world, this.#ledger, role); }); }
  fire(role: StaffRole): void { this.#guard(() => { this.#notice = fireCmd(this.#world, role); }); }
  setPrice(key: 'drinkPrice' | 'slotMinBet', vc: number): void { this.#guard(() => { this.#notice = setPriceCmd(this.#world, key, vc); }); }
  setCarpet(carpet: CarpetId): void { this.#notice = setCarpetCmd(this.#world, carpet); this.#emit(); }
  installMod(itemId: number, mod: ModId): void { this.#guard(() => { this.#notice = installModCmd(this.#world, this.#ledger, itemId, mod); }); }
  addReel(itemId: number): void { this.#guard(() => { this.#notice = addReelCmd(this.#world, this.#ledger, itemId); }); }
  setBet(itemId: number, vc: number): void { this.#guard(() => { this.#notice = setBetCmd(this.#world, itemId, vc); }); }
  setSlotOdds(itemId: number, profile: import('../core/games/slot-profile').SlotProfile): void { this.#guard(() => { this.#notice = setSlotOddsCmd(this.#world, itemId, profile); }); }
  acceptJob(rivalId: RivalId, jobId: PlayerJobId): void { this.#guard(() => { acceptJobCmd(this.#world, rivalId, jobId); this.#notice = this.#world.lastEvent; }); }
  quitJob(): void { this.#guard(() => { quitJobCmd(this.#world); this.#notice = this.#world.lastEvent; }); }
  requestJobTask(): void { this.#guard(() => { const result = requestJobTaskCmd(this.#world); this.#notice = result.started ? 'Arbeit aufgenommen.' : `In Warteschlange (Position ${result.queuePosition + 1}).`; }); }
  visitForeign(rivalId: RivalId): void { this.#guard(() => { visitForeignCmd(this.#world, rivalId); this.#notice = this.#world.lastEvent; }); }
  leaveForeign(): void { this.#guard(() => { leaveForeignCmd(this.#world); this.#notice = this.#world.lastEvent; }); }
  buyBar(): void { this.#guard(() => { buyBarCmd(this.#world, this.#ledger, this.#world.tick); this.#notice = this.#world.lastEvent; }); }
  takeDrink(): void { this.#event(() => { this.#notice = takeDrinkCmd(this.#world); }); }
  serveDrink(guestId: number): void { this.#event(() => { this.#notice = serveDrinkCmd(this.#world, this.#ledger, guestId); }); }
  moveTo(point: Point): void { moveToCmd(this.#world, point); this.#emit(false); }
  pay(guestId: number): void { this.#guard(() => { this.#notice = payCmd(this.#world, this.#ledger, guestId); }); }
  takeHome(amountVC = 5): void { this.#guard(() => { this.#notice = takeHomeCmd(this.#world, this.#ledger, amountVC); }); }
  riskCard(rivalId: RivalId, color: RiskColor, stakeVC: number): RiskOutcome | null { return riskCardCmd(this.#world, this.#ledger, rivalId, color, stakeVC, this.#prng); }
  dealCard(rivalId: RivalId, machineIndex: number, stakeVC: number, bps: number): CardDeal | null { return dealCardCmd(this.#world, this.#ledger, this.#prng, rivalId, machineIndex, stakeVC, bps); }
  settleCard(rivalId: RivalId, machineIndex: number, stakeVC: number, netBps: number, label: string): GameResult | null { return settleCardCmd(this.#world, this.#ledger, rivalId, machineIndex, stakeVC, netBps, label); }
  additionalBet(amountVC: number): void { try { additionalBetCmd(this.#world, this.#ledger, amountVC); this.#notice = 'Zusatz-Einsatz gebucht.'; this.#emit(); } catch (error) { this.#notice = error instanceof Error ? error.message : 'Zusatz-Einsatz fehlgeschlagen.'; this.#emit(false); } }
  shellRound(cups = 3): ShellRound { return shellRoundCmd(this.#prng, cups); }
  playRival(rivalId: RivalId, machineIndex: number, betVC: number, options?: GameExtras): GameResult | null { const result = playRivalCmd(this.#world, this.#ledger, rivalId, machineIndex, betVC, this.#prng, options); if (result) this.#emit(false); return result; }
  auditLedger(): LedgerDiagnosis { return this.#ledger.diagnose(); }
  setLook(patch: Partial<PlayerLook>): void { this.#guard(() => { this.#notice = saveLook(this.#world, patch); }); }
  moveStep(dx: number, dy: number): void { stepPlayer(this.#world, dx, dy); this.#emit(false); }
  deployHere(): void { this.#guard(() => { this.#notice = deployAtPlayer(this.#world); }); }
  useCarriedHere(): void { this.#guard(() => { this.#notice = useCarriedAtPlayer(this.#world) ?? this.#notice; }); }
  spinTest(itemId: number): GameResult | null { const { result } = spinTestCmd(this.#world, itemId); if (result) { this.#notice = spinTestCmd(this.#world, itemId).notice; this.#emit(); } return result; }
  deployPlinko(input: import('../core/games/plinko-config').PlinkoConfig): import('../core/games/plinko-sandbox').GateResult { return deployPlinkoCmd(this.#world, input); }
  setPlinkoMode(mode: import('../core/games/plinko-config').PlinkoMode): void { this.#guard(() => { this.#notice = setPlinkoModeCmd(this.#world, mode); }); }
  exclusion(command: 'START' | 'HONOR', limitVC = 100): void { this.#guard(() => { this.#notice = exclusionCmd(this.#world, this.#ledger, command, limitVC); }); }
  dismiss(): void { this.#notice = ''; this.#emit(false); }
  #advance = (): void => { tickWorld(this.#world, this.#ledger, this.#prng); this.#savedTick += 1; this.#emit(this.#savedTick % 6 === 0); };
  #event(run: () => void): void { this.#guard(() => { run(); this.#notice = this.#world.lastEvent; }); }
  #guard(action: () => void): void { try { action(); this.#emit(); } catch (error) { this.#notice = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'; this.#emit(false); } }
  #emit(save = true): void { settleMoneyJournal(this.#world, this.#ledger); if (save && !saveWorld(this.#world, this.#ledger, this.#prng.getState())) this.#notice = SAVE_FAILED_NOTICE; this.#view = buildView(this.#world, this.#ledger, this.#notice); for (const listener of this.#listeners) listener(); }
}
export const worldStore = new WorldStore();
