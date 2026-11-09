/**
 * Eigenschaften der Stadt-NPCs: 30 Traits, Vergabe nach Stats und PRNG,
 * Entwicklung durch Umgebung, Beziehung, Laster, Erfahrung und Interaktion.
 * Spielerinteraktion wiegt doppelt so schwer wie ein NPC-Kontakt.
 */
import { Prng } from '../rng/prng';
import { pickWeighted } from '../rng/weighted';
import type { WorldState } from './types';
import type { EncounterAction, TraitId, TraitIntensity, TraitState } from './city-types';
import type { ActorRef } from './narrative/types';
import { visitorIdOf } from './narrative/relationships';

export type { TraitId, TraitIntensity, TraitState } from './city-types';

type TraitCategory = 'SOZIAL' | 'WISSEN' | 'LAST' | 'CHARAKTER';
type TraitEffectKey = 'share' | 'overshare' | 'credibility' | 'skepticism' | 'gain' | 'distortion' | 'loyalty';

interface TraitDef {
  readonly id: TraitId;
  readonly label: string;
  readonly category: TraitCategory;
  readonly effects: Partial<Record<TraitEffectKey, number>>;
  readonly stats?: { readonly charisma?: number; readonly intellect?: number };
}

/** Genau 30 Eigenschaften; die Reihenfolge ist die stabile Katalogreihenfolge. */
export const TRAITS: readonly TraitDef[] = [
  { id: 'KONSUMENT', label: 'Konsument', category: 'WISSEN', effects: { gain: 0.6, share: -0.2 }, stats: { intellect: 0.8 } },
  { id: 'LASTERMAUL', label: 'Laestermaul', category: 'SOZIAL', effects: { share: 0.7, overshare: 0.6, credibility: -0.5 }, stats: { charisma: 1, intellect: -0.4 } },
  { id: 'MITLAEUFER', label: 'Mitlaeufer', category: 'SOZIAL', effects: { share: 0.4, credibility: -0.3, distortion: 0.2 }, stats: { intellect: -0.4 } },
  { id: 'EINZELGAENGER', label: 'Einzelgaenger', category: 'SOZIAL', effects: { share: -0.7, credibility: 0.3 }, stats: { charisma: -0.8 } },
  { id: 'GERUECHTEMACHER', label: 'Geruechtemacher', category: 'WISSEN', effects: { share: 0.6, distortion: 0.7, credibility: -0.3 }, stats: { charisma: 0.5, intellect: -0.3 } },
  { id: 'VERSCHWIEGEN', label: 'Verschwiegen', category: 'WISSEN', effects: { share: -0.8, credibility: 0.2 }, stats: { charisma: -0.4 } },
  { id: 'HILFSBEREIT', label: 'Hilfsbereit', category: 'SOZIAL', effects: { share: 0.5, gain: -0.4 } },
  { id: 'MISSTRAUISCH', label: 'Misstrauisch', category: 'CHARAKTER', effects: { skepticism: 0.8 }, stats: { intellect: 0.7 } },
  { id: 'LEICHTGLAEUBIG', label: 'Leichtglaeubig', category: 'CHARAKTER', effects: { skepticism: -0.8 }, stats: { intellect: -0.7 } },
  { id: 'PRAHLER', label: 'Prahler', category: 'SOZIAL', effects: { share: 0.5, overshare: 0.5, credibility: -0.4 }, stats: { charisma: 0.6 } },
  { id: 'BESCHEIDEN', label: 'Bescheiden', category: 'CHARAKTER', effects: { share: -0.3, credibility: 0.3 } },
  { id: 'RAUCHER', label: 'Raucher', category: 'LAST', effects: {} },
  { id: 'TRINKER', label: 'Trinker', category: 'LAST', effects: {} },
  { id: 'SPIELER', label: 'Spieler', category: 'LAST', effects: { gain: 0.4 } },
  { id: 'GEIZHALS', label: 'Geizhals', category: 'CHARAKTER', effects: { share: -0.5, gain: 0.5 } },
  { id: 'GROSSZUEGIG', label: 'Grosszuegig', category: 'CHARAKTER', effects: { share: 0.5, gain: -0.3 } },
  { id: 'NEUGIERIG', label: 'Neugierig', category: 'WISSEN', effects: { share: 0.3 } },
  { id: 'DESINTERESSIERT', label: 'Desinteressiert', category: 'WISSEN', effects: { share: -0.5 }, stats: { intellect: -0.3 } },
  { id: 'LOYAL', label: 'Loyal', category: 'SOZIAL', effects: { share: -0.1, loyalty: 0.6 } },
  { id: 'VERRAETER', label: 'Verraeter', category: 'WISSEN', effects: { gain: 0.7, loyalty: -0.6 }, stats: { intellect: 0.6 } },
  { id: 'EHRLICH', label: 'Ehrlich', category: 'CHARAKTER', effects: { credibility: 0.6 }, stats: { intellect: 0.3 } },
  { id: 'VERSCHLAGEN', label: 'Verschlagen', category: 'WISSEN', effects: { distortion: 0.4, credibility: -0.3 }, stats: { intellect: 0.4 } },
  { id: 'RUHEPOL', label: 'Ruhepol', category: 'CHARAKTER', effects: { credibility: 0.3, skepticism: 0.2 } },
  { id: 'CHAOT', label: 'Chaot', category: 'CHARAKTER', effects: { overshare: 0.6, distortion: 0.5 } },
  { id: 'SPARSAM', label: 'Sparsam', category: 'CHARAKTER', effects: { gain: 0.3 } },
  { id: 'MITTEILSAM', label: 'Mitteilsam', category: 'SOZIAL', effects: { share: 0.6 }, stats: { charisma: 0.8 } },
  { id: 'SCHUECHTERN', label: 'Schuechtern', category: 'SOZIAL', effects: { share: -0.5 }, stats: { charisma: -0.6 } },
  { id: 'STOLZ', label: 'Stolz', category: 'CHARAKTER', effects: { share: 0.1, credibility: -0.2 } },
  { id: 'BEOBACHTER', label: 'Beobachter', category: 'WISSEN', effects: { credibility: 0.5, share: -0.2 }, stats: { intellect: 0.6 } },
  { id: 'FUERSORGLICH', label: 'Fuersorglich', category: 'SOZIAL', effects: { share: 0.3, gain: -0.2 } },
];

