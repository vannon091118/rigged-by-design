/**
 * @test-target: src/store/shot-guard.ts
 * @error-code: ERR-1005
 *
 * Guard fuer Screenshot-Saat: bestehende Dateien werden nicht stillschweigend
 * überschrieben, Löschung braucht explizites Bestätigungs-Flag.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { shotFiles, shotExists, writeShot, deleteShot } from '../shot-guard';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_FILE = 'shot-guard-test.json';
const SHOT_DIR = path.join(process.cwd(), '.shot-data');

beforeEach(() => {
  try { fs.unlinkSync(path.join(SHOT_DIR, TEST_FILE)); } catch {}
});

afterEach(() => {
  try { fs.unlinkSync(path.join(SHOT_DIR, TEST_FILE)); } catch {}
});

describe('Shot-Guard', () => {
  it('schreibt eine neue Datei und gibt true zurück', () => {
    const ok = writeShot(TEST_FILE, { world: 'SMALL', tick: 4 });
    expect(ok).toBe(true);
    expect(shotExists(TEST_FILE)).toBe(true);
    const files = shotFiles();
    expect(files).toContain(TEST_FILE);
  });

  it('überschreibt eine bestehende Datei nicht', () => {
    writeShot(TEST_FILE, { first: true });
    const ok = writeShot(TEST_FILE, { second: true });
    expect(ok).toBe(false);
    const content = JSON.parse(fs.readFileSync(path.join(SHOT_DIR, TEST_FILE), 'utf-8'));
    expect(content.first).toBe(true);
    expect(content.second).toBeUndefined();
  });

  it('löscht nicht ohne confirm=true', () => {
    writeShot(TEST_FILE, { x: 1 });
    const ok = deleteShot(TEST_FILE, false);
    expect(ok).toBe(false);
    expect(shotExists(TEST_FILE)).toBe(true);
  });

  it('löscht mit confirm=true', () => {
    writeShot(TEST_FILE, { x: 1 });
    const ok = deleteShot(TEST_FILE, true);
    expect(ok).toBe(true);
    expect(shotExists(TEST_FILE)).toBe(false);
  });
});
