/**
 * Integration vor dem Push: Merge der veroeffentlichten Basis oder Rebase der
 * unveroeffentlichten Lane, danach Generierung und Pflege-Commit.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyConflicts } from './generated-files.mjs';
import { ROOT } from './report.mjs';

/** Generierte Artefakte, die jede Integration neu schreiben muss. */
const GENERATED_PATHS = ['docs/INVENTORY.md', 'docs/ROADMAP.md', 'content/narrative/registry', 'src/core/sim/narrative/composer'];

export function createIntegrator({ git, gitRun, fail, targetBranch }) {
  const publishedBranch = (branch) =>
    spawnSync('git', ['rev-parse', '--verify', `origin/${branch}`], { cwd: ROOT, stdio: 'ignore' }).status === 0;

  const conflictedFiles = () =>
    git(['diff', '--name-only', '--diff-filter=U']).split(/\r?\n/).filter(Boolean);

  const regenerateGenerated = () => {
    const regenerated = spawnSync(
      process.execPath,
      [resolve(ROOT, 'scripts', 'sync-generated.mjs'), '--all'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    if (regenerated.status !== 0) return false;
    if (!git(['status', '--porcelain', '--', ...GENERATED_PATHS])) return true;
    git(['add', '-A', '--', ...GENERATED_PATHS]);
    return true;
  };

  const commitRegeneration = () => {
    if (!regenerateGenerated()) return false;
    if (!git(['status', '--porcelain', '--', ...GENERATED_PATHS])) return true;
    const messageFile = resolve(ROOT, git(['rev-parse', '--git-dir']), 'TURN_REGEN_MSG');
    writeFileSync(
      messageFile,
      [
        'Regeneration nach der Integration (Inventur, Registry)',
        '',
        '### Changes (Was ist neu)',
        '- Inventur, Roadmap-Fortschritt und Runtime-Registry sind nach der integrierten Basis neu erzeugt.',
        '',
        '### Technische Basis & Kausalität',
        '- Der Merge bringt neue Dateien mit; `git ls-files` und die Registry haetten sonst einen anderen Stand als der Baum, und das Doku-Gate waere rot.',
        '',
        '### Ausblick (Nächste Schritte)',
        '- CI prueft diesen Commit; danach PR und Merge.',
        '',
      ].join('\n'),
    );
    git(['add', '-A', '--', ...GENERATED_PATHS]);
    return gitRun(['commit', '-F', messageFile]).status === 0;
  };

  const integrateBeforePush = (branch) => {
    if (publishedBranch(branch)) {
      const merged = gitRun(['merge', '--no-edit', `origin/${targetBranch}`]);
      if (merged.status !== 0) {
        const { generated, source } = classifyConflicts(conflictedFiles());
        if (source.length > 0) {
          gitRun(['merge', '--abort']);
          fail(1, 'ERR-4008', 'turn:finish', `Quellkonflikt gegen origin/${targetBranch}: ${source.slice(0, 8).join(', ')}; Commit bleibt erhalten, Konflikt manuell loesen`);
          process.exit(1);
        }
        for (const file of generated) {
          gitRun(['checkout', '--ours', '--', file]);
          gitRun(['add', '--', file]);
        }
        if (!regenerateGenerated()) {
          gitRun(['merge', '--abort']);
          fail(1, 'ERR-4008', 'turn:finish', 'Regeneration der generierten Artefakte fehlgeschlagen; Merge zurueckgesetzt');
          process.exit(1);
        }
        const continued = gitRun(['merge', '--continue']);
        if (continued.status !== 0) {
          gitRun(['merge', '--abort']);
          fail(1, 'ERR-4008', 'turn:finish', 'Merge nach der Regeneration nicht fortsetzbar; Zustand zurueckgesetzt');
          process.exit(1);
        }
      }
      if (!commitRegeneration()) {
        fail(1, 'ERR-4008', 'turn:finish', 'Regeneration nach dem Merge fehlgeschlagen; Commit bleibt erhalten, Basis integriert');
        process.exit(1);
      }
      return;
    }
    const applied = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'integrate.mjs'), '--apply', '--no-fetch'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (applied.status !== 0) {
      fail(1, 'ERR-4008', 'turn:finish', `integrate --apply nicht erfolgreich (Exit ${applied.status}); Commit bleibt erhalten`);
      process.exit(1);
    }
    if (!commitRegeneration()) {
      fail(1, 'ERR-4008', 'turn:finish', 'Regeneration nach dem Rebase fehlgeschlagen; Commit bleibt erhalten');
      process.exit(1);
    }
  };

  /** Rueckstand auf die Basis; `null` heisst: Remote nicht lesbar. */
  const behind = () => {
    if (gitRun(['fetch', 'origin']).status !== 0) return null;
    try {
      return Number(git(['rev-list', '--count', `HEAD..origin/${targetBranch}`]));
    } catch {
      return null;
    }
  };

  /** Vor dem Push: Basis integrieren, bis kein Rueckstand mehr besteht. */
  const ensureIntegrated = (branch) => {
    const rueck = behind();
    if (rueck === null) {
      fail(1, 'ERR-4008', 'turn:finish', `origin/${targetBranch} nicht lesbar; kein Push ohne Vergleich`);
      process.exit(1);
    }
    if (rueck === 0) return;
    console.log(`turn:finish: origin/${targetBranch} ist um ${rueck} Commit(s) voraus; Integration startet (` +
      `${publishedBranch(branch) ? 'Merge' : 'integrate --apply'}).`);
    integrateBeforePush(branch);
    const rest = behind();
    if (rest === null || rest > 0) {
      fail(1, 'ERR-4008', 'turn:finish', `nach der Integration noch ${rest ?? 'unbekannter'} Rueckstand auf origin/${targetBranch}; kein Push`);
      process.exit(1);
    }
  };

  return { publishedBranch, integrateBeforePush, ensureIntegrated, commitRegeneration, regenerateGenerated, conflictedFiles };
}
