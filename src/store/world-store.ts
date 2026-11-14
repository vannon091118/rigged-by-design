/** Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. Commands delegiert an Module. */
import { Ledger, type LedgerDiagnosis } from '../core/economy/ledger';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { ShellRound } from '../core/games/shell-round';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import { applyLayout } from '../core/sim/layout';
import type { LayoutCommand } from '../core/sim/layout-commands';
import { LayoutEditor } from './layout-editing';
import { LayoutTransfer } from './layout-transfer';
import { OwnPlay } from './own-play';
import { remodel } from '../core/sim/remodel';
import type { BuildId } from '../core/sim/offers';
import type { CarpetId, ModId, Point, StaffRole, TemplateId, WorldState, PlayerJobId, RivalId } from '../core/sim/types';
import type { RpgAttribute } from '../core/sim/player-rpg';
import { Prng } from '../core/rng/prng';
import { entropySeed } from '../core/rng/streams';
import { buildView } from './snapshot';
import { clearOldSave, loadWorld, SAVE_FAILED_NOTICE, saveWorld } from './save';
import { exportGameData, planImportData, type TransferReport } from './transfer';
import { createWorld } from '../core/sim/templates';
import { WorldTick } from './world-tick';
import { settleMoneyJournal } from '../core/sim/journal';
import { esportEveningView, type EsportEveningView } from '../core/sim/esport-event';
import { PORTEMONNAIE } from '../core/sim/money';
import type { ChoiceExecution } from '../core/sim/narrative/commands/types';
import { flushNarrativeCmd } from './narrative-commands';
import { chooseNarrativeAction, dismissNarrativeAction } from './narrative-store-actions';
import type { PlayerLook } from '../core/sim/player-look';
import { deployAtPlayer, saveLook, stepPlayer, useCarriedAtPlayer } from './player-tools';
import type { CardDeal } from './foreign-play';
import type { GameView } from './types';
import { acceptJobCmd, quitJobCmd, requestJobTaskCmd, buyBarCmd, visitForeignCmd, leaveForeignCmd } from './foreign-floor-commands';
import { riskCardCmd, dealCardCmd, settleCardCmd, additionalBetCmd, playRivalCmd, shellRoundCmd, takeHomeCmd } from './rival-play-commands';
import { buyCmd, orderDrinksCmd, orderPartsCmd, pickupCmd, deployCmd, unloadHereCmd, storeDepositCmd, calmCmd, talkCmd, fightBrawlCmd, spendSkillCmd, serveDeskCmd, setWallCmd, setNeonCmd, upgradeBarCmd, upgradeWcCmd, repairCmd, cleanCmd, hireCmd, fireCmd, setPriceCmd, setCarpetCmd, installModCmd, addReelCmd, setBetCmd, setSlotOddsCmd } from './venue-commands';
import { pickupMopCmd, dropMopCmd, cleanStainCmd, getMopAtToiletCmd } from './mop-commands';
import { takeDrinkCmd, serveDrinkCmd, moveToCmd, payCmd } from './service-commands';
import { cityCmd, type CityCommand } from './city-commands';
import { spinTestCmd, deployPlinkoCmd, setPlinkoModeCmd, exclusionCmd, type ExclusionCommand } from './game-commands';
import { InteractionStore } from './interaction-store';
import { QueueCommands } from './queue-commands';
import { SceneCommands } from './scene-commands';
import { createNewGame } from './new-game';
import { drinkAtHome, eatAtHome } from '../core/sim/player-needs';

