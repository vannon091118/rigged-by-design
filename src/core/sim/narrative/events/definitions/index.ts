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

const SOURCES: readonly EventTemplate[] = [
  VISITOR_RETURN_TEMPLATE, VISITOR_CONFLICT_TEMPLATE, NEON_NACHT_TEMPLATE, TURNIER_ABEND_TEMPLATE,
  RIVAL_MOVE_TEMPLATE, VISITOR_AFTERMATH_TEMPLATE, VISITOR_RETURN_WARM_TEMPLATE,
];

/** Ungueltige Definitionen werden fail-closed nicht angeboten. */
export const EVENT_TEMPLATES: readonly EventTemplate[] = SOURCES.filter(isEventTemplate);

export function templateFor(eventId: string, version?: number): EventTemplate | null {
  return EVENT_TEMPLATES.find((template) => template.eventId === eventId
    && (version === undefined || template.version === version)) ?? null;
}
