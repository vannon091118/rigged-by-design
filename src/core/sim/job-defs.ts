/**
 * Definitionen und Stellschrauben der vier Spielerjobs.
 *
 * Eigene Datei, damit `player-jobs.ts` im Logik-Budget bleibt: Hier stehen nur
 * Daten, dort steht der Ablauf. Die Werte sind dieselben wie zuvor; Lohn, Dauer
 * und Skill-Zuordnung werden von Karriere und Bewertung mitgelesen.
 */
import type { PlayerJobId, RivalId } from './types';

const TICKS_PER_TASK = { CLEANER: 30, BARTENDER: 45, CARD_DEALER: 60, MECHANIC: 90 } as const;
const QUEUE_CAPACITY = { CLEANER: 3, BARTENDER: 2, CARD_DEALER: 1, MECHANIC: 2 } as const;
const XP_PER_TASK = { CLEANER: 8, BARTENDER: 12, CARD_DEALER: 15, MECHANIC: 20 } as const;
const DAILY_WAGE_VC = { CLEANER: 3, BARTENDER: 5, CARD_DEALER: 8, MECHANIC: 12 } as const;
const INJURY_CHANCE = { CLEANER: 0, BARTENDER: 0.05, CARD_DEALER: 0, MECHANIC: 0.1 } as const;

export const JOB_XP_SOURCE: Record<PlayerJobId, string> = {
  CLEANER: 'JOB_CLEANER', BARTENDER: 'JOB_BARTENDER', CARD_DEALER: 'JOB_CARD_DEALER', MECHANIC: 'JOB_MECHANIC',
};

/** Die Fach-Skill, die eine Joblinie traegt; dieselbe Zuordnung wie beim XP-Gewinn. */
export const JOB_TO_SKILL: Record<PlayerJobId, 'cleaning' | 'service' | 'cardDealing' | 'repair'> = {
  CLEANER: 'cleaning', BARTENDER: 'service', CARD_DEALER: 'cardDealing', MECHANIC: 'repair',
};

export const JOB_DEFS: Record<PlayerJobId, {
  readonly id: PlayerJobId; readonly label: string; readonly rivalId: RivalId;
  readonly dailyWageVC: number; readonly baseXpPerTask: number; readonly xpSourceKey: string;
  readonly injuryChance: number; readonly taskDurationTicks: number;
  readonly queueCapacity: number; readonly description: string;
}> = {
  CLEANER: { id: 'CLEANER', label: 'Reinigungskraft', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.CLEANER, baseXpPerTask: XP_PER_TASK.CLEANER,
    xpSourceKey: JOB_XP_SOURCE.CLEANER, injuryChance: INJURY_CHANCE.CLEANER,
    taskDurationTicks: TICKS_PER_TASK.CLEANER, queueCapacity: QUEUE_CAPACITY.CLEANER,
    description: 'Flecken entfernen, Gäste begrüßen. Trainiert: Wahrnehmung, Speed, Ausdauer.' },
  BARTENDER: { id: 'BARTENDER', label: 'Barkeeper', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.BARTENDER, baseXpPerTask: XP_PER_TASK.BARTENDER,
    xpSourceKey: JOB_XP_SOURCE.BARTENDER, injuryChance: INJURY_CHANCE.BARTENDER,
    taskDurationTicks: TICKS_PER_TASK.BARTENDER, queueCapacity: QUEUE_CAPACITY.BARTENDER,
    description: 'Drinks zapfen, Streit schlichten. Trainiert: Charisma, Brawl, Wahrnehmung, Ausdauer.' },
  CARD_DEALER: { id: 'CARD_DEALER', label: 'Croupier', rivalId: 'GOLDENE_HAND',
    dailyWageVC: DAILY_WAGE_VC.CARD_DEALER, baseXpPerTask: XP_PER_TASK.CARD_DEALER,
    xpSourceKey: JOB_XP_SOURCE.CARD_DEALER, injuryChance: INJURY_CHANCE.CARD_DEALER,
    taskDurationTicks: TICKS_PER_TASK.CARD_DEALER, queueCapacity: QUEUE_CAPACITY.CARD_DEALER,
    description: 'Karten geben, Wetten managen. Trainiert: Technik, Speed, Glück, Wahrnehmung.' },
  MECHANIC: { id: 'MECHANIC', label: 'Automaten-Mechaniker', rivalId: 'NEBELPALAST',
    dailyWageVC: DAILY_WAGE_VC.MECHANIC, baseXpPerTask: XP_PER_TASK.MECHANIC,
    xpSourceKey: JOB_XP_SOURCE.MECHANIC, injuryChance: INJURY_CHANCE.MECHANIC,
    taskDurationTicks: TICKS_PER_TASK.MECHANIC, queueCapacity: QUEUE_CAPACITY.MECHANIC,
    description: 'Automaten reparieren, Hochspannung. Trainiert: Technik, Brawl, Ausdauer, Wahrnehmung.' },
};
