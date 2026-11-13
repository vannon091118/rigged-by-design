/** Mehrseed-Lauf fuer die Longturn-Evidenz: ein Seed, ein voller Stadtlauf. */
import { Ledger } from '../economy/ledger';
import { fromVC } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import { travel } from './city';
import { createCityLifeState } from './city-life-create';
import { ensureCityPopulation } from './city-life-state';
import { findCausalChain } from './city-life-sim';
import { runLongRun } from './living-world-longrun';
import { PORTEMONNAIE } from './money';
import { createWorld, ensureStarter } from './templates';

interface SeedRun {
  readonly seed: number;
  readonly signature: string;
  readonly decisions: number;
  readonly deviations: number;
  readonly metrics: string;
  /** Erste Entscheidungen als Strom; belegt Vielfalt auch ohne Kettenmuster. */
  readonly flow: string;
}

/**
 * Startet dieselbe Stadt wie `createNewGame` (Seed fuer Welt und Stadt) und
 * liefert die ableitbare Kette plus die harten Zahlen fuer den Vergleich.
 * Wirft, wenn der Lauf keine Mahlzeit-Erinnerung-Verhaltens-Kette hat: eine
 * unnachvollziehbare Emergenz ist kein gueltiger Nachweis.
 */
export function runSeed(seed: number, days = 4, population = 12): SeedRun {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityLife = createCityLifeState(seed);
  ensureCityPopulation(world, population);
  travel(world, 'KIEZ');
  const run = runLongRun(world, new Ledger({ [PORTEMONNAIE]: fromVC(20) }), new Prng(seed), days);
  const chain = findCausalChain(run.allDecisions);
  if (!chain) throw new Error(`Seed ${seed} hat keine nachvollziehbare Kette`);
  return {
    seed,
    signature: `${chain.meal.npcId}:${chain.meal.intent}->${chain.memory.intent}->${chain.use.intent}`,
    decisions: run.allDecisions.length,
    deviations: run.scheduledDeviations,
    metrics: `${run.allDecisions.length}/${run.scheduledDeviations}`,
    flow: run.allDecisions.slice(0, 200)
      .map((entry) => `${entry.npcId}:${entry.intent}@${entry.location}`).join('|'),
  };
}
