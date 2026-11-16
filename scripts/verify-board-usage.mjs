#!/usr/bin/env node
/**
 * verify-board-usage: belegt, dass die Lane am Issue-Board gefuehrt wird.
 *
 * Geprueft wird der verifizierte GitHub-Verlauf, nicht die lokale Datei:
 * offenes Issue, eigener `CLAIM`-Kommentar, und mit `--closeout` zusaetzlich
 * `RELEASE [<id>] done` plus Label `review-waiting`.
 *
 * Ohne lesbares Board ist der Befund ROT (Exit 1). Ein Agent kann damit nicht
 * mehr starten, committen oder pushen, ohne das Issue tatsaechlich benutzt zu
 * haben; die lokale Kollisionssperre bleibt nur eine Sperre.
 *
 * Exit 0 = Beleg vorhanden, Exit 1 = Beleg fehlt.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { captureConsole, compact } from './lib/compact.mjs';
import { loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import { issueNumberFor } from './lib/issue-claim.mjs';
import { readIssueClaimAny } from './lib/board-read.mjs';
import { evaluateBoardUsage } from './lib/board-usage.mjs';
import { normalizeActors } from './lib/work-claim.mjs';

const argv = process.argv.slice(2);
const requireCloseout = argv.includes('--closeout');
captureConsole({ label: 'verify-board' });
const asJson = argv.includes('--json');

function branchName() {
  try {
    return (
      process.env.BRANCH ||
      execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
    );
  } catch {
    return '';
  }
}

const branch = branchName();
const agent = process.env.RBD_AGENT || 'agent-local';

let claim = null;
let loadError = '';
try {
  const claims = loadClaimsStrict();
  claim = selectClaim(claims, branch);
} catch (error) {
  loadError = error instanceof Error ? error.message : 'unbekannt';
}

const actorsFile = join(ROOT, '.lane-claims/actors.json');
let actors = normalizeActors({});
if (existsSync(actorsFile)) {
  try {
    actors = normalizeActors(JSON.parse(readFileSync(actorsFile, 'utf8')));
  } catch {
    actors = normalizeActors({});
  }
}

const number = claim ? issueNumberFor(claim) : issueNumberFor({ branch });
const issueClaim = branch !== 'main' && number
  ? readIssueClaimAny({ number, agent, cwd: ROOT, actors })
  : { checked: false, status: 'not-linked', number: null };

const evaluation = loadError
  ? { ok: false, skipped: false, failures: [`Claim-Register nicht lesbar (${loadError})`], facts: [] }
  : evaluateBoardUsage({
      branch,
      claim,
      issueClaim,
      comments: issueClaim.comments ?? [],
      requireCloseout,
    });

if (asJson) {
  console.log(JSON.stringify({ ok: evaluation.ok, branch, agent, number, ...evaluation }, null, 2));
  process.exit(evaluation.ok ? 0 : 1);
}

const facts = [
  ['Branch', branch],
  ['Agent', agent],
  ['Pruefung', requireCloseout ? 'Claim + Uebergabe' : 'Claim'],
  ...evaluation.facts,
];
const text = compact({
  status: evaluation.ok ? 'GRUEN' : 'ROT',
  headline: `${branch || 'ohne Branch'} · Board-Beleg ${evaluation.ok ? 'vorhanden' : 'fehlt'}`,
  facts,
  findings: evaluation.failures.map((failure) => `[ERR-4019] ${failure}`),
});
if (evaluation.ok) console.log(text);
else console.error(text);
process.exit(evaluation.ok ? 0 : 1);
