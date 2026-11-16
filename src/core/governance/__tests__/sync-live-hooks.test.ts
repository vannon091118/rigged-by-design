/**
 * @test-target: scripts/lib/sync-hooks.mjs
 * @error-code: ERR-4019
 *
 * „Alle Sync-Befehle fragen live ab" ist mechanisch: der Test liest die
 * Sync-Routen aus der Befehlsoberflaeche und verlangt in jeder Datei den
 * Aufruf `reportLiveHooks`. Ein neuer Sync-Befehl ohne Live-Abfrage wird rot.
 * Die Zeilenformate sind mit injiziertem Status geprueft, ohne Netz.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS as RAW_COMMANDS } from '../../../../scripts/lib/command-surface.mjs';
import { liveHookLine as rawLiveHookLine } from '../../../../scripts/lib/sync-hooks.mjs';

type Route = { group: string; verb: string; run: readonly string[] };
type HookState = {
  ok: boolean;
  active: number;
  events: string[];
  url: string;
  error?: string;
  step?: string;
};

const ROOT = resolve(process.cwd());
const COMMANDS = RAW_COMMANDS as unknown as readonly Route[];
const liveHookLine = rawLiveHookLine as unknown as (input?: { status?: HookState }) => string;

const SYNC_ROUTES = COMMANDS.filter((command) => command.group === 'sync' || command.verb === 'sync');

describe('Live-Hook-Abfrage in Sync-Befehlen', () => {
  it('findet die Sync-Befehle in der Oberflaeche', () => {
    expect(SYNC_ROUTES.length).toBeGreaterThanOrEqual(3);
    expect(SYNC_ROUTES.map((route) => `${route.group} ${route.verb}`)).toContain('board sync');
  });

  it('verlangt die Live-Abfrage in jeder Sync-Datei', () => {
    for (const route of SYNC_ROUTES) {
      const source = readFileSync(join(ROOT, String(route.run[0] ?? '')), 'utf8');
      expect(source.includes('reportLiveHooks'), `${route.group} ${route.verb} fragt keine Hooks ab`).toBe(true);
    }
  });

  it('nennt den Live-Stand, wenn Hooks aktiv sind', () => {
    const line = liveHookLine({
      status: { ok: true, active: 2, events: ['issues', 'issue_comment'], url: 'https://example.test/hook' },
    });
    expect(line).toContain('live 2 aktiv');
    expect(line).toContain('https://example.test/hook');
  });

  it('nennt Grund und Anlegebefehl, wenn die Abfrage scheitert', () => {
    const line = liveHookLine({
      status: { ok: false, active: 0, events: [], url: '', error: 'HTTP 403', step: 'Hook anlegen mit x' },
    });
    expect(line).toContain('HTTP 403');
    expect(line).toContain('Hook anlegen mit x');
  });

  it('verschweigt einen fehlenden Hook nicht', () => {
    const line = liveHookLine({ status: { ok: false, active: 0, events: [], url: '', step: 'Hook fehlt' } });
    expect(line).toContain('live 0 aktiv');
    expect(line).toContain('Hook fehlt');
  });
});
