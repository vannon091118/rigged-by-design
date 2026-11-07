/** Gästetypen: Budget, Geduld, Suchtneigung, Getränkeneigung und Spielgeschmack. */
import type { GameId, PersonaId } from './types';

interface Persona {
  readonly id: PersonaId;
  readonly name: string;
  readonly description: string;
  readonly budgetFactor: number;
  readonly patience: number;
  readonly addictionRate: number;
  readonly drinkRate: number;
  readonly taste: Readonly<Partial<Record<GameId, number>>>;
  readonly color: number;
  readonly minTier: 1 | 2 | 3;
}

const PERSONAS: readonly Persona[] = [
  {
    id: 'LUMPEN', name: 'Lumpen', description: 'Letztes Kleingeld, viel Zeit, wenig Anspruch.',
    budgetFactor: 0.45, patience: 112, addictionRate: 1.15, drinkRate: 0.5,
    taste: { SLOT: 260, DICE: 120, ROULETTE: 40 }, color: 0x8d99ae, minTier: 1,
  },
  {
    id: 'STREET', name: 'Straßentyp', description: 'Kommt für das Licht und bleibt für den Kick.',
    budgetFactor: 1, patience: 95, addictionRate: 1, drinkRate: 0.6,
    taste: { SLOT: 180, PLINKO: 220, BLACKJACK: 120, SHELL: 90 }, color: 0x00ffcc, minTier: 1,
  },
  {
    id: 'BUSINESS', name: 'Business', description: 'Hat Geld, wenig Zeit und ein Auge für teure Tische.',
    budgetFactor: 2.2, patience: 78, addictionRate: 0.9, drinkRate: 0.35,
    taste: { BLACKJACK: 300, POKER: 220, ROULETTE: 160, SLOT: -60 }, color: 0xffd166, minTier: 2,
  },
  {
    id: 'HIGH_ROLLER', name: 'High Roller', description: 'Spielt nur, wo der Mindesteinsatz wehtut.',
    budgetFactor: 5, patience: 68, addictionRate: 0.8, drinkRate: 0.2,
    taste: { ROULETTE: 480, POKER: 360, BLACKJACK: 280, SLOT: -120 }, color: 0xff2e88, minTier: 3,
  },
  {
    id: 'STAMMGAST', name: 'Stammgast', description: 'Kennt deinen Automaten besser als du. Kommt immer wieder.',
    budgetFactor: 0.85, patience: 138, addictionRate: 1.5, drinkRate: 0.75,
    taste: { SLOT: 300, PLINKO: 140, DICE: 120, BLACKJACK: 60 }, color: 0xb06bff, minTier: 1,
  },
];

const INDEX = new Map(PERSONAS.map((persona) => [persona.id, persona]));

export function getPersona(id: PersonaId): Persona {
  return INDEX.get(id) ?? PERSONAS[0]!;
}

export function personasForTier(tier: 1 | 2 | 3): readonly Persona[] {
  return PERSONAS.filter((persona) => persona.minTier <= tier);
}
