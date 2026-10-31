/**
 * @test-target: scripts/lib/release-escalation.mjs
 * @error-code: ERR-4008
 *
 * Umgebungsprobleme muessen automatisch eine Stufe hoeher gehen, statt als
 * nackte 403 zu enden -- und ohne hinterlegtes Token sichtbar blockieren.
 */
import { describe, expect, it } from 'vitest';
import { blockedReason, classifyFailure, escalate, LEVELS, tokenFor } from '../../../../scripts/lib/release-escalation.mjs';

describe('Release-Eskalation', () => {
  it('unterscheidet Rechte, Wiederholbarkeit und bestehende Ziele', () => {
    expect(classifyFailure('HTTP 403: Resource not accessible by integration')).toBe('PERMISSION');
    expect(classifyFailure('HTTP 422 Validation Failed: Reference already exists')).toBe('EXISTS');
    expect(classifyFailure('socket hang up')).toBe('TRANSIENT');
    expect(classifyFailure('ETIMEDOUT')).toBe('TRANSIENT');
    expect(classifyFailure('irgendwas anderes')).toBe('UNKNOWN');
  });

  it('steigt nur mit hinterlegtem Token auf die naechste Stufe', () => {
    expect(escalate('WORKFLOW_TOKEN', 'PERMISSION', { hasElevatedToken: true })).toBe('RELEASE_TOKEN');
    expect(escalate('WORKFLOW_TOKEN', 'PERMISSION', { hasElevatedToken: false })).toBe('BLOCKED');
    expect(escalate('RELEASE_TOKEN', 'PERMISSION', { hasElevatedToken: true })).toBe('BLOCKED');
    expect(escalate('WORKFLOW_TOKEN', 'EXISTS')).toBe('DONE');
    expect(escalate('WORKFLOW_TOKEN', 'TRANSIENT')).toBe('WORKFLOW_TOKEN');
    expect(LEVELS).toContain('BLOCKED');
  });

  it('waehlt das Token der Stufe und nennt die fehlende Einstellung', () => {
    expect(tokenFor('WORKFLOW_TOKEN', { GITHUB_TOKEN: 'a', RELEASE_TOKEN: 'b' })).toBe('a');
    expect(tokenFor('RELEASE_TOKEN', { GITHUB_TOKEN: 'a', RELEASE_TOKEN: 'b' })).toBe('b');
    expect(tokenFor('BLOCKED', { GITHUB_TOKEN: 'a' })).toBe('');
    expect(blockedReason('PERMISSION')).toMatch(/Workflow permissions/);
    expect(blockedReason('TRANSIENT')).toMatch(/Versuchen/);
  });
});
