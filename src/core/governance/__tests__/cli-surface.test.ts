/**
 * @test-target: bin/rbd.mjs
 * @test-target-mode: process
 * @error-code: ERR-4019
 *
 * Die globale Befehlsoberflaeche ist vertraglich: jede Governance-Zeile aus
 * `package.json` hat genau eine Route `rbd <gruppe> <aktion>`, jede Route zeigt
 * auf eine existierende Datei, die Hilfe bleibt im Ausgabe-Budget, und eine
 * unbekannte Route endet mit Exit 2 und einem Vorschlag. Ein neuer Befehl ohne
 * Route macht diesen Test rot.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS, GROUP_ORDER, suggestCommand } from '../../../../scripts/lib/command-surface.mjs';

const ROOT = resolve(process.cwd());
const CLI = join(ROOT, 'bin', 'rbd.mjs');

type Route = { group: string; verb: string; run: readonly string[]; source: readonly string[] };
const ROUTES = COMMANDS as unknown as readonly Route[];
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
const PREFIXES = [
  'agent:', 'board:', 'claim:', 'reconcile:', 'verify:', 'narrative:', 'docs:', 'hooks:', 'webhook:',
  'ci:', 'turn:finish', 'task:', 'worker:', 'run:', 'pr:', 'branches:', 'inventory:', 'sync:', 'escalation:', 'gov:',
];

function routes(): Set<string> {
  return new Set(ROUTES.flatMap((command) => command.source));
}

function run(args: string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('globale Befehlsoberflaeche rbd', () => {
  it('gibt jeder Governance-Zeile aus package.json genau eine Route', () => {
    const expected = Object.keys(pkg.scripts).filter((name) => PREFIXES.some((prefix) => name.startsWith(prefix)) || ['prepare', 'fix', 'fix:all', 'catalog'].includes(name));
    const declared = [...ROUTES.flatMap((command) => command.source)];
    const missing = expected.filter((name) => !declared.includes(name));
    const duplicated = declared.filter((name, index) => declared.indexOf(name) !== index);
    expect(missing, `ohne rbd-Route: ${missing.join(', ')}`).toEqual([]);
    expect(duplicated).toEqual([]);
    expect(routes().size).toBe(declared.length);
  });

  it('zeigt jede Route auf eine existierende Datei', () => {
    for (const command of ROUTES) {
      const script = String(command.run[0] ?? '');
      expect(existsSync(join(ROOT, script)), `${command.group} ${command.verb}: ${script}`).toBe(true);
      expect(ROUTES.filter((other) => other.group === command.group && other.verb === command.verb)).toHaveLength(1);
    }
  });

  it('haelt die Hilfe im Budget und nennt jede Gruppe', () => {
    const { status, output } = run(['help']);
    expect(status).toBe(0);
    expect(Math.ceil(Buffer.byteLength(output, 'utf8') / 3)).toBeLessThanOrEqual(500);
    for (const group of GROUP_ORDER) expect(output).toContain(group);
  });

  it('zeigt eine Gruppenhilfe statt einer langen Fehlermeldung', () => {
    const { status, output } = run(['verify']);
    expect(status).toBe(2);
    expect(output).toContain('rbd verify <aktion>');
    expect(output).toContain('light');
    expect(Math.ceil(Buffer.byteLength(output, 'utf8') / 3)).toBeLessThanOrEqual(500);
  });

  it('schlaegt bei einem Tippfehler die richtige Route vor', () => {
    expect(suggestCommand('verify', 'ligth')).toBe('verify light');
    const { status, output } = run(['verify', 'ligth']);
    expect(status).toBe(2);
    expect(output).toContain('rbd verify light');
  });

  it('fuehrt eine Route aus und behaelt Exit-Code und Logverweis', () => {
    const { status, output } = run(['verify', 'tree']);
    expect(status).toBe(0);
    expect(output).toContain('verify-tree');
    expect(Math.ceil(Buffer.byteLength(output, 'utf8') / 3)).toBeLessThanOrEqual(500);
  });
});