const BY_ID = new Map(TRAITS.map((def) => [def.id, def]));
const traitById = (id: TraitId): TraitDef | null => BY_ID.get(id) ?? null;

interface NpcStats { readonly charisma: number; readonly intellect: number }
export interface NpcProfile extends NpcStats { readonly vice: number; readonly traits: readonly TraitState[] }

function traitWeight(def: TraitDef, stats: NpcStats): number {
  const affinity = (def.stats?.charisma ?? 0) * (stats.charisma / 10)
    + (def.stats?.intellect ?? 0) * (stats.intellect / 10);
  return Math.max(0.08, 1 + affinity);
}

const intensityFor = (progress: number): TraitIntensity => (progress >= 5 ? 3 : progress >= 2 ? 2 : 1);

function initialTrait(id: TraitId, stats: NpcStats, signature: boolean): TraitState {
  const def = traitById(id);
  const statStrong = ((def?.stats?.charisma ?? 0) > 0 && stats.charisma >= 8)
    || ((def?.stats?.intellect ?? 0) > 0 && stats.intellect >= 8);
  const intensity: TraitIntensity = signature || statStrong ? 2 : 1;
  return { id, intensity, progress: intensity === 2 ? 2 : 0 };
}

/** Vergibt 2-4 Eigenschaften: eine optionale Signatur, der Rest seedfest nach Stats. */
export function assignTraits(
  prng: Prng,
  stats: NpcStats,
  options: { readonly vice?: number; readonly signature?: TraitId; readonly count?: number } = {},
): TraitState[] {
  const count = Math.max(1, Math.min(4, options.count ?? 2 + (prng.nextFloat() < 0.45 ? 1 : 0)));
  const chosen: TraitId[] = options.signature ? [options.signature] : [];
  while (chosen.length < count) {
    const picked = pickWeighted(
      prng,
      TRAITS.map((def) => ({ item: def.id, weight: traitWeight(def, stats) })),
      (id) => !chosen.includes(id),
    );
    if (!picked) break;
    chosen.push(picked);
  }
  if ((options.vice ?? 0) >= 6 && chosen.length < 4 && !chosen.some((id) => traitById(id)?.category === 'LAST')) {
    const last = pickWeighted(prng, TRAITS
      .filter((def) => def.category === 'LAST' && !chosen.includes(def.id))
      .map((def) => ({ item: def.id, weight: 1 })));
    if (last) chosen.push(last);
  }
  return chosen.map((id) => initialTrait(id, stats, options.signature === id));
}

