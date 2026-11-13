/**
 * @module city-life-score — reiner Entscheidungs-Score der Stadt-NPCs
 *
 * Jede Alternative wird aus denselben Faktoren bewertet: Tagesplan,
 * Beduerfnisse, Traits, Attribute, Faehigkeiten, Beziehung, Erinnerung und
 * Umgebung. Der Score ist deterministisch; der Seed bricht nur nahe
 * Gleichstaende. Die Gegenfakt-Proben liegen in `city-life-decision.ts`.
 */
import { traitEffect } from './city-traits';
import { bestFriend, locationForIntent, memoryAbout, presentAt } from './city-life-targets';
import {
  CLOSED_PENALTY, URGENT_NEED_VETO, isClosedAt, urgentNeedVeto, vetoesIntent,
} from './city-life-override';
import { seedTilt } from './city-life-tiebreak';
import type {
  CityDecisionAlternative, CityDecisionFactor, CityDecisionFamily, CityLifePlace,
  CityResidentState,
} from './city-life-types';
import type { NpcIntentKind } from './npc-types';
import type { TraitState } from './city-types';

export interface CityDecisionInput {
  readonly resident: CityResidentState;
  readonly scheduled: NpcIntentKind;
  readonly workplace: CityLifePlace;
  readonly hour: number;
  readonly day: number;
  readonly tick: number;
  readonly peers: readonly CityResidentState[];
  readonly traits: readonly TraitState[];
  readonly seed: number;
}

export interface CityChoice {
  readonly intent: NpcIntentKind;
  readonly location: CityLifePlace;
  readonly target: CityResidentState | null;
  readonly score: number;
  readonly alternatives: readonly CityDecisionAlternative[];
  readonly factors: readonly CityDecisionFactor[];
}

