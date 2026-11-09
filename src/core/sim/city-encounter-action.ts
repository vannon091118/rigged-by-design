/**
 * Die soziale Handlung: Deckung pruefen, Command ausfuehren (Beziehung/Flag),
 * Geld aus dem Portemonnaie buchen, Erinnerung und Wissen schreiben.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { clampEnergy, cityOf } from './city-model';
import { ensureCityVisitor, informantFor, npcByName, type CityNpcDef } from './city-npcs';
import { ACTION_LABEL, visitorIdOfEvent, visitorRef } from './city-encounter-dialog';
import type { CityEncounterRecord, EncounterAction } from './city-types';
import { executeChoice } from './narrative/commands/execute';
import { recordFirstHand, reportKnowledge } from './narrative/knowledge';
import { relationshipBetween } from './narrative/relationships';
import { NARRATIVE_LIMITS, type KnowledgeEntry, type VisitorMemory } from './narrative/types';
import type { WorldState } from './types';

/** Preis einer Runde; die uebrigen Handlungen kosten das eigene Glas. */
export const ENCOUNTER_GIFT = fromVC(3);
export const ENCOUNTER_SMALL = fromVC(1);
/** Eine Handlung kostet wie jede Stadtaktion eine Energie. */
export const ENCOUNTER_ENERGY = 1;
const MAX_ENCOUNTERS = 24;

export const CHOICE_OF: Readonly<Record<EncounterAction, string>> = {
  GEBEN: 'GIVE_ROUND',
  HELFEN: 'HELP_CRATE',
  ABLEHNEN: 'DECLINE_ASK',
};

const SENTIMENT_OF: Readonly<Record<EncounterAction, number>> = {
  GEBEN: 0.9,
  HELFEN: 0.8,
  ABLEHNEN: -0.7,
};

export interface EncounterResult {
  readonly action: EncounterAction;
  readonly amount: VaCoinMicro;
  readonly walletBefore: VaCoinMicro;
  readonly walletAfter: VaCoinMicro;
  readonly energyBefore: number;
  readonly energyAfter: number;
  readonly trust: number;
  readonly own: KnowledgeEntry | null;
  readonly shared: KnowledgeEntry | null;
  readonly text: string;
}

/**
 * Der zweite NPC erfaehrt es ueber die Wissenskette. Ein Bericht kann verloren
 * gehen; die Figur versucht es an diesem Abend mit anderen Worten, bis eine
 * Fassung ankommt. Der Seed ist ableitbar, also reproduzierbar.
 */
function shareWithInformant(
  world: WorldState,
  fromId: number,
  npc: CityNpcDef,
  tick: number,
  eventId: number,
): KnowledgeEntry | null {
  const informant = informantFor(npc);
  if (!informant) return null;
  const target = ensureCityVisitor(world, informant);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const made = reportKnowledge(world, {
      from: visitorRef(fromId),
      to: visitorRef(target.id),
      tick,
      seed: (eventId * 97 + attempt * 13 + world.day) % 1_000_003,
    });
    if (made) return made;
  }
  return null;
}

export function takeEncounterAction(
  world: WorldState,
  ledger: Ledger,
  eventId: number,
  action: EncounterAction,
): EncounterResult {
  const event = world.narrative.events.find((entry) => entry.id === eventId);
  if (!event) throw new Error(`Unbekannte Begegnung: ${String(eventId)}`);
  const npcId = visitorIdOfEvent(event);
  const visitor = npcId === null ? null : world.visitors.find((entry) => entry.id === npcId) ?? null;
  const npc = visitor ? npcByName(visitor.name) : null;
  if (npcId === null || !visitor || !npc) throw new Error('Die Begegnung hat keinen benannten NPC.');
  const amount = (action === 'GEBEN' ? ENCOUNTER_GIFT : ENCOUNTER_SMALL) as VaCoinMicro;
  const walletBefore = ledger.getBalance(PORTEMONNAIE);
  if (walletBefore < amount) {
    throw new Error(`Nicht genug Bargeld (${walletBefore}). Hebe am Hauskonto ab.`);
  }
  const state = cityOf(world);
  if (state.energy < ENCOUNTER_ENERGY) {
    throw new Error(`Zu wenig Energie (${state.energy}/${ENCOUNTER_ENERGY}). Der naechste Tag fuellt sie auf.`);
  }
  const energyBefore = state.energy;
  const execution = executeChoice(world, ledger, eventId, CHOICE_OF[action]);
  if (!execution.ok) {
    throw new Error(`Die Handlung wurde abgelehnt: ${execution.rejections[0]?.reason ?? 'UNBEKANNT'}.`);
  }
  // Geld geht aus dem Portemonnaie, nie aus der Hauskasse.
  ledger.transfer(PORTEMONNAIE, EXTERNAL, amount, `begegnung ${action.toLowerCase()}`, world.tick);
  const energyAfter = clampEnergy(energyBefore - ENCOUNTER_ENERGY);

  const resolved = [...world.narrative.pending].reverse()
    .find((fact) => fact.kind === 'EVENT_RESOLVED' && fact.eventId === eventId);
  const own = resolved
    ? recordFirstHand(world, {
      actor: visitorRef(npcId),
      factId: resolved.id,
      sentiment: SENTIMENT_OF[action],
      tick: world.tick,
    })
    : null;
  // Die Erinnerung des NPCs ist derselbe Fact, den das Wissen traegt.
  if (resolved && own) {
    const memories = visitor.memories ?? [];
    if (!memories.some((memory) => memory.factId === resolved.id)) {
      const memory: VisitorMemory = {
        factId: resolved.id,
        tick: world.tick,
        score: action === 'ABLEHNEN' ? 20 : 80,
        valence: action === 'ABLEHNEN' ? 'BAD' : 'GOOD',
      };
      visitor.memories = [...memories, memory].slice(-NARRATIVE_LIMITS.memories);
    }
  }
  const shared = own ? shareWithInformant(world, npcId, npc, world.tick, eventId) : null;

  const trust = relationshipBetween(world, visitorRef(npcId), 'player')?.trust ?? 0;
  const record: CityEncounterRecord = {
    npcId,
    name: npc.name,
    location: state.location,
    day: world.day,
    tick: world.tick,
    action,
    amount,
    trust,
  };
  const encounters = [...(state.encounters ?? []), record].slice(-MAX_ENCOUNTERS);
  const text = `${npc.name}: ${ACTION_LABEL[action]}. Vertrauen ${trust}, Energie ${energyBefore}->${energyAfter}.`;
  world.city = {
    ...cityOf(world),
    energy: energyAfter,
    energyDay: world.day,
    encounters,
    lastText: text,
    lastResult: text,
  };
  world.lastEvent = text;
  return {
    action,
    amount,
    walletBefore,
    walletAfter: ledger.getBalance(PORTEMONNAIE),
    energyBefore,
    energyAfter,
    trust,
    own,
    shared,
    text,
  };
}
