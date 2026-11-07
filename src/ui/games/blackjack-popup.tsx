/** Blackjack-Fenster: der Spieler entscheidet Zug für Zug, inklusive Split, Versicherung und Aufgeben. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import {
  DEFAULT_BLACKJACK_RULES, handTotal, hitBlackjack, insuranceBlackjack,
  normalizeBlackjackRules, splitBlackjack, standBlackjack, startBlackjack, surrenderBlackjack,
  doubleBlackjack,
  type BlackjackRound, type BlackjackRules,
} from '../../core/games/engines/blackjack';
import { createCardShoe } from '../../core/games/engines/interactive-cards';
import type { CardShoe } from '../../core/rng/shoe';
import { canAfford, fromVC, type VaCoinMicro } from '../../core/economy/vacoin';
import { BlackjackStage, type BlackjackStageHandle } from '../../render/games/blackjack-stage';
import type { CardDeal } from '../../store/foreign-play';
import { playSfx } from '../../render/sound-fx';
import { CasinoWindowHeader } from '../casino-window-header';
import { vc } from '../format';
import { BlackjackRulesEditor } from './blackjack-rules-editor';
import { BlackjackTableActions } from './blackjack-table-actions';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly wallets: { readonly wallet: VaCoinMicro; readonly house: VaCoinMicro };
  readonly mods: readonly string[];
  readonly pact: string;
  readonly bets: readonly number[];
  readonly canPay: boolean;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw?: () => void;
  readonly canWithdraw?: boolean;
  readonly onDeal: (stakeVC: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, engineBps: number, label: string) => GameResult | null;
  /** Bucht einen weiteren Einsatz (Double, Split, Versicherung) und meldet Erfolg. */
  readonly onAdditionalBet: (additionalVC: number) => boolean;
}

