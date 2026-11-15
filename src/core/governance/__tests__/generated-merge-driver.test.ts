/**
 * @test-target: scripts/merge-driver-generated.mjs
 * @error-code: ERR-4019
 *
 * Generierte Artefakte duerfen Konflikte nicht verhandeln, aber auch nicht
 * blind ueberschreiben: der Driver loest nur registrierte Pfade auf, laesst
 * Handdateien offen und verweigert Konfliktmarker in der eigenen Fassung.
 * Regeneriert wird erst nach dem Merge. Der letzte Test faehrt deshalb einen
 * echten `git merge` samt post-merge-Hook in einem Fixture-Repo.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRIVER_NAME,
  classifyDriverPath,
  driverCommand,
  hasConflictMarkers,
  parseDriverArgs,
  resolveGeneratedConflict,
} from '../../../../scripts/merge-driver-generated.mjs';
import { GENERATED_PATHS } from '../../../../scripts/lib/generated-files.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const DRIVER = resolve(ROOT, 'scripts', 'merge-driver-generated.mjs');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}

describe('Merge-Driver fuer generierte Artefakte (#877)', () => {
  it('weist in .gitattributes jeden generierten Pfad dem Driver zu', () => {
    const attributes = readFileSync(join(ROOT, '.gitattributes'), 'utf8');
    for (const path of GENERATED_PATHS) {
      expect(attributes).toContain(`${path} merge=${DRIVER_NAME}`);
    }
  });

  it('liest die git-Argumente %O %A %B %P in fester Reihenfolge', () => {
    expect(parseDriverArgs(['base', 'ours', 'theirs', 'docs/INVENTORY.md'])).toEqual({
      base: 'base',
      ours: 'ours',
      theirs: 'theirs',
      path: 'docs/INVENTORY.md',
    });
    expect(parseDriverArgs(['b', 'a']).path).toBe('');
  });

  it('nennt den registrierbaren Driver-Befehl mit allen Platzhaltern', () => {
    const command = driverCommand({ node: '/usr/bin/node', script: 'scripts/merge-driver-generated.mjs' });
    expect(command).toBe('"/usr/bin/node" scripts/merge-driver-generated.mjs %O %A %B %P');
  });

  it('akzeptiert nur generierte Pfade und lehnt Handdateien ab', () => {
    expect(classifyDriverPath('docs/INVENTORY.md')).toEqual({
      accepted: true,
      owner: 'scripts/build-inventory.mjs',
    });
    expect(classifyDriverPath('src/core/sim/world.ts').accepted).toBe(false);
    expect(classifyDriverPath('src\\store\\world-store.ts').accepted).toBe(false);
  });

  it('erkennt Konfliktmarker in der eigenen Fassung', () => {
    expect(hasConflictMarkers('<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> lane\n')).toBe(true);
    expect(hasConflictMarkers('- `a.ts` — Zweck — gelesen: 3 Zeilen\n')).toBe(false);
  });

  it('uebernimmt die eigene Fassung eines generierten Artefakts konfliktfrei', () => {
    const result = resolveGeneratedConflict({
      path: 'docs/INVENTORY.md',
      ours: '/tmp/inventory-ours.md',
      read: () => '# Inventur\n\n- `a.ts` — Zweck — gelesen: 3 Zeilen\n',
    });
    expect(result.ok).toBe(true);
    expect(result.owner).toBe('scripts/build-inventory.mjs');
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('laesst den Konflikt offen, wenn die eigene Fassung Konfliktmarker traegt', () => {
    const result = resolveGeneratedConflict({
      path: 'docs/INVENTORY.md',
      ours: '/tmp/inventory-ours.md',
      read: () => '<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> lane\n',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Konfliktmarker');
  });

  it('loest Handdateien nie automatisch auf', () => {
    const result = resolveGeneratedConflict({ path: 'src/core/sim/world.ts', ours: '/tmp/world.ts' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Handdatei');
  });

  it('loest einen echten git-merge-Konflikt auf und regeneriert danach aus den Quellen', () => {
    const repo = mkdtempSync(join(tmpdir(), 'rbd-merge-driver-'));
    mkdirSync(join(repo, 'docs'), { recursive: true });
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    mkdirSync(join(repo, 'src'), { recursive: true });
    mkdirSync(join(repo, '.githooks'), { recursive: true });

    writeFileSync(join(repo, '.gitattributes'), `docs/INVENTORY.md merge=${DRIVER_NAME}\n`);
    // Minimaler Generator: die Inventur entsteht aus src/flag.txt.
    writeFileSync(
      join(repo, 'scripts', 'sync-generated.mjs'),
      [
        "import { readFileSync, writeFileSync } from 'node:fs';",
        "const flag = readFileSync('src/flag.txt', 'utf8').trim();",
        "writeFileSync('docs/INVENTORY.md', `# Inventur\\n\\nflag: ${flag}\\n`);",
        '',
      ].join('\n'),
    );
    writeFileSync(join(repo, 'src', 'flag.txt'), 'base\n');
    writeFileSync(join(repo, 'docs', 'INVENTORY.md'), '# Inventur\n\nflag: base\n');
    copyFileSync(join(ROOT, '.githooks', 'post-merge'), join(repo, '.githooks', 'post-merge'));
    chmodSync(join(repo, '.githooks', 'post-merge'), 0o755);

    git(repo, ['init', '-q']);
    git(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'Test']);
    git(repo, ['config', 'core.hooksPath', '.githooks']);
    git(repo, ['config', `merge.${DRIVER_NAME}.name`, 'generierte Artefakte']);
    git(repo, ['config', `merge.${DRIVER_NAME}.driver`, `"${process.execPath}" "${DRIVER}" %O %A %B %P`]);
    git(repo, ['add', '.']);
    git(repo, ['commit', '-q', '-m', 'base']);

    git(repo, ['checkout', '-q', '-b', 'lane']);
    writeFileSync(join(repo, 'src', 'flag.txt'), 'lane\n');
    writeFileSync(join(repo, 'docs', 'INVENTORY.md'), '# Inventur\n\nflag: lane-edit\n');
    git(repo, ['commit', '-q', '-am', 'lane']);

    git(repo, ['checkout', '-q', 'main']);
    writeFileSync(join(repo, 'docs', 'INVENTORY.md'), '# Inventur\n\nflag: main-edit\n');
    git(repo, ['commit', '-q', '-am', 'main']);

    const merged = git(repo, ['merge', '--no-edit', 'lane']);
    expect(merged).toContain('Merge made by');

    const inventory = readFileSync(join(repo, 'docs', 'INVENTORY.md'), 'utf8');
    expect(inventory).toBe('# Inventur\n\nflag: lane\n');
    expect(hasConflictMarkers(inventory)).toBe(false);
    expect(git(repo, ['status', '--porcelain'])).toBe('');
  });
});
