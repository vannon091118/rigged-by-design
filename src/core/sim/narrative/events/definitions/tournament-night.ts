/** Engine-seitig gestartete Nachfrageveranstaltung ohne Fact-Trigger und ohne Choices. */
import { demandDefinition } from '../demand-definitions';
import { ENGINE_DEMAND_TRIGGER, type EventTemplate } from '../template-types';

const definition = demandDefinition('TURNIER_ABEND');

export const TURNIER_ABEND_TEMPLATE: EventTemplate = {
  eventId: definition.kind,
  version: 1,
  triggerId: ENGINE_DEMAND_TRIGGER,
  priority: 0,
  scope: 'GLOBAL',
  participantRoles: [],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['demand', 'turnier-abend'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['demand'] },
  ],
  choices: [],
  initialStep: 'START',
  expiresInTicks: definition.durationTicks,
  cooldownTicks: definition.cooldownTicks,
  maxOccurrences: 0,
};
