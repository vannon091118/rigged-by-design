#!/usr/bin/env node
/**
 * Pretask: der Start jedes Laufs.
 *
 * Reihenfolge: erst Issue-Check und offengelassene Konflikte auflösen, dann
 * neue Arbeit. Der Lauf prueft nur und schreibt nichts; er macht sichtbar, was
 * vor dem ersten Edit zu klaeren ist.
 *
 * Exit 1 nur bei echten Startblockern: ungeloester Merge/Rebase, unmerged
 * Pfade oder Konfliktmarker im Baum. Ein offenes Issue ist Pflicht, aber kein
 * Blocker im Sinne der Leiter.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findCollisions, openClaims } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const run = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const blockers = [];
const notes = [];

const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unbekannt)';

/** 1. Bewusst offengelassene Konflikte: sie werden hier aufgeloest, nicht am Ende. */
for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
  const path = run(['rev-parse', '--git-path', marker]);
  if (path && existsSync(join(ROOT, path))) blockers.push(`laufender ${marker.replace(/-/g, ' ')}: erst abschliessen oder abbrechen`);
}

const unmerged = run(['diff', '--name-only', '--diff-filter=U']);
if (unmerged) blockers.push(`unmerged Pfade:\n    ${unmerged.split(/\r?\n/).join('\n    ')}`);

const conflictMarkers = run(['grep', '-n', '-E', '^(<<<<<<<|>>>>>>>) ', '--', '.']);
if (conflictMarkers) blockers.push(`Konfliktmarker im Baum:\n    ${conflictMarkers.split(/\r?\n/).slice(0, 8).join('\n    ')}`);

/** 2. Lane-Claim und Kollisionen. */
const claims = openClaims();
const claim = claims.find((c) => c.branch === branch);
if (branch === 'main') {
  notes.push('main ist durch den Branch-Schutz gedeckt; keine Lane noetig.');
} else if (!claim) {
  notes.push(`kein Lane-Claim fuer '${branch}' - verify-lane-claims blockiert den Commit.`);
} else {
  notes.push(`Lane ${claim.id}: ${claim.pathAllowlist.length} Pfad(e), Contracts ${claim.writeContracts().join(', ') || '(keine)'}.`);
  const collisions = findCollisions(claim);
  if (collisions.length > 0) {
    notes.push(`Kollisionen: ${collisions.map((c) => `${c.lane} (${c.reason || 'Contract'})`).join('; ')}`);
  }
}

/** 3. Liegengebliebene Staende, die niemand versehentlich verlieren soll. */
const stashes = run(['stash', 'list']);
if (stashes) notes.push(`${stashes.split(/\r?\n/).length} Stash(es) vorhanden: ${stashes.split(/\r?\n/)[0]}`);

console.log(`pretask: Branch ${branch}`);
console.log('');
console.log('=== Issue-Check (Pflicht, erste Arbeit) ===');
console.log('  gh issue list --label gate-failure --state open');
console.log('  gh issue list --label remote-ci --state open');
console.log('  Ein offenes gate-failure-Issue ist der alleinige Fokus, bis es geschlossen ist.');
for (const note of notes) console.log(`  - ${note}`);

if (blockers.length > 0) {
  console.error('');
  console.error('pretask: STARTBLOCKER - erst aufloesen, dann neue Arbeit:');
  for (const blocker of blockers) console.error(`  - ${blocker}`);
  process.exit(1);
}

console.log('');
console.log('pretask: keine offenen Konflikte; neue Arbeit erlaubt.');
console.log('  Arbeit: pnpm run agent:context · lokal leicht: pnpm run test:affected / verify:light');
