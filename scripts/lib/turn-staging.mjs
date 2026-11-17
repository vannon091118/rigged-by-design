/**
 * Staging und Scope-Preflight eines Turns: kein `git add -A`, nur Claim-Pfade
 * plus Versionsdateien. Fremde WIP bleibt unangetastet.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { claimForBranch } from './lane-claims.mjs';
import { ROOT } from './report.mjs';
import { explicitScope, scopeChanges } from './staging-scope.mjs';

/** Geaenderte Pfade; bei einem Rename beide Seiten. */
export function changedPaths(git) {
  return git(['status', '--porcelain'])
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => line.slice(2).trim().split(' -> '))
    .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

function stageList(git, list) {
  const present = list.filter((path) => existsSync(resolve(ROOT, path)));
  const removed = list.filter((path) => !existsSync(resolve(ROOT, path)));
  if (present.length > 0) git(['add', '-A', '--', ...present]);
  if (removed.length > 0) git(['rm', '--cached', '--ignore-unmatch', '--', ...removed]);
}

export function stageChanges({ git, branch, paths, fail }) {
  if (paths.length > 0) {
    stageList(git, paths);
    return;
  }
  const claim = claimForBranch(branch);
  if (!claim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${branch}'; kein Staging ohne Allowlist`);
    process.exit(1);
  }
  const scope = scopeChanges({ changed: changedPaths(git), allowlist: claim.pathAllowlist });
  if (!scope.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${scope.foreign.slice(0, 8).join(', ')}`);
    process.exit(1);
  }
  stageList(git, [...new Set([...scope.allowed, 'package.json', 'pnpm-lock.yaml'])]);
}

/** Vor Bump und Staging: der Arbeitsbaum gehoert in den eigenen Claim. */
export function assertWorktreeScope({ git, branch, fail }) {
  const claim = claimForBranch(branch);
  if (!claim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${branch}'; erst Claim eintragen, dann committen`);
    process.exit(1);
  }
  const changed = git(['status', '--porcelain'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(2).trim())
    .map((path) => path.split(' -> ').pop());
  const scope = scopeChanges({ changed, allowlist: claim.pathAllowlist });
  if (!scope.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${scope.foreign.slice(0, 8).join(', ')}; fremde Arbeit bleibt unangetastet`);
    process.exit(1);
  }
  return scope;
}

export function assertExplicitScope({ branch, paths, fail }) {
  const claim = claimForBranch(branch);
  if (!claim) {
    fail(1, 'ERR-4019', 'turn:finish', `kein Claim fuer '${branch}'; explizite Pfade ohne Allowlist`);
    process.exit(1);
  }
  const explicit = explicitScope({ paths, allowlist: claim.pathAllowlist });
  if (!explicit.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Pfade ausserhalb des Claims: ${explicit.foreign.join(', ')}`);
    process.exit(1);
  }
  return explicit;
}
