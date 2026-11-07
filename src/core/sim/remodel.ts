/** Umbau: Voraussetzungen und Deckung pruefen, dann das bestehende Haus erweitern. */
import type { Ledger } from '../economy/ledger';
import { expandHouse } from './expansions';
import type { TemplateId, WorldState } from './types';

const REQUIREMENTS: Readonly<Record<TemplateId, { day: number; reputation: number; served: number } | null>> = {
  SMALL: null,
  MEDIUM: { day: 4, reputation: 35, served: 25 },
  LARGE: { day: 8, reputation: 55, served: 80 },
};

export function remodelRequirements(template: TemplateId): { day: number; reputation: number; served: number } | null {
  return REQUIREMENTS[template];
}

/**
 * Ausbau auf ein groesseres Haus. Die bestehende Einrichtung, IDs, Gaeste und
 * offenen Anspruche bleiben erhalten; neue Bereiche kommen als Bauflaechen dazu.
 */
export function remodel(world: WorldState, ledger: Ledger, template: TemplateId, tick: number): WorldState {
  if (template === world.template) return world;
  const requirement = REQUIREMENTS[template];
  if (requirement && (world.day < requirement.day || world.reputation < requirement.reputation
    || world.guestsServed < requirement.served)) {
    throw new Error(
      `Voraussetzung für ${template}: Tag ${requirement.day}, Ruf ${requirement.reputation}, ${requirement.served} bediente Gäste.`,
    );
  }
  return expandHouse(world, ledger, template, tick);
}