class WorldStore {
  #ledger = new Ledger();
  #prng = new Prng(entropySeed());
  #world: WorldState = createWorld('SMALL');
  #view: GameView;
  #notice = '150 VC Startkapital. Dein erster Automat steht gratis. Gäste kommen zum Eingang.';
  #listeners = new Set<() => void>();
  readonly #tick = new WorldTick({
    world: () => this.#world, ledger: () => this.#ledger, prng: () => this.#prng,
    arriveStreetDoor: () => this.scene.arriveAtStreetDoor(), leaveApartmentDoor: () => this.scene.leaveApartmentAtDoor(), leaveInteriorDoor: () => this.scene.leaveInteriorAtDoor(),
    emit: (save) => this.#emit(save), hasListeners: () => this.#listeners.size > 0,
    fault: (message) => { this.#notice = message; this.#view = buildView(this.#world, this.#ledger, this.#notice); for (const listener of this.#listeners) listener(); },
  });
  readonly #layoutEditor = new LayoutEditor({
    layout: () => this.#world.layout, apply: (layout) => applyLayout(this.#world, layout),
    emit: (save) => this.#emit(save), notice: (text) => { this.#notice = text; },
  });
  readonly #layoutTransfer = new LayoutTransfer(() => this.#world, {
    apply: (layout) => applyLayout(this.#world, layout), reset: () => this.#layoutEditor.reset(),
    notice: (text) => { this.#notice = text; }, emit: (save) => this.#emit(save),
  });
  readonly own = new OwnPlay({ world: () => this.#world, ledger: () => this.#ledger, prng: () => this.#prng, emit: (save) => this.#emit(save), notice: (text) => { this.#notice = text; } });
  readonly interaction = new InteractionStore({ world: () => this.#world, emit: (save) => this.#emit(save), notice: (text) => { this.#notice = text; } });
  readonly queue = new QueueCommands({ world: () => this.#world, emit: (save) => this.#emit(save), notice: (text) => { this.#notice = text; } });
  readonly scene = new SceneCommands({ world: () => this.#world, emit: () => this.#emit(), notice: (text) => { this.#notice = text; } });
  constructor() {
    const hadOld = clearOldSave();
    const loaded = loadWorld();
    if (loaded) {
      this.#world = loaded.world;
      this.#ledger = loaded.ledger;
      this.#prng = new Prng(loaded.prngState);
      this.#notice = 'Spielstand geladen.';
    } else {
      this.#startNew('SMALL');
      if (hadOld) this.#notice = 'Alter Spielstand verworfen. Neues Spiel in der Stadt.';
    }
    this.#view = buildView(this.#world, this.#ledger, this.#notice);
  }

  /** Neuer Start: Wohnung first, eigenes Casino mit leerem Raum und Starter-Kiste. */
  #startNew(template: TemplateId): void {
    this.#tick.reset();
    const start = createNewGame(template);
    this.#world = start.world;
    this.#ledger = start.ledger;
    this.#prng = start.prng;
    this.#notice = start.notice;
    this.#layoutEditor.reset();
  }
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    this.#tick.start();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#tick.stop();
    };
  };
  getSnapshot = (): GameView => this.#view;
  newGame(template: TemplateId = 'SMALL'): void {
    this.#startNew(template);
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
    this.#layoutEditor.reset();
    this.#emit();
  }
  buy(id: BuildId): void { this.#event(() => buyCmd(this.#world, this.#ledger, id)); } orderDrinks(count: number): void { this.#event(() => { this.#notice = orderDrinksCmd(this.#world, this.#ledger, count); }); } orderParts(count: number): void { this.#event(() => { this.#notice = orderPartsCmd(this.#world, this.#ledger, count); }); }
  pickup(crateId: number): void { this.#event(() => { this.#notice = pickupCmd(this.#world, crateId); }); } deploy(x: number, y: number): void { this.#event(() => { this.#notice = deployCmd(this.#world, x, y); }); } unloadHere(): void { this.#guard(() => { this.#notice = unloadHereCmd(this.#world); }); }
  storeDeposit(x: number, y: number, barId?: number): void { this.#guard(() => { this.#notice = storeDepositCmd(this.#world, x, y, barId); }); } calm(disputeId: number): void { this.#guard(() => { this.#notice = calmCmd(this.#world, disputeId); }); } talk(guestId: number): void { this.#guard(() => { this.#notice = talkCmd(this.#world, this.#prng, guestId); }); }
  fightBrawl(disputeId: number): void { this.#guard(() => { this.#notice = fightBrawlCmd(this.#world, this.#ledger, this.#prng, disputeId); }); } spendSkill(attribute: RpgAttribute): void { this.#guard(() => { this.#notice = spendSkillCmd(this.#world, attribute); }); } serveDesk(): void { this.#guard(() => { this.#notice = serveDeskCmd(this.#world, this.#ledger, this.#prng); }); }
  setWall(color: string): void { this.#guard(() => { this.#notice = setWallCmd(this.#world, color); }, false); } setNeon(color: string): void { this.#guard(() => { this.#notice = setNeonCmd(this.#world, color); }, false); } upgradeBar(): void { this.#guard(() => { this.#notice = upgradeBarCmd(this.#world, this.#ledger); }); }
  upgradeWc(): void { this.#guard(() => { this.#notice = upgradeWcCmd(this.#world, this.#ledger); }); } repair(itemId: number): void { this.#guard(() => { this.#notice = repairCmd(this.#world, this.#ledger, itemId); }); }
  clean(tile?: number): void { if (tile === undefined) { this.queue.enqueueCleanRoom(); return; } this.#guard(() => { this.#notice = cleanCmd(this.#world, this.#ledger, tile); }); } hire(role: StaffRole): void { this.#guard(() => { this.#notice = hireCmd(this.#world, this.#ledger, role); }); } fire(role: StaffRole): void { this.#guard(() => { this.#notice = fireCmd(this.#world, role); }); } setPrice(key: 'drinkPrice' | 'slotMinBet', vc: number): void { this.#guard(() => { this.#notice = setPriceCmd(this.#world, key, vc); }); } setCarpet(carpet: CarpetId): void { this.#guard(() => { this.#notice = setCarpetCmd(this.#world, carpet); }, false); }
  beginLayoutStroke(label = 'Pinselstrich'): void { this.#layoutEditor.begin(label); } paintLayout(command: LayoutCommand): boolean { return this.#layoutEditor.paint(command); } endLayoutStroke(): void { this.#layoutEditor.end(); }
  undoLayout(): boolean { return this.#layoutEditor.undo(); } redoLayout(): boolean { return this.#layoutEditor.redo(); } canUndoLayout(): boolean { return this.#layoutEditor.canUndo(); } canRedoLayout(): boolean { return this.#layoutEditor.canRedo(); }
  exportLayout(): string { return this.#layoutTransfer.export(); } importLayout(text: string): { readonly ok: boolean; readonly issues: readonly string[] } { return this.#layoutTransfer.import(text); }
  installMod(itemId: number, mod: ModId): void { this.#guard(() => { this.#notice = installModCmd(this.#world, this.#ledger, itemId, mod); }); } addReel(itemId: number): void { this.#guard(() => { this.#notice = addReelCmd(this.#world, this.#ledger, itemId); }); } setBet(itemId: number, vc: number): void { this.#guard(() => { this.#notice = setBetCmd(this.#world, itemId, vc); }); } setSlotOdds(itemId: number, profile: import('../core/games/slot-profile').SlotProfile): void { this.#guard(() => { this.#notice = setSlotOddsCmd(this.#world, itemId, profile); }); }
  pickupMop(mopId: number): void { this.#guard(() => { this.#notice = pickupMopCmd(this.#world, mopId); }); } dropMop(): void { this.#guard(() => { this.#notice = dropMopCmd(this.#world); }); } cleanStain(stainId: number): void { this.#guard(() => { this.#notice = cleanStainCmd(this.#world, this.#ledger, stainId); }); } getMopAtToilet(toiletId?: number): void { this.#guard(() => { this.#notice = getMopAtToiletCmd(this.#world, toiletId); }); }
  acceptJob(rivalId: RivalId, jobId: PlayerJobId): void { this.#guard(() => { acceptJobCmd(this.#world, rivalId, jobId); this.#notice = this.#world.lastEvent; }); } quitJob(): void { this.#guard(() => { quitJobCmd(this.#world); this.#notice = this.#world.lastEvent; }); } requestJobTask(): void { this.#guard(() => { const result = requestJobTaskCmd(this.#world); this.#notice = result.started ? 'Arbeit aufgenommen.' : `In Warteschlange (Position ${result.queuePosition + 1}).`; }); }
  visitForeign(rivalId: RivalId): void { this.#guard(() => { visitForeignCmd(this.#world, rivalId); this.#notice = this.#world.lastEvent; }); } leaveForeign(): void { this.#guard(() => { leaveForeignCmd(this.#world); this.#notice = this.#world.lastEvent; }); } buyBar(): void { this.#guard(() => { buyBarCmd(this.#world, this.#ledger, this.#world.tick); this.#notice = this.#world.lastEvent; }); }
  takeDrink(barId?: number): void { this.#event(() => { this.#notice = takeDrinkCmd(this.#world, barId); }); } serveDrink(guestId: number): void { this.#event(() => { this.#notice = serveDrinkCmd(this.#world, this.#ledger, guestId); }); } eatAtHome(): void { this.#guard(() => { eatAtHome(this.#world); this.#notice = this.#world.lastEvent; }); } drinkAtHome(): void { this.#guard(() => { drinkAtHome(this.#world); this.#notice = this.#world.lastEvent; }); } moveTo(point: Point): void { moveToCmd(this.#world, point); this.#emit(false); }
  pay(guestId: number): void { this.#guard(() => { this.#notice = payCmd(this.#world, this.#ledger, guestId); }); } takeHome(amountVC = 5): void { this.#guard(() => { this.#notice = takeHomeCmd(this.#world, this.#ledger, amountVC); }); }
  riskCard(rivalId: RivalId, color: RiskColor, stakeVC: number): RiskOutcome | null { return riskCardCmd(this.#world, this.#ledger, rivalId, color, stakeVC, this.#prng); } dealCard(rivalId: RivalId, machineIndex: number, stakeVC: number): CardDeal | null { return dealCardCmd(this.#world, this.#ledger, this.#prng, rivalId, machineIndex, stakeVC); } settleCard(rivalId: RivalId, machineIndex: number, stakeVC: number, netBps: number, label: string): GameResult | null { return settleCardCmd(this.#world, this.#ledger, rivalId, machineIndex, stakeVC, netBps, label); }
  additionalBet(amountVC: number): boolean { let booked = false; this.#guard(() => { additionalBetCmd(this.#world, this.#ledger, amountVC); this.#notice = 'Zusatz-Einsatz gebucht.'; booked = true; }); return booked; }
  /** Der E-Sport-Abend liest denselben Zustand; kein zweiter Speicher und kein Save-Feld. */
  esportEvening(): EsportEveningView { return esportEveningView(this.#world, this.#ledger.getBalance(PORTEMONNAIE)); }
  shellRound(cups = 3): ShellRound { return shellRoundCmd(this.#prng, cups); } playRival(rivalId: RivalId, machineIndex: number, betVC: number, options?: GameExtras): GameResult | null { const result = playRivalCmd(this.#world, this.#ledger, rivalId, machineIndex, betVC, this.#prng, options); if (result) { flushNarrativeCmd(this.#world, this.#ledger); this.#emit(false); } return result; }
  city(cmd: CityCommand): void { this.#guard(() => { this.#notice = cityCmd(this.#world, this.#ledger, this.#prng, cmd); }); } auditLedger(): LedgerDiagnosis { return this.#ledger.diagnose(); } exportGame(): string { return exportGameData(this.#world, this.#ledger, this.#prng.getState()); } planImport(raw: string): TransferReport { return planImportData(raw).report; }
  importGame(raw: string): TransferReport {
    const { report, loaded } = planImportData(raw);
    if (!loaded) {
      this.#notice = report.issues[0]?.message ?? 'Import nicht moeglich.';
      this.#emit(false);
      return report;
    }
    this.#world = loaded.world;
    this.#ledger = loaded.ledger;
    this.#prng = new Prng(loaded.prngState);
    flushNarrativeCmd(this.#world, this.#ledger);
    this.#notice = 'Spielstand importiert.';
    this.#layoutEditor.reset();
    this.#tick.reset();
    this.#emit();
    return report;
  }
  setLook(patch: Partial<PlayerLook>): void { this.#guard(() => { this.#notice = saveLook(this.#world, patch); }, false); } moveStep(dx: number, dy: number): void { stepPlayer(this.#world, dx, dy); this.#emit(false); } deployHere(): void { this.#guard(() => { this.#notice = deployAtPlayer(this.#world); }); } useCarriedHere(): void { this.#guard(() => { this.#notice = useCarriedAtPlayer(this.#world) ?? this.#notice; }); }
  spinTest(itemId: number): GameResult | null { const { result, notice } = spinTestCmd(this.#world, itemId); if (result) { this.#notice = notice; this.#emit(); } return result; } deployPlinko(input: import('../core/games/plinko-config').PlinkoConfig): import('../core/games/plinko-sandbox').GateResult { return deployPlinkoCmd(this.#world, input); } setPlinkoMode(mode: import('../core/games/plinko-config').PlinkoMode): void { this.#guard(() => { this.#notice = setPlinkoModeCmd(this.#world, mode); }); } exclusion(command: ExclusionCommand, limitVC = 100): void { this.#guard(() => { this.#notice = exclusionCmd(this.#world, this.#ledger, command, limitVC); }); }
  chooseNarrative(eventId: number, choiceId: string): ChoiceExecution | null { let result: ChoiceExecution | null = null; this.#guard(() => { const action = chooseNarrativeAction(this.#world, this.#ledger, eventId, choiceId); result = action.result; this.#notice = action.notice; }); return result; } dismissNarrative(eventId: number): void { this.#guard(() => { this.#notice = dismissNarrativeAction(this.#world, eventId); }); }
  dismiss(): void { this.#notice = ''; this.#emit(false); }

  #event(run: () => void): void { this.#guard(() => { run(); this.#notice = this.#world.lastEvent; }); }
  #guard(action: () => void, flush = true): void { try { action(); if (flush) flushNarrativeCmd(this.#world, this.#ledger); this.#emit(); } catch (error) { this.#notice = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'; this.#emit(false); } }
  #emit(save = true): void { settleMoneyJournal(this.#world, this.#ledger); if (save && !saveWorld(this.#world, this.#ledger, this.#prng.getState())) this.#notice = SAVE_FAILED_NOTICE; this.#view = buildView(this.#world, this.#ledger, this.#notice); for (const listener of this.#listeners) listener(); }
}
export const worldStore = new WorldStore();
