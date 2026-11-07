/**
 * @test-target: scripts/
 * @error-code: ERR-4019
 *
 * Ein Resume ist kein Aufraeumen: kein Produktionsskript darf fremde Arbeit
 * oder den eigenen Verlauf mit reset --hard, clean -fd, Stash-Mutation,
 * Force-Push oder branch -D verwerfen. Der Scan ist statisch und liest nur.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Forbidden {
  readonly name: string;
  readonly pattern: RegExp;
}

const FORBIDDEN: readonly Forbidden[] = [
  { name: 'reset --hard', pattern: /\breset\b[^\n]{0,48}['"]--hard['"]/ },
  { name: 'clean -fd', pattern: /\bclean\b[^\n]{0,48}['"]-[a-z]*f[a-z]*['"]/ },
  { name: 'stash mutation', pattern: /\bstash\b[^\n]{0,48}['"](?:push|save|apply|pop|drop|clear)['"]/ },
  { name: 'push --force', pattern: /\bpush\b[^\n]{0,64}['"]--force(?:-with-lease)?['"]/ },
  { name: 'branch -D', pattern: /\bbranch\b[^\n]{0,48}['"]-D['"]/ },
];

const scriptRoot = resolve(process.cwd(), 'scripts');

function scriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return scriptFiles(path);
    return path.endsWith('.mjs') ? [path] : [];
  });
}

function scan(text: string): string[] {
  return FORBIDDEN.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
}

describe('destruktive Git-Befehle', () => {
  it('erkennt die verbotenen Kommandos und laesst harmlose Varianten zu', () => {
    expect(scan("git(['reset', '--hard', 'origin/main']);")).toContain('reset --hard');
    expect(scan("git(['clean', '-fd']);")).toContain('clean -fd');
    expect(scan("git(['stash', 'push']);")).toContain('stash mutation');
    expect(scan("git(['push', '--force', 'origin', 'HEAD']);")).toContain('push --force');
    expect(scan("git(['branch', '-D', 'lane/x']);")).toContain('branch -D');
    expect(scan("git(['branch', '-d', 'lane/x']);")).toEqual([]);
    expect(scan("git(['checkout', '--ours', '--', file]);")).toEqual([]);
  });

  it('findet keinen Verstoss in den Produktionsskripten', () => {
    const findings: string[] = [];
    for (const file of scriptFiles(scriptRoot)) {
      for (const rule of scan(readFileSync(file, 'utf8'))) {
        findings.push(`${relative(process.cwd(), file)}: ${rule}`);
      }
    }
    expect(findings).toEqual([]);
  });
});
