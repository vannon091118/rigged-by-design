/**
 * Fixture-Identitaet fuer Tests, die `pretask` als Kindprozess starten.
 *
 * Seit #605 ist eine fehlende Worker-Identitaet ein harter Blocker. Tests, die
 * echte Arbeit ohne Identitaet fahren, brauchen deshalb ein Workspace-Home mit
 * gueltiger `identity.json`; die Datei entsteht einmal pro Prozess in einem
 * Temp-Verzeichnis und wird ueber `RBD_WORKSPACE_HOME` durchgereicht.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let cached: string | null = null;

function home(): string {
  if (cached) return cached;
  const dir = mkdtempSync(join(tmpdir(), 'rbd-worker-home-'));
  mkdirSync(join(dir, '.lanes'), { recursive: true });
  writeFileSync(join(dir, '.lanes', 'identity.json'), `${JSON.stringify({
    schemaVersion: 1,
    identity: 'LIILITH',
    systemId: 'sys-test',
    workspaceId: 'ws-test',
    repository: 'vannon091118/rigged-by-design',
    sessionId: 'sess-test',
    claimId: 'idc-test',
    commentRef: 'https://example.invalid/604#issuecomment-1',
    reservedAt: '2026-11-14T00:00:00Z',
    activeIssue: null,
    branch: null,
    mainSha: '0000000',
    status: 'ACTIVE',
  }, null, 2)}\n`);
  cached = dir;
  return dir;
}

/** Env-Fragment fuer Spawns: gueltige Identitaet im Temp-Home. */
export function workerEnv(): NodeJS.ProcessEnv {
  return { RBD_WORKSPACE_HOME: home() };
}
