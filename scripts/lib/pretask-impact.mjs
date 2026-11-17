/**
 * Impact-Plan, belegter Closeout und Pfad-Kollisionen. Der Reconcile liest
 * nur; geschrieben wird ausschliesslich mit `reconcile-claims --apply`.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { CONTEXT_VIEW, writeContextView } from './verify-state.mjs';
import { filterMergedCollisions } from './claim-merge-filter.mjs';
import { mergedPullRequestIndex } from './claim-pr-index.mjs';
import { planReconcile } from './claim-reconcile.mjs';
import { findCollisions } from './lane-claims.mjs';
import { impact as buildImpact } from './impact.mjs';
import { ROOT } from './report.mjs';

export function runImpact(ctx) {
  const {
    branch, dirtyPaths, claim, claims, originMain, gitStrict, blockers, warnings, notes,
  } = ctx;

  let contextData = null;
  let contextError = '';
  try {
    // Derselbe Prozess statt eines zweiten Node-Starts: der fruehere
    // `agent-context`-Kindprozess rechnete den Impact ein zweites Mal und
    // kostete allein durch Start und JSON-Pipe mehrere hundert Millisekunden.
    contextData = buildImpact({ profile: 'quick' });
  } catch (error) {
    contextError = error instanceof Error ? error.message : 'unbekannter Fehler';
  }
  if (!contextData || typeof contextData !== 'object') {
    blockers.push(`[ERR-4019] Impact-Plan fehlt oder ist nicht lesbar: ${contextError || 'leere Ausgabe'}`);
  } else if (!Array.isArray(contextData.systems) || !contextData.tests) {
    blockers.push('[ERR-4019] Impact-Plan ist unvollstaendig: systems/tests fehlen');
  }
  // Die vollstaendige Fassung liegt neben dem Cache, damit Werkzeuge und
  // Debugging denselben Stand lesen wie pretask.
  const contextFile = CONTEXT_VIEW;
  if (!writeContextView(contextData).file) {
    warnings.push(`Kontextdatei ${CONTEXT_VIEW} konnte nicht geschrieben werden`);
  }

  // Phase 3: lesender Reconcile vor der Kollisionspruefung. Geloeschte Branches,
  // entfernte Worktrees und alte Doku erzeugen keine Geister-Kollision mehr;
  // geschrieben wird ausschliesslich mit `reconcile-claims --apply`.
  const prIndex = mergedPullRequestIndex();
  const reconcile = planReconcile({ claims, baseRef: originMain || 'origin/main', git: gitStrict, prIndex });
  const reconciledLanes = new Set(reconcile.changes.map((change) => change.id));
  let automation = { state: 'AVAILABLE', applied: false, pending: 0 };
  let nextActionsHint = '';
  if (reconcile.changes.length > 0) {
    const sample = reconcile.changes.slice(0, 4).map((change) => `${change.id}:${change.evidence}`).join(', ');
    automation = {
      state: 'REMOTE_AUTOMATION_UNAVAILABLE',
      applied: false,
      pending: reconcile.changes.length,
      reason: 'Merged PR ohne vollstaendigen Closeout; der Actions-Lauf hat Claim/Task nicht nachgezogen.',
      sample,
    };
    notes.push(`Reconcile: ${reconcile.changes.length} Claim(s) belegbar merged (${sample}${reconcile.changes.length > 4 ? ', ...' : ''})`);
    // Der Maintainer-Start auf main zieht den belegten Closeout lokal und
    // idempotent nach; Lanes schreiben nie in ein fremdes Register. Der Branch
    // selbst bleibt Cleanup-Schritt des Workflows bzw. des Maintainers.
    if (branch === 'main' && dirtyPaths.length === 0) {
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'reconcile-claims.mjs'), '--apply'], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        automation.applied = true;
        notes.push('Closeout-Fallback: belegte Merges automatisch nachgezogen; Register-Aenderung ist noch zu committen.');
      } catch (error) {
        warnings.push(`Closeout-Fallback fehlgeschlagen: ${String(error?.message ?? error).split('\n')[0].slice(0, 160)}`);
      }
    } else if (branch !== 'main') {
      nextActionsHint = `Closeout offen: \`pnpm run reconcile:claims --apply\` auf main nachziehen (${reconcile.changes.length} Claim(s))`;
    }
  }

  if (claim && branch !== 'main' && !ctx.botBranch) {
    // Dieselbe Reihenfolge wie im Lane-Claims-Gate: erst belegte Merges
    // herausfiltern, dann blockieren. Sonst wuerde der Start an Lanes
    // scheitern, die das Gate laengst als gemergt behandelt.
    const collisions = filterMergedCollisions({
      collisions: findCollisions(claim, claims).filter((collision) => !reconciledLanes.has(collision.lane)),
      claims,
      prIndex,
      onMerged: (collision, evidence) => {
        notes.push(`${collision.lane}: ${evidence.why}; als merged behandelt (Register nachziehen)`);
      },
    });
    if (collisions.length > 0) {
      blockers.push(`[ERR-4019] Lane-Kollisionen: ${collisions.map((entry) => `${entry.lane} (${entry.reason || 'Contract'})`).join('; ')}; erst Claim oder Pfade entzerren`);
    }
  }

  return { contextData, contextFile, reconcile, automation, nextActionsHint };
}
