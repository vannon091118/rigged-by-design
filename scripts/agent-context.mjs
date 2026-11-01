#!/usr/bin/env node
/**
 * Ein Aufruf, ein Kontext: Aenderungen, Systeme, Invarianten, Tests, Gates und
 * bereits gueltige Cache-Treffer. Ohne `--json` kompakt, mit `--json` maschinenlesbar.
 *
 * Der Kontext ersetzt keine Codepruefung; er erspart die wiederholte
 * Bestandsaufnahme aus Git, Importgraph, Katalog und Doku.
 */
import { impact, summarize } from './lib/impact.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const result = impact({ profile: profileArg ? profileArg.slice('--profile='.length) : 'quick' });

if (argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
console.log(summarize(result));
console.log('Naechster Schritt: pnpm run agent:verify (derselbe Plan, Cache wird wiederverwendet)');
process.exit(0);
