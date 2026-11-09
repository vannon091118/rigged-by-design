/**
 * Die Begegnung wirkt nach: Ein Tag (24 Ticks) nach der aufgeloesten Szene
 * entscheidet der hinterlassene Zustand, ob die naechste Begegnung eine
 * Einladung oder ein Konflikt ist. Die Verzoegerung ist Teil der Kette, damit
 * der Spieler den Ort verlassen und zurueckkehren kann.
 */
import type { ChainCondition, NarrativeChain } from '../chain-types';

const GAVE_OR_HELPED: ChainCondition = {
  op: 'any',
  conditions: [
    { op: 'flag-between', flag: 'encounter_gift', min: 1 },
    { op: 'flag-between', flag: 'encounter_help', min: 1 },
  ],
};

export const CITY_ENCOUNTER_ARC: NarrativeChain = {
  chainId: 'CITY_ENCOUNTER_ARC',
  version: 1,
  start: 'ENCOUNTER',
  nodes: [
    { nodeId: 'ENCOUNTER', eventId: 'CITY_ENCOUNTER' },
    { nodeId: 'WARM_ECHO', eventId: 'CITY_ENCOUNTER_ECHO_WARM', terminal: true },
    { nodeId: 'COLD_ECHO', eventId: 'CITY_ENCOUNTER_ECHO_COLD', terminal: true },
  ],
  edges: [
    {
      edgeId: 'ENCOUNTER_TO_WARM',
      from: 'ENCOUNTER',
      to: 'WARM_ECHO',
      priority: 20,
      delayTicks: 24,
      when: GAVE_OR_HELPED,
    },
    {
      edgeId: 'ENCOUNTER_TO_COLD',
      from: 'ENCOUNTER',
      to: 'COLD_ECHO',
      priority: 10,
      delayTicks: 24,
      when: { op: 'not', condition: GAVE_OR_HELPED },
    },
  ],
  maxSteps: 3,
  // Ein Stadt-Ruhetag sind 600 Ticks; die Kette muss ihn ueberleben, damit die
  // 24-Tick-Verzoegerung bei der Rueckkehr sichtbar wird statt waehrend des
  // Tagesabschlusses zu verfallen.
  maxDurationTicks: 700,
  repeatable: false,
  cooldownTicks: 0,
};
