/**
 * @test-target: scripts/lib/process-sweep.mjs
 * @error-code: ERR-0911
 *
 * Der Abbruchpfad muss echte Prozesse beenden und die Registry raeumen; sonst
 * bleiben nach Strg+C npm-/vitest-Waisen liegen, die die naechsten Gates bremsen.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAlive, killTracked, killTree, processIdentity, releaseOwner, sweepOrphans, trackPid } from '../../../../scripts/lib/process-sweep.mjs';
import { createStop, EXIT_ABORTED } from '../../../../scripts/lib/pipeline-stop.mjs';

const stateDir = mkdtempSync(join(tmpdir(), 'rbd-sweep-'));
process.env.RBD_VERIFY_STATE = stateDir;
const statePath = join(stateDir, 'running.json');

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sleeper(): { child: ChildProcess; pid: number } {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  const pid = child.pid;
  if (!pid) throw new Error('Kindprozess ohne PID gestartet');
  return { child, pid };
}

async function isDead(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (!isAlive(pid)) return true;
    await wait(25);
  }
  return !isAlive(pid);
}

async function identityOf(pid: number): Promise<string | null> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const start = processIdentity(pid);
    if (start) return start;
    await wait(25);
  }
  return null;
}

afterAll(() => {
  releaseOwner();
  rmSync(stateDir, { recursive: true, force: true });
  delete process.env.RBD_VERIFY_STATE;
});

describe('Abbruchpfad', () => {
  it('killTree beendet einen laufenden Prozess', async () => {
    const { pid } = sleeper();
    expect(isAlive(pid)).toBe(true);
    expect(killTree(pid)).toBe(true);
    expect(await isDead(pid)).toBe(true);
  });

  it('killTracked beendet alle registrierten Prozesse', async () => {
    const first = sleeper();
    const second = sleeper();
    trackPid('tests', first.pid);
    trackPid('build', second.pid);
    expect(killTracked()).toBe(2);
    expect(await isDead(first.pid)).toBe(true);
    expect(await isDead(second.pid)).toBe(true);
  });

  it('sweepOrphans raeumt Waisen mit totem Besitzer ab', async () => {
    const { pid } = sleeper();
    const start = await identityOf(pid);
    expect(start).not.toBeNull();
    writeFileSync(statePath, JSON.stringify({ owner: 999_999_999, pids: [{ gate: 'tests', pid, at: 0, start }] }));
    const killed = sweepOrphans();
    expect(killed.map((entry) => entry.gate)).toEqual(['tests']);
    expect(await isDead(pid)).toBe(true);
    expect(JSON.parse(readFileSync(statePath, 'utf8')).owner).toBe(process.pid);
  });

  it('erkennt eine wiederverwendete Besitzer-PID an der Startzeit', async () => {
    const owner = sleeper();
    const victim = sleeper();
    try {
      const ownerStart = await identityOf(owner.pid);
      const victimStart = await identityOf(victim.pid);
      expect(ownerStart).not.toBeNull();
      expect(victimStart).not.toBeNull();
      writeFileSync(statePath, JSON.stringify({
        owner: owner.pid,
        ownerStart: `${ownerStart}:fremde-startzeit`,
        pids: [{ gate: 'tests', pid: victim.pid, at: 0, start: victimStart }],
      }));
      const killed = sweepOrphans();
      expect(killed.map((entry) => entry.gate)).toEqual(['tests']);
      expect(await isDead(victim.pid)).toBe(true);
    } finally {
      killTree(owner.pid);
      killTree(victim.pid);
    }
  });

  it('beendet keinen Prozess, dessen PID inzwischen eine andere Startzeit hat', async () => {
    const { pid } = sleeper();
    try {
      const start = await identityOf(pid);
      expect(start).not.toBeNull();
      writeFileSync(statePath, JSON.stringify({ owner: 999_999_999, pids: [{ gate: 'tests', pid, at: 0, start: 'wiederverwendete-pid' }] }));
      const killed = sweepOrphans();
      expect(killed).toEqual([]);
      expect(isAlive(pid)).toBe(true);
    } finally {
      killTree(pid);
    }
  });

  it('beendet bei SIGINT alles, raeumt die Registry und meldet 130', async () => {
    const { pid } = sleeper();
    trackPid('tests', pid);
    const exitCodes: number[] = [];
    const messages: string[] = [];
    const stop = createStop({ exit: (code) => exitCodes.push(code), log: (message) => messages.push(message) });
    stop('SIGINT');
    expect(exitCodes).toEqual([EXIT_ABORTED]);
    expect(messages[0]).toContain('SIGINT');
    expect(await isDead(pid)).toBe(true);
    expect(existsSync(statePath)).toBe(false);
  });
});
