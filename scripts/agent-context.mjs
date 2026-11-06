#!/usr/bin/env node
/**
 * Ein Aufruf, ein Kontext: Aenderungen, Systeme, Invarianten, Tests, Gates und
 * bereits gueltige Cache-Treffer. Ohne `--json` strukturiert, mit `--line` als
 * eine Zeile, mit `--json` maschinenlesbar.
 *
 * Der Kontext ersetzt keine Codepruefung; er erspart die wiederholte
 * Bestandsaufnahme aus Git, Importgraph, Katalog und Doku.
 */
import { impact, oneLineOf, summarize } from './lib/impact.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const result = impact({ profile: profileArg ? profileArg.slice('--profile='.length) : 'quick' });

if (argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
if (argv.includes('--line')) {
  const laneInfo = result.lanes.open.length > 0
    ? ` · Lanes offen: ${result.lanes.open.map((l) => l.id).join(',')}`
    : '';
  const collisionInfo = result.lanes.collisions.length > 0
    ? ` · Kollisionen: ${result.lanes.collisions.length}`
    : '';
  console.log(`${oneLineOf(result)}${laneInfo}${collisionInfo}`);
  process.exit(0);
}
console.log(summarize(result));
if (result.lanes.open.length > 0) {
  console.log('');
  console.log('=== Offene Lane-Claims ===');
  for (const lane of result.lanes.open) {
    console.log(`  ${lane.id} · Owner: ${lane.owner} · Branch: ${lane.branch} · Basis: ${lane.baseSha}`);
    console.log(`    Schreibt Contracts: ${lane.writeContracts.join(', ') || '(keine)'}`);
    console.log(`    Pfade: ${lane.pathAllowlist.join(', ')}`);
  }
}
if (result.lanes.collisions.length > 0) {
  console.log('');
  console.log('=== Lane-Kollisionen ===');
  for (const coll of result.lanes.collisions) {
    console.log(`  ${coll.lane}:`);
    for (const c of coll.collisions) {
      console.log(`    vs ${c.lane}: ${c.reason}${c.contractConflict.length > 0 ? `, Contract-Konflikt: ${c.contractConflict.join(', ')}` : ''}`);
    }
  }
}
if (result.lanes.parked.length > 0) {
  console.log('');
  console.log('=== PARKED ===');
  for (const p of result.lanes.parked) {
    console.log(`  ${p.id} · Owner: ${p.owner}`);
  }
}
console.log('Naechster Schritt: pnpm run agent:verify (derselbe Plan, Cache wird wiederverwendet)');
process.exit(0);