/** Feste, aus der Figur stammende Eigenschaften; alle starten gefestigt. */
export function seedTraits(ids: readonly TraitId[], stats: NpcStats): TraitState[] {
  return ids.map((id) => initialTrait(id, stats, true));
}

/** Summierte Wirkung aller Trait-Ausprägungen; starke Ausprägung zählt 1,5-fach. */
export function traitEffect(traits: readonly TraitState[], key: TraitEffectKey): number {
  let total = 0;
  for (const state of traits) {
    total += (traitById(state.id)?.effects[key] ?? 0) * (state.intensity / 2);
  }
  return total;
}

type TraitSignal = 'PLAYER' | 'NPC' | 'ENVIRONMENT' | 'RELATIONSHIP' | 'VICE' | 'EXPERIENCE';
const SIGNAL_WEIGHT: Readonly<Record<TraitSignal, number>> = {
  PLAYER: 2, NPC: 1, ENVIRONMENT: 1, RELATIONSHIP: 1, VICE: 1, EXPERIENCE: 1,
};

/** Erhoeht die Auspraegung genau einer gehaltenen Eigenschaft; keine neuen Traits. */
export function developTrait(
  traits: readonly TraitState[],
  id: TraitId,
  signal: TraitSignal,
  times = 1,
): TraitState[] {
  const weight = SIGNAL_WEIGHT[signal] * Math.max(1, Math.floor(times));
  return traits.map((state) => {
    if (state.id !== id) return state;
    const progress = Math.min(8, state.progress + weight);
    return { ...state, progress, intensity: intensityFor(progress) };
  });
}

const ACTION_TRAITS: Readonly<Record<EncounterAction, readonly TraitId[]>> = {
  GEBEN: ['HILFSBEREIT', 'MITTEILSAM', 'GROSSZUEGIG'],
  HELFEN: ['HILFSBEREIT', 'FUERSORGLICH', 'LOYAL'],
  ABLEHNEN: ['MISSTRAUISCH', 'VERSCHWIEGEN', 'GEIZHALS'],
};

/** Die Spieleraktion praegt die naechstliegende gehaltene Eigenschaft mit Gewicht 2. */
export function developOnPlayerAction(traits: readonly TraitState[], action: EncounterAction): TraitState[] {
  const target = ACTION_TRAITS[action].find((id) => traits.some((state) => state.id === id)) ?? traits[0]?.id;
  return target ? developTrait(traits, target, 'PLAYER') : [...traits];
}

/** Wer eine Kunde hoert und weitergibt, praegt seine Redseligkeit mit Gewicht 1. */
export function developOnShare(traits: readonly TraitState[]): TraitState[] {
  const target = (['LASTERMAUL', 'MITTEILSAM', 'GERUECHTEMACHER'] as const)
    .find((id) => traits.some((state) => state.id === id));
  return target ? developTrait(traits, target, 'NPC') : [...traits];
}

export const strongTraits = (traits: readonly TraitState[]): readonly TraitState[] =>
  traits.filter((state) => state.intensity === 3);

export const traitIntensityOf = (traits: readonly TraitState[], id: TraitId): TraitIntensity | 0 =>
  traits.find((state) => state.id === id)?.intensity ?? 0;

/** Lesbare Kurzform fuer Dialoge und Tests: "Laestermaul 3, Misstrauisch 2". */
export function explainTraits(traits: readonly TraitState[]): string {
  return traits.map((state) => `${traitById(state.id)?.label ?? state.id} ${state.intensity}`).join(', ');
}

/** Profil eines Besuchers; ohne Stats/Traits bleibt der Akteur bewusst neutral. */
export function profileOf(world: WorldState, actor: ActorRef): NpcProfile | null {
  const id = visitorIdOf(actor);
  if (id === null) return null;
  const visitor = world.visitors.find((entry) => entry.id === id);
  if (!visitor || visitor.charisma === undefined || visitor.intellect === undefined || !visitor.traits) return null;
  return { charisma: visitor.charisma, intellect: visitor.intellect, vice: visitor.vice ?? 0, traits: visitor.traits };
}
