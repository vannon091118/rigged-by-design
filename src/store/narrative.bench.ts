/**
 * @test-target: src/core/sim/narrative/runtime.ts
 * @error-code: ERR-1003
 *
 * NAR-16: Narrative Hotpath. Gemessen wird ein realistischer Tick nach einem
 * Tag Betrieb und die Runtime mit vollem 48er-Fact-Fenster. Der Messpfad liegt
 * im Store, weil `src/core` keine Store- oder Test-Helfer importieren darf.
 * Bewusst nicht Teil von verify:all: misst Durchsatz, wird nie rot.
 */
import { test } from 'vitest';
import { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { randomSeed } from '../test/random-seed';
import { measure } from '../test/measure';
import { ensureStarter, createWorld } from '../core/sim/templates';
import { tickWorld } from '../core/sim/tick';
import { emitFact } from '../core/sim/narrative/facts';
import { processNarrativeRuntime } from '../core/sim/narrative/runtime';
import { toSavedGame } from './save';

const world = createWorld('LARGE');
ensureStarter(world);
const ledger = new Ledger();
ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(5_000), 'narrativ-bench', 0);
const prng = new Prng(randomSeed());
for (let tick = 0; tick < 600; tick += 1) tickWorld(world, ledger, prng);

test('Tick mit Narrativ-Domaene', { timeout: 120_000 }, () => {
  measure('tickWorld', () => {
    tickWorld(world, ledger, prng);
  }, {
    iterations: 20,
    note: `${world.visitors.length} Besucher, ${world.narrative.relationships.length} Kanten, ${world.narrative.events.length} Szenen`,
  });
});

test('Save-Groesse nach einem Spieltag', { timeout: 120_000 }, () => {
  const bytes = JSON.stringify(toSavedGame(world, ledger, prng.getState())).length;
  console.log(`save: ${(bytes / 1024).toFixed(1)} KiB · journal ${world.journal.length} · archiv ${world.archive.length} · pending ${world.narrative.pending.length}`);
});

test('Runtime mit vollem Fact-Fenster', { timeout: 120_000 }, () => {
  measure('processNarrativeRuntime', () => {
    for (let index = 0; index < 48; index += 1) {
      emitFact(world, { kind: 'COMMAND_REJECTED', commandId: 'BENCH', reason: 'BENCH' });
    }
    processNarrativeRuntime(world, ledger);
  }, {
    iterations: 20,
    note: `48 Facts, ${world.narrative.recent.length} im Kurzzeitfenster`,
  });
});
