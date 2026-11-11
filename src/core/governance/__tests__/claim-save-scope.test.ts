/** @test-target: scripts/lib/lane-claims.mjs */
/** @error-code: ERR-4019 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { saveClaims } from '../../../../scripts/lib/lane-claims.mjs';

describe('claim save scope', () => {
  it('leaves unchanged claim files untouched during reconciliation saves', () => {
    expect(saveClaims).toBeTypeOf('function');
    const root = mkdtempSync(join(tmpdir(), 'rbd-claim-save-'));
    const claimsDir = join(root, '.lane-claims', 'claims');
    mkdirSync(claimsDir, { recursive: true });
    const entry = join(claimsDir, 'lane-a.json');
    const claim = { id: 'lane/a/task', branch: 'lane/a/task', status: 'open' };
    writeFileSync(entry, `${JSON.stringify(claim, null, 2)}\n`);
    writeFileSync(join(root, '.lane-claims', 'claims.json'), '[]');
    utimesSync(entry, 1, 1);
    const before = statSync(entry).mtimeMs;
    const moduleUrl = pathToFileURL(resolve('scripts/lib/lane-claims.mjs')).href;
    const runner = `import { saveClaims } from ${JSON.stringify(moduleUrl)}; saveClaims([${JSON.stringify(claim)}]);`;
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', runner], { cwd: root });
      expect(statSync(entry).mtimeMs).toBe(before);
      expect(readFileSync(entry, 'utf8')).toBe(`${JSON.stringify(claim, null, 2)}\n`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