export function BlackjackPopup(props: Props) {
  const { bets } = props;
  const stage = useRef<BlackjackStageHandle>(null);
  const shoe = useRef<CardShoe | null>(null);
  const [bet, setBet] = useState(bets[0] ?? 1);
  const [rules, setRules] = useState<BlackjackRules>(DEFAULT_BLACKJACK_RULES);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const roundActive = round?.phase === 'PLAYER'; // includes insurance phase
  const playing = roundActive && !round?.insuranceOffered; // player may act only outside insurance
  const sideBet = rules.sideBetBps > 0;
  const dealStake = sideBet ? bet * 2 : bet;
  const canPay = canAfford(props.wallets.wallet, fromVC(dealStake));
  const activeHand = round?.hands[round.active ?? 0] ?? null;
  const extraStake = bet * (activeHand?.units ?? 1);
  // Der Grundeinsatz ist bereits gebucht; Double braucht nur noch einen weiteren Einsatz.
  const canDouble = canAfford(props.wallets.wallet, fromVC(extraStake));
  const canSplit = Boolean(playing && rules.allowSplit && round && round.hands.length < rules.maxHands
    && activeHand && activeHand.cards.length === 2
    && handTotal([activeHand.cards[0]!]) === handTotal([activeHand.cards[1]!])
    && canAfford(props.wallets.wallet, fromVC(extraStake)));
  const canSurrender = Boolean(playing && rules.allowSurrender && round && round.hands.length === 1
    && activeHand && activeHand.cards.length === 2);

  const commit = (next: BlackjackRound): void => {
    setRound(next);
    playSfx('cardFlip');
    stage.current?.render(next);
    if (next.phase === 'DONE') setResult(props.onSettle(bet * next.units, next.multiplierBps, next.label));
  };

  const deal = (): void => {
    if (playing || !canPay) return;
    const dealResult = props.onDeal(dealStake);
    if (!dealResult) return;
    shoe.current = createCardShoe(dealResult.seed, rules.decks);
    setResult(null);
    commit(startBlackjack(shoe.current, 1, rules, sideBet));
  };

  const act = (kind: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER'): void => {
    if (!round || !shoe.current || round.phase !== 'PLAYER') return;
    if (kind === 'HIT') commit(hitBlackjack(round, shoe.current));
    else if (kind === 'STAND') commit(standBlackjack(round, shoe.current));
    else if (kind === 'DOUBLE') {
      if (!props.onAdditionalBet(extraStake)) return;
      commit(doubleBlackjack(round, shoe.current));
    } else if (kind === 'SPLIT') {
      if (!props.onAdditionalBet(extraStake)) return;
      commit(splitBlackjack(round, shoe.current));
    } else commit(surrenderBlackjack(round));
  };

  const insure = (take: boolean): void => {
    if (!round || !shoe.current) return;
    if (take && !props.onAdditionalBet(bet / 2)) return;
    commit(insuranceBlackjack(round, shoe.current, take));
  };


  const narration = (): string => {
    if (round?.insuranceOffered) return 'Der Dealer zeigt ein Ass. Versicherung kostet den halben Einsatz und zahlt 2:1, wenn er Blackjack hat.';
    if (playing && round) return `Du hast ${round.player.length ? handTotal(round.player) : 0}. ${round.hands.length > 1 ? `Hand ${round.active + 1} von ${round.hands.length}.` : 'Der Dealer zeigt eine Karte.'}`;
    if (result) return `${round?.label ?? ''} · ${result.payout > 0 ? vc(result.payout, 2) : 'Einsatz weg'}`;
    if (round) return round.label;
    return 'Einsatz wählen und austeilen. Split, Versicherung und Aufgeben sind Tischregeln, keine Automatik.';
  };

  return (
    <section className="slot-window" aria-label={`${props.title} · Blackjack`}>
      <CasinoWindowHeader
        wallet={props.wallets.wallet}
        house={props.wallets.house}
        mods={props.mods}
        pact={props.pact}
        full={props.full}
        onToggleFull={props.onToggleFull}
        onWithdraw={props.onWithdraw}
        canWithdraw={props.canWithdraw}
      />
      <div className="slot-window-title">
        <div>
          <span className="eyebrow">AM TISCH</span>
          <strong>{props.title}</strong>
        </div>
        <p>{props.subtitle}</p>
      </div>

      <BlackjackStage ref={stage} label={`Blackjack-Tisch ${props.title}`} />
      <p className="slot-narration" aria-live="polite">{narration()}</p>

      {round && round.hands.length > 1 && (
        <div className="blackjack-hands" aria-label="Hände">
          {round.hands.map((hand, index) => (
            <span key={index} className={`chip${index === round.active && round.phase === 'PLAYER' ? ' active' : ''}`}>
              {index + 1}: {handTotal(hand.cards)}{hand.done ? ' · fertig' : ''}
            </span>
          ))}
        </div>
      )}

      <BlackjackTableActions
        round={round}
        activeHand={activeHand}
        canDouble={canDouble}
        canSplit={canSplit}
        canSurrender={canSurrender}
        playing={playing}
        onAct={act}
        onInsure={insure}
      />

      <div className="bet-row">
        {bets.map((value) => (
          <button key={value} type="button" className={`chip${bet === value ? ' active' : ''}`} disabled={playing} onClick={() => setBet(value)}>
            {value} VC
          </button>
        ))}
      </div>

      <BlackjackRulesEditor rules={rules} onChange={(patch) => setRules((current) => normalizeBlackjackRules({ ...current, ...patch }))} disabled={playing} />

      <button type="button" className="btn primary big" disabled={roundActive || !canPay} onClick={deal}>
        {roundActive ? 'HAND LÄUFT' : canPay ? `AUSTEILEN · ${dealStake} VC` : 'ZU WENIG BARGELD'}
      </button>
      <small className="hint">
        {rules.dealerHitsSoft17 ? 'H17: Der Dealer zieht auf weiche 17.' : 'S17: Der Dealer hält weiche 17.'}
        {' '}Blackjack zahlt {rules.blackjackBps === 25_000 ? '3:2' : '6:5'}. {rules.decks} Deck(s) im Schuh.
      </small>
    </section>
  );
}