const ORDER: readonly NpcIntentKind[] = [
  'SLEEP', 'EAT_HOME', 'EAT_OUT', 'WORK', 'PUB', 'VISIT_FRIEND',
  'LEISURE', 'SHOP', 'COMMUTE', 'WAKE_UP', 'IDLE',
];

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Bewertet genau eine Alternative; jede Wirkung landet im Trace. */
export function scoreIntent(input: CityDecisionInput, intent: NpcIntentKind): CityChoice {
  const { resident, scheduled, hour, seed, tick } = input;
  const { needs, attributes, skills } = resident;
  const share = traitEffect(input.traits, 'share');
  const gain = traitEffect(input.traits, 'gain');
  const friend = intent === 'VISIT_FRIEND' ? bestFriend(input) : null;
  const target = friend?.peer ?? null;
  const location = locationForIntent(intent, input.workplace, target);
  const present = presentAt(input.peers, location, resident.npcId);
  const factors: CityDecisionFactor[] = [];
  let score = 0;
  const add = (family: CityDecisionFamily, detail: string, value: number | string, delta: number): void => {
    if (Math.abs(delta) < 0.001) return;
    score += delta;
    factors.push({ family, detail, value, delta: round2(delta) });
  };

  const veto = urgentNeedVeto(needs);
  if (vetoesIntent(veto, intent) && veto) {
    add(veto.family, `Beduerfnis-Override ${veto.intent}`, veto.intent, -URGENT_NEED_VETO);
  }
  if (isClosedAt(intent, hour, { npcId: resident.npcId, workplace: input.workplace })) {
    add('environment', `${intent} geschlossen (Stunde ${hour})`, hour, -CLOSED_PENALTY);
  }
  if (intent === scheduled) add('routine', `Plan ${scheduled}`, scheduled, 60);
  if (scheduled === 'PUB' && intent === 'VISIT_FRIEND' && friend && target) {
    const pubPlace = locationForIntent('PUB', input.workplace, null);
    if (target.location !== pubPlace) {
      add('routine', 'soziale Variante des Abendplans', 'PUB', 18);
    }
  }
  if (intent === 'SLEEP') {
    add('fatigue', `Muedigkeit ${needs.fatigue}`, needs.fatigue,
      Math.min(55, Math.max(0, needs.fatigue - 35) * 1.4) + (hour >= 22 ? 10 : 0)
      + (needs.fatigue >= 80 ? 15 : 0));
    if (needs.social >= 80) add('emotion', `sozialer Druck ${needs.social}`, needs.social, -5);
  }
  if (intent === 'EAT_HOME' || intent === 'EAT_OUT') {
    add('hunger', `Hunger ${needs.hunger}`, needs.hunger,
      Math.min(45, Math.max(0, needs.hunger - 20) * 0.9) + (needs.hunger >= 70 ? 15 : 0));
    if (intent === 'EAT_HOME') {
      add('skills', `Kochen ${skills.cooking}`, skills.cooking, skills.cooking * 1.1);
      add('attributes', `Intellekt ${attributes.intellect}`, attributes.intellect, attributes.intellect * 0.4);
      add('traits', `Sparsamkeit ${gain.toFixed(2)}`, gain, gain * 8);
      add('environment', `Bargeld ${needs.money}`, needs.money, Math.max(0, 3000 - needs.money) * 0.004);
    } else {
      add('environment', `Bargeld ${needs.money}`, needs.money,
        -Math.max(0, 6000 - needs.money) * 0.008 - (needs.money < 3000 ? 12 : 0));
      add('traits', `Verschwendung ${gain.toFixed(2)}`, gain, -gain * 8);
      add('emotion', `Laune ${needs.mood}`, needs.mood, Math.max(0, needs.mood - 60) * 0.05);
    }
  }
  if (intent === 'PUB') {
    add('thirst', `Durst ${needs.thirst}`, needs.thirst,
      Math.min(55, Math.max(0, needs.thirst - 10) * 1.2) + (needs.thirst >= 70 ? 15 : 0));
    add('social', `Sozialbedarf ${needs.social}`, needs.social, Math.min(40, Math.max(0, needs.social - 30) * 0.8));
    add('emotion', `Laune ${needs.mood}`, needs.mood, Math.max(0, 55 - needs.mood) * 1.2);
    add('traits', `Redseligkeit ${share.toFixed(2)}`, share, share * 25);
    add('attributes', `Charisma ${attributes.charisma}`, attributes.charisma, attributes.charisma * 1.2);
    add('skills', `Soziale Faehigkeit ${skills.social}`, skills.social, skills.social * 0.7);
    add('environment', `Anwesende ${present.length}`, present.length, present.length * 2);
    add('environment', `Bargeld ${needs.money}`, needs.money, -Math.max(0, 5000 - needs.money) * 0.006);
    if (hour < 7) add('environment', `Nachtstunde ${hour}`, hour, -50);
  }
  if (intent === 'VISIT_FRIEND') {
    if (hour < 16 || hour > 23) add('environment', `soziales Zeitfenster ${hour}`, hour, -100);
    if (!friend) add('relationship', 'keine nahe Person', 0, -50);
    else {
      add('relationship', `${friend.peer.name} Beziehung ${friend.relation}`, friend.relation, Math.min(30, friend.relation * 0.6));
      const memory = memoryAbout(resident, friend.peer.npcId);
      add('memory', memory ? `${memory.kind} ueber ${friend.peer.name}` : 'keine Erinnerung',
        memory?.id ?? 'keine', memory ? memory.sentiment * 16 : 0);
      add('traits', `Redseligkeit ${share.toFixed(2)}`, share, share * 25);
      add('attributes', `Charisma ${attributes.charisma}`, attributes.charisma, attributes.charisma * 1.2);
      add('skills', `Soziale Faehigkeit ${skills.social}`, skills.social, skills.social * 0.7);
      add('environment', `Anwesend ${friend.peer.npcId}`, friend.peer.npcId, 6);
      if (hour < 7) add('environment', `Nachtstunde ${hour}`, hour, -50);
    }
    add('social', `Sozialbedarf ${needs.social}`, needs.social, Math.min(40, Math.max(0, needs.social - 30) * 0.8));
    add('emotion', `Laune ${needs.mood}`, needs.mood, Math.max(0, 55 - needs.mood) * 1.2);
  }
  if (intent === 'WORK') {
    add('skills', `Arbeitsfaehigkeit ${skills.work}`, skills.work, skills.work * 0.9);
    add('attributes', `Intellekt ${attributes.intellect}`, attributes.intellect, attributes.intellect * 1.2);
    add('environment', `Bargeld ${needs.money}`, needs.money, Math.max(0, 5000 - needs.money) * 0.008);
    add('fatigue', `Muedigkeit ${needs.fatigue}`, needs.fatigue, -Math.max(0, needs.fatigue - 55) * 0.5);
    add('traits', `Erwerbssinn ${gain.toFixed(2)}`, gain, gain * 6);
    add('emotion', `Laune ${needs.mood}`, needs.mood, -Math.max(0, 55 - needs.mood) * 2);
  }
  if (intent === 'LEISURE') {
    add('emotion', `Laune ${needs.mood}`, needs.mood, Math.max(0, 40 - needs.mood) * 0.5);
    add('fatigue', `Muedigkeit ${needs.fatigue}`, needs.fatigue, -Math.max(0, needs.fatigue - 60) * 0.25);
  }
  if (intent === 'SHOP') add('environment', `Bargeld ${needs.money}`, needs.money, -Math.max(0, 4000 - needs.money) * 0.004);
  const tilt = seedTilt(seed, resident.npcId, tick);
  score += tilt;
  if (tilt !== 0) factors.push({ family: 'environment', detail: `Seed ${seed} Tie-Break`, value: seed, delta: tilt });
  return { intent, location, target, score: round2(score), alternatives: [], factors };
}

/** Waehlt die beste Alternative; die Reihenfolge ist bei Gleichstand stabil. */
export function chooseCityIntent(input: CityDecisionInput): CityChoice {
  const scored = ORDER.map((intent) => scoreIntent(input, intent));
  const alternatives = [...scored]
    .sort((a, b) => b.score - a.score || ORDER.indexOf(a.intent) - ORDER.indexOf(b.intent))
    .slice(0, 5)
    .map((entry) => ({ intent: entry.intent, score: entry.score }));
  const best = scored.reduce((winner, entry) => {
    if (entry.score > winner.score) return entry;
    if (entry.score === winner.score && ORDER.indexOf(entry.intent) < ORDER.indexOf(winner.intent)) return entry;
    return winner;
  });
  return { ...best, alternatives };
}
