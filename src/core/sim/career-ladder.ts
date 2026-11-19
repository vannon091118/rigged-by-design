''
import type { WorldState } from './types';
import type { Ledger } from '../economy/ledger';
import type { CompanyStatus } from './progression';
import { companyStatus } from './progression';
import { HAUSKONTO } from './money';

export type LadderRungId = 'hustle' | 'bude' | 'konkurrenz' | 'kiez' | 'imperium';

export interface LadderRung {
  readonly id: LadderRungId;
  readonly label: string;
  readonly targetVC: number;
  readonly mechanic: string;
  readonly visual: string;
  readonly hooks: readonly string[];
  readonly reached: (world: WorldState, ledger: Ledger) => boolean;
}

const MICRO = 10_000;

function hustleReached(_world: WorldState, ledger: Ledger): boolean {
  return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO) >= 100;
}

function budeReached(_world: WorldState, ledger: Ledger): boolean {
  return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO) >= 1_000;
}

function konkurrenzReached(_world: WorldState, ledger: Ledger): boolean {
  return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO) >= 5_000;
}

function kiezReached(_world: WorldState, ledger: Ledger): boolean {
  return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO) >= 25_000;
}

function imperiumReached(_world: WorldState, ledger: Ledger): boolean {
  return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO) >= 100_000;
}

export const LADDER: readonly LadderRung[] = [
  {
    id: 'hustle',
    label: 'Hustle',
    targetVC: 1_000,
    mechanic: 'Schichtjob oder eigener Laden. Hunger/Durst gegen Zeit, Bar fur 50 VC kaufen, Kampf- und E-Sport-Nebenverdienst.',
    visual: 'Wohnung und Hinterhof, Outfit noch schadig.',
    hooks: ['player-jobs', 'needs', 'fight-career'],
    reached: hustleReached,
  },
  {
    id: 'bude',
    label: 'Bude',
    targetVC: 10_000,
    mechanic: 'Preise und Odds selbst drehen, Mods einbauen. Das Haus-Edge-Dilemma ist der eigentliche Titel des Spiels.',
    visual: 'Sichtbarer Umbau von Beton zu Teppich.',
    hooks: ['setSlotOdds', 'setPrice', 'setCarpet', 'setNeon'],
    reached: budeReached,
  },
  {
    id: 'konkurrenz',
    label: 'Konkurrenz',
    targetVC: 50_000,
    mechanic: 'Drei Rival-Casinos mit Ruf 22, 58 und 81. Fremd-Floor besuchen, abwerben, ausspielen.',
    visual: 'Rivalen mit eigener Optik.',
    hooks: ['rivals', 'foreign-floor'],
    reached: konkurrenzReached,
  },
  {
    id: 'kiez',
    label: 'Kiez',
    targetVC: 250_000,
    mechanic: 'Grundstucke und Gebauede kaufen, Haushalte und Jobs der Stadt befeuern.',
    visual: 'Die Stadtkarte wachst mit dir.',
    hooks: ['city-plots', 'city-construction', 'city-growth'],
    reached: kiezReached,
  },
  {
    id: 'imperium',
    label: 'Imperium',
    targetVC: 1_000_000,
    mechanic: 'Ruf gegen Rendite, Aufsicht, Selbstsperre und Sucht-Score als echte Gegenspieler.',
    visual: 'Marmor, Skyline, Millionars-Outfit.',
    hooks: ['addictionScore', 'self-exclusion', 'security'],
    reached: imperiumReached,
  },
];

export function ladderRungFor(capitalVC: number): LadderRung | null {
  let current: LadderRung | null = null;
  for (const rung of LADDER) {
    if (capitalVC >= rung.targetVC) current = rung;
  }
  return current;
}

export function nextLadderRung(capitalVC: number): LadderRung | null {
  for (const rung of LADDER) {
    if (capitalVC < rung.targetVC) return rung;
  }
  return null;
}

export function ladderStatus(world: WorldState, ledger: Ledger): {
  readonly current: LadderRung | null;
  readonly next: LadderRung | null;
  readonly capitalVC: number;
  readonly companyStatus: CompanyStatus;
} {
  const capital = Math.floor(ledger.getBalance(HAUSKONTO) / MICRO);
  const current = ladderRungFor(capital);
  const next = nextLadderRung(capital);
  const company = companyStatus(world, ledger);
  return { current, next, capitalVC: capital * MICRO, companyStatus: company };
}
