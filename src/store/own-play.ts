/**
 * Store-Fassade fuer eigene Spielrunden: Der Kern rechnet und bucht, die
 * Fassade haelt nur die offene Kartenrunde je Geraet und verteilt Notice/Save.
 */
import type { Ledger } from '../core/economy/ledger';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { RiskColor, RiskOutcome } from '../core/games/risk-card';
import type { Prng } from '../core/rng/prng';
import { ownAdditionalBet, ownCardDeal, ownCardSettle, ownRisk, playOwnRound } from '../core/sim/own-play';
import type { WorldState } from '../core/sim/types';
import { furnitureById } from '../core/sim/world';
import type { CardDeal } from './foreign-play';

interface OwnPlayDeps {
  readonly world: () => WorldState;
  readonly ledger: () => Ledger;
  readonly prng: () => Prng;
  readonly emit: (save: boolean) => void;
  readonly notice: (text: string) => void;
}

interface PendingDeal {
  readonly stake: VaCoinMicro;
  readonly label: string;
}

export class OwnPlay {
  readonly #deps: OwnPlayDeps;
  readonly #pending = new Map<number, PendingDeal>();

  constructor(deps: OwnPlayDeps) {
    this.#deps = deps;
  }

  spin(itemId: number, betVC: number, options: GameExtras = {}): GameResult | null {
    return this.#run(() => {
      if (this.#pending.has(itemId)) throw new Error('An diesem Gerät läuft noch eine Kartenrunde.');
      const item = this.#item(itemId);
      const result = playOwnRound(this.#deps.world(), this.#deps.ledger(), itemId, betVC, this.#deps.prng(), options);
      this.#deps.notice(`${item.label}: ${result.label}${result.payout > 0 ? ` · ${toVCString(result.payout)} zurück` : ' · verloren'}.`);
      return result;
    });
  }

  deal(itemId: number, betVC: number): CardDeal | null {
    return this.#run(() => {
      if (this.#pending.has(itemId)) throw new Error('An diesem Gerät läuft noch eine Kartenrunde.');
      const item = this.#item(itemId);
      const deal = ownCardDeal(this.#deps.world(), this.#deps.ledger(), itemId, betVC, this.#deps.prng());
      this.#pending.set(itemId, { stake: fromVC(betVC), label: deal.label });
      this.#deps.notice(`${item.label}: Einsatz ${toVCString(fromVC(betVC))} gebucht.`);
      return deal;
    });
  }

  settle(itemId: number, stakeVC: number, engineBps: number, label: string): GameResult | null {
    return this.#run(() => {
      const pending = this.#pending.get(itemId);
      if (!pending) throw new Error('Keine offene Kartenrunde an diesem Gerät.');
      if (fromVC(stakeVC) !== pending.stake) throw new Error('Einsatz passt nicht zur offenen Kartenrunde.');
      const result = ownCardSettle(this.#deps.world(), this.#deps.ledger(), itemId, stakeVC, engineBps, label);
      this.#pending.delete(itemId);
      this.#deps.notice(`${pending.label}: ${label}${result.payout > 0 ? ` · ${toVCString(result.payout)} zurück` : ' · verloren'}.`);
      return result;
    });
  }

  additional(itemId: number, amountVC: number): boolean {
    return this.#run(() => {
      if (!this.#pending.has(itemId)) throw new Error('Keine offene Kartenrunde an diesem Gerät.');
      const item = this.#item(itemId);
      ownAdditionalBet(this.#deps.world(), this.#deps.ledger(), itemId, amountVC);
      this.#deps.notice(`${item.label}: Zusatz-Einsatz ${toVCString(fromVC(amountVC))} gebucht.`);
      return true;
    }) ?? false;
  }

  risk(itemId: number, color: RiskColor, stakeVC: number): RiskOutcome | null {
    return this.#run(() => {
      const item = this.#item(itemId);
      const result = ownRisk(this.#deps.world(), this.#deps.ledger(), itemId, stakeVC, color, this.#deps.prng());
      this.#deps.notice(`${item.label}: Risiko-Karte ${result.won ? 'gewonnen' : 'verloren'}.`);
      return result;
    });
  }

  #item(itemId: number) {
    const item = furnitureById(this.#deps.world(), itemId);
    if (!item?.gameId) throw new Error('Dieses Gerät hat kein Spiel.');
    return item;
  }

  #run<T>(action: () => T): T | null {
    try {
      const result = action();
      this.#deps.emit(true);
      return result;
    } catch (error) {
      this.#deps.notice(error instanceof Error ? error.message : 'Eigene Spielrunde fehlgeschlagen.');
      this.#deps.emit(false);
      return null;
    }
  }
}
