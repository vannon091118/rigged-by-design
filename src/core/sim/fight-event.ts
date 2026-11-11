/**
 * Kampfabend im vorhandenen Turnierabend.
 *
 * Der Abend ist keine zweite Veranstaltung: Roster und Kampfplan kommen aus der
 * bestehenden Hinterhof-Leiter, der Kampf laeuft durch dieselbe Mechanik wie
 * Duell und Hinterhof, Geld ausschliesslich ueber den Ledger. Ist der Kampf
 * entschieden, wird die vorhandene `TURNIER_ABEND`-Instanz ueber ihre eigene
 * Lifecycle-API aufgeloest; ein neues Save-Feld gibt es nicht.
 */
import type { Ledger } from '../economy/ledger';
import { toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { crowdBonus } from './brawl-combat';
import { fightBout, fightChance, fightNextRung, fightRoster, fightXpFor } from './fight-career';
import {
  backyardHistoryOf, fightEventSubject, fightRecordOf, type FightRecord,
} from './fight-history';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { advanceEventStep, transitionEvent } from './narrative/event-lifecycle';
import { grantGlobalXp, isInjured } from './player-rpg';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { venueView } from './venue-event';

interface FightEventBout {
  readonly rank: number;
  readonly name: string;
  readonly archetype: string;
  readonly strength: number;
  readonly toughness: number;
  readonly entryFee: VaCoinMicro;
  readonly prize: VaCoinMicro;
  readonly winChance: number;
  readonly beaten: boolean;
}

export interface FightEventView {
  /** Nur ein Turnierabend in Einlass oder Durchfuehrung ist buchbar. */
  readonly open: boolean;
  readonly phase: 'ADMISSION' | 'RUNNING' | 'CLOSED';
  readonly ticksLeft: number;
  readonly ready: boolean;
  readonly reason: string;
  /** Die ganze Leiter als Roster; `main` ist der naechste offene Kampf. */
  readonly roster: readonly FightEventBout[];
  readonly main: FightEventBout;
  readonly crowd: number;
  readonly crowdBonus: number;
  readonly record: FightRecord;
}

interface FightEventResult {
  readonly won: boolean;
  readonly ko: boolean;
  readonly fee: VaCoinMicro;
  readonly prize: VaCoinMicro;
  readonly notice: string;
}

const OPEN_PHASES: readonly string[] = ['ADMISSION', 'RUNNING'];
const TOURNAMENT = 'TURNIER_ABEND';
const PHASE_LABEL: Readonly<Record<'ADMISSION' | 'RUNNING', string>> = {
  ADMISSION: 'Einlass',
  RUNNING: 'Durchfuehrung',
};

type OpenPhase = 'ADMISSION' | 'RUNNING';

/** Der laufende Turnierabend, aber nur in den Phasen mit angesetztem Kampf. */
function openTournament(world: WorldState): { readonly id: number; readonly phase: OpenPhase; readonly ticksLeft: number } | null {
  const current = venueView(world).current;
  if (!current || current.kind !== TOURNAMENT || !OPEN_PHASES.includes(current.phase)) return null;
  return { id: current.id, phase: current.phase as OpenPhase, ticksLeft: current.ticksLeft };
}

/** Roster, Kampfplan, Nenngeld, Preisgeld und Zuschauer als eine Sicht. */
export function fightEventView(world: WorldState, wallet: VaCoinMicro): FightEventView {
  const history = backyardHistoryOf(world.archive);
  const beaten = new Set(history.filter((entry) => entry.wins > 0).map((entry) => entry.name));
  const bonus = crowdBonus(world.guests);
  const roster = fightRoster().map((rung) => ({
    rank: rung.rank,
    name: rung.name,
    archetype: rung.archetype,
    strength: rung.strength,
    toughness: rung.toughness,
    entryFee: rung.entryFee,
    prize: rung.prize,
    winChance: fightChance(world.player.rpg, rung, bonus),
    beaten: beaten.has(rung.name),
  }));
  const rung = fightNextRung(history);
  const main = roster.find((bout) => bout.name === rung.name) ?? roster[0]!;
  const live = openTournament(world);
  const injured = isInjured(world.player.rpg);
  const affordable = wallet >= rung.entryFee;
  const ready = live !== null && !injured && affordable;
  const reason = live === null
    ? 'Kein Turnierabend im Einlass: Der Kampfabend laeuft nur waehrend des Turnierabends.'
    : injured
      ? `Verletzt: noch ${world.player.rpg.injuryTicks} Ticks, kein Kampf.`
      : !affordable
        ? `Nenngeld fehlt: ${toVCString((rung.entryFee - wallet) as VaCoinMicro)}.`
        : `${PHASE_LABEL[live.phase]} · Nenngeld ${toVCString(rung.entryFee)} · Preisgeld ${toVCString(rung.prize)} · ${world.guests.length} Zuschauer.`;
  return {
    open: live !== null,
    phase: live?.phase ?? 'CLOSED',
    ticksLeft: live?.ticksLeft ?? 0,
    ready,
    reason,
    roster,
    main,
    crowd: world.guests.length,
    crowdBonus: bonus,
    record: fightRecordOf(world.archive),
  };
}

/**
 * Bucht den naechsten Kampf des Abends und loest den vorhandenen Turnierabend
 * ueber Step und Status auf. Ein Event ohne Einlass nimmt keine Nennung an.
 */
export function enterFightEvent(world: WorldState, ledger: Ledger, prng: Prng): FightEventResult {
  const view = fightEventView(world, ledger.getBalance(PORTEMONNAIE));
  const live = openTournament(world);
  if (!live || !view.ready) throw new Error(view.reason);
  const rung = fightNextRung(backyardHistoryOf(world.archive));
  ledger.transfer(PORTEMONNAIE, EXTERNAL, rung.entryFee, TX_REASON.FIGHT_EVENT_ENTRY, world.tick);
  const bout = fightBout(world, prng, rung, view.crowdBonus);
  let prize: VaCoinMicro = ZERO_VC;
  if (bout.won) {
    prize = rung.prize;
    ledger.transfer(EXTERNAL, PORTEMONNAIE, prize, TX_REASON.FIGHT_EVENT_PRIZE, world.tick);
    grantGlobalXp(world.player.rpg, 'WIN_BRAWL', fightXpFor(rung));
  }
  const outcome = `${bout.won ? 'Gewonnen' : 'Verloren'}: ${bout.ko ? 'KO' : 'nach Punkten'} in Runde ${bout.fight.rounds}`;
  const money = bout.won ? `Preisgeld ${toVCString(prize)}` : `Nenngeld ${toVCString(rung.entryFee)} verloren`;
  const notice = `${outcome} beim Kampfabend gegen ${rung.name} · ${money}.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: fightEventSubject(rung.name),
    cause: `${rung.archetype} · Rang ${rung.rank}/${view.roster.length} · Nenngeld ${toVCString(rung.entryFee)} · ${view.crowd} Zuschauer`,
    effect: `${outcome} · ${money}.`,
    amount: bout.won ? prize : rung.entryFee,
  });
  advanceEventStep(world, live.id, 'RESULT', world.tick);
  transitionEvent(world, live.id, 'RESOLVED', world.tick, `Kampfabend: ${outcome} gegen ${rung.name} vor ${view.crowd} Zuschauern.`);
  world.lastEvent = notice;
  return { won: bout.won, ko: bout.ko, fee: rung.entryFee, prize, notice };
}
