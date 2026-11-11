#!/usr/bin/env node
/**
 * verify:scope: Nur der Diff gegen die Claim-Allowlist.
 *
 * Keine Tests, kein Typecheck, kein Build: Der Befehl sammelt ausschliesslich
 * die Pfade aus Branch-Diff, Index, Arbeitsbaum und unversionierten Dateien und
 * vergleicht sie mit dem Claim. Damit ist er als Vorpruefung geeignet, ohne
 * schwere Gates zu wiederholen.
 *
 * Exit 0 = alle Diff-Pfade im Claim, Exit 1 = fremder Pfad oder fehlender Claim.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compact } from './lib/compact.mjs';
import { loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';
import { scopeChanges } from './lib/staging-scope.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const stagedOnly = args.includes('--staged');

const git = (list) => {
  try {
    return execFileSync('git', list, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const lines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** Diff-Pfade aus Branch, Index, Arbeitsbaum und unversionierten Dateien. */
function changedPaths() {
  const found = new Set();
  const add = (list) => {
    for (const file of lines(git(list))) found.add(file.replace(/^\.\//, ''));
  };
  if (stagedOnly) {
    add(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
    return [...found].sort();
  }
  add(['diff', 'HEAD', '--name-only', '--diff-filter=ACMRD']);
  add(['diff', '--name-only', '--diff-filter=ACMRD']);
  add(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
  add(['ls-files', '--others', '--exclude-standard']);
  add(['diff', '--name-only', '--diff-filter=ACMRD', 'origin/main...HEAD']);
  return [...found].sort();
}

/** Die reine Scope-Entscheidung; der Test kann sie ohne Git aufrufen. */
export function assessScope({ changed = [], allowlist = [], claims = [], branch = '', exempt } = {}) {
  const input = { changed, allowlist, claims, branch };
  if (exempt !== undefined) input.exempt = exempt;
  return scopeChanges(input);
}

function main() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unbekannt)';
  const changed = changedPaths();
  const mode = stagedOnly ? 'gestaged' : 'Arbeitsbaum + Branch-Diff';

  if (branch === 'main') {
    if (asJson) {
      console.log(JSON.stringify({
        status: 'GRUEN',
        branch,
        claim: null,
        mode,
        changed,
        allowed: [],
        foreign: [],
        reason: 'main',
      }, null, 2));
    } else {
      console.log(compact({
        status: 'GRUEN',
        headline: 'main · Branch-Schutz statt Scope-Allowlist',
        facts: [['Diff', `${changed.length} Pfad(e) · ${mode}`]],
      }));
    }
    return;
  }

  let claims;
  try {
    claims = loadClaimsStrict();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unbekannter Fehler';
    if (asJson) {
      console.log(JSON.stringify({
        status: 'ROT',
        branch,
        claim: null,
        mode,
        changed,
        allowed: [],
        foreign: changed,
        error: `Claim-Register nicht lesbar: ${message}`,
      }, null, 2));
    } else {
      console.error(compact({
        status: 'ROT',
        headline: `${branch} · Claim-Register nicht lesbar`,
        facts: [['Diff', `${changed.length} Pfad(e) · ${mode}`]],
        findings: [`[ERR-4019] ${message}`],
      }));
    }
    process.exit(1);
  }

  const claim = selectClaim(claims, branch);
  if (!claim) {
    if (asJson) {
      console.log(JSON.stringify({
        status: 'ROT',
        branch,
        claim: null,
        mode,
        changed,
        allowed: [],
        foreign: changed,
        error: `Kein Lane-Claim fuer '${branch}'`,
      }, null, 2));
    } else {
      console.error(compact({
        status: 'ROT',
        headline: `${branch} · kein Lane-Claim`,
        facts: [['Diff', `${changed.length} Pfad(e) · ${mode}`]],
        findings: [`[ERR-4019] Kein Lane-Claim fuer '${branch}' in .lane-claims/`],
      }));
    }
    process.exit(1);
  }

  const scope = assessScope({ changed, allowlist: claim.pathAllowlist, claims, branch });
  const status = scope.ok ? 'GRUEN' : 'ROT';
  if (asJson) {
    console.log(JSON.stringify({
      status,
      branch,
      claim: { id: claim.id, owner: claim.owner, status: claim.status },
      mode,
      changed,
      allowed: scope.allowed,
      foreign: scope.foreign,
      takeover: scope.takeover,
    }, null, 2));
  } else if (scope.ok) {
    console.log(compact({
      status,
      headline: `${branch} · Scope-Diff im Claim`,
      facts: [['Claim', `${claim.id} (${claim.owner})`], ['Diff', `${changed.length} Pfad(e) · ${mode}`]],
    }));
  } else {
    console.error(compact({
      status,
      headline: `${branch} · ${scope.foreign.length} Pfad(e) ausserhalb des Claims`,
      facts: [['Claim', `${claim.id} (${claim.owner})`], ['Diff', `${changed.length} Pfad(e) · ${mode}`]],
      findings: scope.foreign.map((file) => `[ERR-4019] ${file} liegt ausserhalb der Allowlist.`),
      details: [`Allowlist: ${claim.pathAllowlist.join(', ') || '(leer)'}`],
    }));
  }
  if (!scope.ok) process.exit(1);
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
