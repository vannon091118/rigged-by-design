/** Blackjack-Fenster: der Spieler entscheidet Zug für Zug, inklusive Split, Versicherung und Aufgeben. */
import { useRef, useState } from 'react';
import type { GameResult } from '../../core/games/contracts';
import {
  DEFAULT_BLACKJACK_RULES, doubleBlackjack, handTotal, hitBlackjack, insuranceBlackjack,
  normalizeBlackjackRules, splitBlackjack, standBlackjack, startBlackjack, surrenderBlackjack,
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
  readonly onDeal: (stakeVC: number, bps: number) => CardDeal | null;
  readonly onSettle: (stakeVC: number, netBps: number, label: string) => GameResult | null;
}

const DECKS: readonly number[] = [1, 2, 4, 6];

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
  const stake = fromVC(bet);
  const canPay = canAfford(props.wallets.wallet, stake);
  const canDouble = canAfford(props.wallets.wallet, fromVC(bet * 2));
  const activeHand = round?.hands[round.active ?? 0] ?? null;
  const canSplit = Boolean(playing && rules.allowSplit && round && round.hands.length < rules.maxHands
    && activeHand && activeHand.cards.length === 2
    && handTotal([activeHand.cards[0]!]) === handTotal([activeHand.cards[1]!]));
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
    const dealResult = props.onDeal(bet * 1, rules.blackjackBps); // base bet, blackjack payout BPS
    if (!dealResult) return;
    shoe.current = createCardShoe(dealResult.seed, rules.decks);
    setResult(null);
    commit(startBlackjack(shoe.current, 1, rules, rules.sideBetBps > 0));
  };

  const act = (kind: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER'): void => {
    if (!round || !shoe.current || round.phase !== 'PLAYER') return;
    if (kind === 'HIT') commit(hitBlackjack(round, shoe.current));
    else if (kind === 'STAND') commit(standBlackjack(round, shoe.current));
    else if (kind === 'DOUBLE') commit(doubleBlackjack(round, shoe.current));
    else if (kind === 'SPLIT') commit(splitBlackjack(round, shoe.current));
    else commit(surrenderBlackjack(round));
  };

  const insure = (take: boolean): void => {
    if (!round || !shoe.current) return;
    commit(insuranceBlackjack(round, shoe.current, take));
  };

  const setRule = (patch: Partial<BlackjackRules>): void => setRules((current) => normalizeBlackjackRules({ ...current, ...patch }));

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

      {round?.insuranceOffered ? (
        <div className="table-actions">
          <button type="button" className="btn primary" onClick={() => insure(true)}>VERSICHERUNG NEHMEN</button>
          <button type="button" className="btn" onClick={() => insure(false)}>OHNE WEITER</button>
        </div>
      ) : (
        <div className="table-actions">
          <button type="button" className="btn primary" disabled={!playing} onClick={() => act('HIT')}>KARTE ZIEHEN</button>
          <button type="button" className="btn" disabled={!playing} onClick={() => act('STAND')}>HALTEN</button>
          <button type="button" className="btn" disabled={!playing || activeHand?.cards.length !== 2 || !canDouble}
            onClick={() => act('DOUBLE')}
            title="Doppelter Einsatz, genau eine Karte, danach zieht der Dealer.">VERDOPPELN</button>
          <button type="button" className="btn" disabled={!canSplit} onClick={() => act('SPLIT')}
            title="Zwei gleiche Ränge werden zu zwei Händen mit eigenem Einsatz.">SPLIT</button>
          <button type="button" className="btn ghost" disabled={!canSurrender} onClick={() => act('SURRENDER')}
            title="Halber Einsatz zurück, bevor die erste Karte fällt.">AUFGEBEN</button>
        </div>
      )}

      <div className="bet-row">
        {bets.map((value) => (
          <button key={value} type="button" className={`chip${bet === value ? ' active' : ''}`} disabled={playing} onClick={() => setBet(value)}>
            {value} VC
          </button>
        ))}
      </div>

      <div className="blackjack-rules" aria-label="Tischregeln">
        <span className="eyebrow">TISCHREGELN</span>
        <div className="bet-row">
          {DECKS.map((decks) => (
            <button key={decks} type="button" className={`chip${rules.decks === decks ? ' active' : ''}`}
              disabled={playing} onClick={() => setRule({ decks })}>{decks} Deck{decks > 1 ? 's' : ''}</button>
          ))}
        </div>
        <div className="bet-row">
          <button type="button" className={`chip${!rules.dealerHitsSoft17 ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ dealerHitsSoft17: false })} title="Dealer hält weiche 17.">S17</button>
          <button type="button" className={`chip${rules.dealerHitsSoft17 ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ dealerHitsSoft17: true })} title="Dealer zieht auf weiche 17.">H17</button>
          <button type="button" className={`chip${rules.blackjackBps === 25_000 ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ blackjackBps: 25_000 })}>Blackjack 3:2</button>
          <button type="button" className={`chip${rules.blackjackBps === 22_000 ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ blackjackBps: 22_000 })}>6:5</button>
        </div>
        <div className="bet-row">
          <button type="button" className={`chip${rules.allowSplit ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ allowSplit: !rules.allowSplit })}>Split</button>
          <button type="button" className={`chip${rules.allowInsurance ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ allowInsurance: !rules.allowInsurance })}>Versicherung</button>
          <button type="button" className={`chip${rules.allowSurrender ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ allowSurrender: !rules.allowSurrender })}>Aufgeben</button>
          <button type="button" className={`chip${rules.sideBetBps > 0 ? ' active' : ''}`} disabled={playing}
            onClick={() => setRule({ sideBetBps: rules.sideBetBps > 0 ? 0 : 120_000 })}
            title="Paar-Wette: 1 Einheit extra, zahlt 11:1 auf ein Paar.">Paar-Wette</button>
        </div>
      </div>

      <button type="button" className="btn primary big" disabled={playing || !canPay} onClick={deal}>
        {playing ? 'HAND LÄUFT' : canPay ? `AUSTEILEN · ${bet} VC` : 'ZU WENIG BARGELD'}
      </button>
      <small className="hint">
        {rules.dealerHitsSoft17 ? 'H17: Der Dealer zieht auf weiche 17.' : 'S17: Der Dealer hält weiche 17.'}
        {' '}Blackjack zahlt {rules.blackjackBps === 25_000 ? '3:2' : '6:5'}. {rules.decks} Deck(s) im Schuh.
      </small>
    </section>
  );
}
