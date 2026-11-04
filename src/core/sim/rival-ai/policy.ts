/**
 * Reine Rivalen-Politik: gleiche Eingabe, gleiche Absicht.
 *
 * Kein PRNG, keine Weltmutation, kein Zugriff auf Zufall oder Zeit. Damit ist
 * jede Rivalenhandlung reproduzierbar und im Nachhinein aus den Eingaben erklaerbar.
 */
import { RIVAL_AI_LIMITS, type RivalActionId, type RivalStance } from './types';

export interface RivalPolicyInput {
  readonly tick: number;
  readonly stance: RivalStance;
  readonly capacity: number;
  readonly goodwill: number;
  readonly nextActionTick: number;
  readonly counteredUntilTick: number;
  readonly rivalReputation: number;
  readonly playerReputation: number;
  readonly guestsServed: number;
  readonly evidenceCount: number;
  /** Summe der letzten Rivalenbegegnungen; positiv = das Spielerhaus hat gewonnen. */
  readonly recentNetToHouse: number;
  /** Bestes unbeschaedigtes Geraet des Spielers; null = kein Ziel vorhanden. */
  readonly machineId: number | null;
}

export interface RivalActionPlan {
  readonly action: RivalActionId;
  readonly stance: RivalStance;
  readonly note: string;
  readonly machineId: number | null;
  readonly capacityDelta: number;
  readonly goodwillDelta: number;
  readonly nextActionTick: number;
}

const PROBE_PAUSE = 120;

function plan(
  action: RivalActionId,
  stance: RivalStance,
  note: string,
  tick: number,
  capacityDelta: number,
  goodwillDelta: number,
  machineId: number | null = null,
  pause = RIVAL_AI_LIMITS.cadence,
): RivalActionPlan {
  return { action, stance, note, machineId, capacityDelta, goodwillDelta, nextActionTick: tick + pause };
}

/**
 * Reihenfolge der Regeln ist die Prioritaet:
 * 1. Zu schwach -> Kraefte sammeln.
 * 2. Wohlwollend -> Informationshandel.
 * 3. Rechnung offen oder Wiederholungstaeter -> Sabotage am besten Geraet.
 * 4. Spieler zieht davon -> Preiskampf.
 * 5. Laufendes Haus -> Gaeste abwerben.
 * 6. Sonst: beobachten.
 */
export function decideRivalAction(input: RivalPolicyInput): RivalActionPlan | null {
  const { tick, capacity } = input;
  if (!Number.isSafeInteger(tick) || tick < RIVAL_AI_LIMITS.firstActionTick) return null;
  if (tick < input.nextActionTick || tick < input.counteredUntilTick) return null;
  if (capacity < 30) {
    return plan('PROBE', input.stance, 'Der Rivale sammelt Kraefte.', tick, 10, 0, null, PROBE_PAUSE);
  }
  if (input.goodwill >= 25 && capacity >= 45) {
    return plan('TRADE_INFO', 'COOPERATIVE', 'Der Rivale teilt Informationen.', tick, -8, 5);
  }
  const grudge = input.recentNetToHouse > 0;
  if (input.machineId !== null && capacity >= 60 && (grudge || input.evidenceCount >= 2)) {
    return plan('SABOTAGE', 'HOSTILE', 'Der Rivale schickt einen Saboteur.', tick, -25, -5, input.machineId);
  }
  if (capacity >= 40 && input.playerReputation >= input.rivalReputation + 10) {
    return plan('PRICE_MOVE', 'COMPETITIVE', 'Der Rivale unterbietet die Preise.', tick, -12, -2);
  }
  if (capacity >= 45 && input.guestsServed >= 20 && input.playerReputation > 0) {
    return plan('POACH_VISITOR', 'COMPETITIVE', 'Der Rivale wirbt Gaeste ab.', tick, -15, -3);
  }
  return plan('PROBE', input.stance, 'Der Rivale beobachtet das Haus.', tick, 8, 0, null, PROBE_PAUSE);
}
