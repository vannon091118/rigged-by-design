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
import { parseHooks as rawParseHooks } from '../../../../scripts/lib/webhook-status.mjs';

type Route = { group: string; verb: string; run: readonly string[] };
type HookState = {
  ok: boolean;
  reachable?: boolean;
  authenticated?: boolean;
  tokenSource?: string | null;
  active: number;
  events: string[];
  url: string;
  error?: string;
  step?: string;
};

const ROOT = resolve(process.cwd());
const COMMANDS = RAW_COMMANDS as unknown as readonly Route[];
const liveHookLine = rawLiveHookLine as unknown as (input?: { status?: HookState }) => string;
const parseHooks = rawParseHooks as unknown as (data: unknown) => Array<{
  id: number;
  active: boolean;
  events: string[];
  url: string;
  lastResponse: string;
}>;
/** Echte Antwort von GET /repos/vannon091118/Pipelie_Run/hooks (2026-11-16). */
const REAL_HOOKS = JSON.parse(
  readFileSync(join(ROOT, 'docs/evidence/github-hooks-pipelie-run-2026-11-16.json'), 'utf8'),
) as unknown;

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

  it('liest eine echte GitHub-Hook-Antwort mit aktiven Hooks, Events und Ziel-URL', () => {
    const hooks = parseHooks(REAL_HOOKS);
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.active).toBe(true);
    expect(hooks[0]?.events).toEqual(expect.arrayContaining(['pull_request', 'push']));
    expect(hooks[0]?.url).toMatch(/^https:\/\//);
  });

  it('rendert die echte Antwort als Live-Zeile', () => {
    const [hook] = parseHooks(REAL_HOOKS);
    const line = liveHookLine({
      status: {
        ok: false,
        active: 1,
        events: [String(hook?.events[0])],
        url: String(hook?.url),
        authenticated: true,
        tokenSource: 'GH_TOKEN',
        reachable: true,
        step: 'Events unvollstaendig',
      } as HookState,
    });
    expect(line).toContain('live 1 aktiv');
    expect(line).toContain('authentifiziert via GH_TOKEN');
    expect(line).toContain(String(hook?.url));
  });

  it('nennt ein erreichbares Repo ohne Hooks als null aktiv, nicht als Fehler', () => {
    const line = liveHookLine({
      status: {
        ok: false, reachable: true, authenticated: true, tokenSource: 'GH_TOKEN',
        active: 0, events: [], url: '', step: 'Hook fehlt',
      } as HookState,
    });
    expect(line).toContain('live 0 aktiv');
    expect(line).toContain('keine Hooks');
    expect(line).not.toContain('nicht abfragbar');
  });

  it('verschweigt einen fehlenden Hook nicht', () => {
    const line = liveHookLine({ status: { ok: false, active: 0, events: [], url: '', step: 'Hook fehlt' } });
    expect(line).toContain('live 0 aktiv');
    expect(line).toContain('Hook fehlt');
  });
});
