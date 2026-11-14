/**
 * @test-target: scripts/lib/workspace-home.mjs
 * @error-code: ERR-4027
 *
 * Das Workspace-Home liegt ausserhalb des Repositories. Ueber Laufwerksgrenzen
 * (Windows `C:` -> `D:`) liefert `path.relative()` einen absoluten Pfad; ohne
 * diese Unterscheidung gilt das Home als Unterpfad des Repos und
 * `worker:init -- claim` verweigert die Reservierung.
 */
import { describe, expect, it } from 'vitest';
import { isInsideRepository, workspaceHome } from '../../../../scripts/lib/workspace-home.mjs';

const win32 = process.platform === 'win32';

describe('isInsideRepository', () => {
  it('erkennt einen Unterpfad als innen', () => {
    const repo = win32 ? 'D:\\Projekte\\rigged-by-design' : '/repo';
    const inside = win32
      ? 'D:\\Projekte\\rigged-by-design\\.lanes\\identity.json'
      : '/repo/.lanes/identity.json';
    expect(isInsideRepository(inside, repo)).toBe(true);
  });

  it('erkennt ein Geschwisterverzeichnis als aussen', () => {
    const repo = win32 ? 'D:\\Projekte\\rigged-by-design' : '/repo';
    const sibling = win32 ? 'D:\\Projekte\\rbd-workspace' : '/rbd-workspace';
    expect(isInsideRepository(sibling, repo)).toBe(false);
  });

  it('erkennt ein Home auf einem anderen Laufwerk als aussen', () => {
    const repo = win32 ? 'D:\\Projekte\\rigged-by-design' : '/repo';
    const home = win32 ? 'C:\\Users\\vanno\\.rbd-workspace' : '/workspace';
    expect(isInsideRepository(home, repo)).toBe(false);
  });

  it('leitet das Standard-Home nie aus dem Repo ab', () => {
    const home = workspaceHome({ RBD_WORKSPACE_HOME: '' });
    expect(isInsideRepository(home, process.cwd())).toBe(false);
  });
});
