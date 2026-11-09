/** Einzige Registry der stabilen Event-Templates. */
import type { EventTemplate } from '../template-types';
import { isEventTemplate } from '../template-schema';
import { NEON_NACHT_TEMPLATE } from './neon-nacht';
import { RIVAL_MOVE_TEMPLATE } from './rival-move';
import { VISITOR_AFTERMATH_TEMPLATE } from './visitor-aftermath';
import { VISITOR_RETURN_WARM_TEMPLATE } from './visitor-return-warm';
import { TURNIER_ABEND_TEMPLATE } from './tournament-night';
import { VISITOR_CONFLICT_TEMPLATE } from './visitor-conflict';
import { VISITOR_RETURN_TEMPLATE } from './visitor-return';
import { AMBIENT_BAR_TALK_TEMPLATE } from './ambient-bar-talk';
import { AMBIENT_SHARED_ROUND_TEMPLATE } from './ambient-shared-round';
import { AMBIENT_TENSE_TABLE_TEMPLATE } from './ambient-tense-table';
import { CHAIN_VISITOR_ECHO_TEMPLATE } from './chain-visitor-echo';
import { CITY_ENCOUNTER_TEMPLATE } from './city-encounter';
import { CITY_ENCOUNTER_ECHO_COLD_TEMPLATE, CITY_ENCOUNTER_ECHO_WARM_TEMPLATE } from './city-encounter-echo';

const SOURCES: readonly EventTemplate[] = [
  VISITOR_RETURN_TEMPLATE, VISITOR_CONFLICT_TEMPLATE, NEON_NACHT_TEMPLATE, TURNIER_ABEND_TEMPLATE,
  RIVAL_MOVE_TEMPLATE, VISITOR_AFTERMATH_TEMPLATE, VISITOR_RETURN_WARM_TEMPLATE,
  AMBIENT_BAR_TALK_TEMPLATE, AMBIENT_SHARED_ROUND_TEMPLATE, AMBIENT_TENSE_TABLE_TEMPLATE,
  CHAIN_VISITOR_ECHO_TEMPLATE,
  CITY_ENCOUNTER_TEMPLATE, CITY_ENCOUNTER_ECHO_WARM_TEMPLATE, CITY_ENCOUNTER_ECHO_COLD_TEMPLATE,
];

/** Ungueltige Definitionen werden fail-closed nicht angeboten. */
export const EVENT_TEMPLATES: readonly EventTemplate[] = SOURCES.filter(isEventTemplate);

export function templateFor(eventId: string, version?: number): EventTemplate | null {
  return EVENT_TEMPLATES.find((template) => template.eventId === eventId
    && (version === undefined || template.version === version)) ?? null;
}
