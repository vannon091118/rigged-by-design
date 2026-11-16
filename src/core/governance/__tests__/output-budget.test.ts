/**
 * @test-target: scripts/lib/compact.mjs
 * @error-code: ERR-4019
 *
 * Der Ausgabe-Vertrag der Agenten-Werkzeuge: sichtbar bleiben hoechstens 500
 * Token, aber kein Zustand darf verschwinden. Der Test prueft genau die drei
 * Zusagen, auf die sich Hooks und Agenten verlassen: die Obergrenze haelt, ein
 * roter Befund und der naechste Befehl ueberleben, und der gekuerzte Bericht
 * nennt das vollstaendige Log.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { budgetText, logsEnabled, estimateTokens, TOKEN_BUDGET } from '../../../../scripts/lib/compact.mjs';

const REPORT = [
  'verify:light: rein lesend, kein Gate schreibt Dateien',
  '',
  '[gate] check:loc: PASS (0.3s)',
  ...Array.from({ length: 40 }, (_, index) => `  detail ${index}: irgendein langer Zwischenstand ohne Zustand`),
  '[gate] typecheck: PASS (6.1s)',
  '[IDX-0001] [ERR-4028] pipeline/generated: Gate fehlgeschlagen',
  'verify:light: 1 Gate(s) rot',
  '  -> pnpm run sync-generated',
].join('\n');

describe('Log-Schalter', () => {
  it('erlaubt Logs nur mit --log', () => {
    expect(logsEnabled(['verify', 'light'])).toBe(false);
    expect(logsEnabled(['verify', 'light', '--log'])).toBe(true);
  });

  it('verweist ohne Log auf den Schalter statt auf einen Pfad', () => {
    const out = budgetText(REPORT, { label: 'verify' });
    expect(out).toContain('vollstaendig mit --log');
    expect(out).not.toContain('.verify-cache');
  });
});

describe('Ausgabe-Budget der Agenten-Werkzeuge', () => {
  it('laesst kurze Berichte unveraendert', () => {
    const short = 'pretask: Branch lane/x · Modus GO\n  Claim lane/x\n  -> pnpm run turn:finish';
    expect(budgetText(short, { label: 'pretask', logPath: '/tmp/pretask.log' })).toBe(short);
    expect(estimateTokens(short)).toBeLessThan(TOKEN_BUDGET);
  });

  it('haelt die Obergrenze und behaelt Status, Befund und naechsten Befehl', () => {
    const logPath = join(mkdtempSync(join(tmpdir(), 'rbd-budget-')), 'verify.log');
    writeFileSync(logPath, REPORT, 'utf8');
    const out = budgetText(REPORT, { label: 'verify', logPath });
    expect(estimateTokens(out)).toBeLessThanOrEqual(TOKEN_BUDGET);
    expect(out).toContain('ERR-4028');
    expect(out).toContain('PASS');
    expect(out).toContain('pnpm run sync-generated');
    expect(out).toContain('Gate(s) rot');
    expect(out).toContain(logPath);
  });

  it('verweist nicht auf einen Logpfad ohne Datei', () => {
    const out = budgetText(REPORT, { label: 'verify', logPath: join(tmpdir(), 'rbd-gibt-es-nicht.log') });
    expect(out).toContain('vollstaendig mit --log');
    expect(out).not.toContain('rbd-gibt-es-nicht.log');
  });

  it('nennt die Zahl der ausgelassenen Zeilen', () => {
    const out = budgetText(REPORT, { label: 'verify', logPath: 'log.txt' });
    expect(out).toMatch(/… \d+ Zeile\(n\) gekuerzt/);
    expect(out).not.toContain('detail 7:');
  });

  it('schaetzt konservativ: nie weniger Token als Woerter', () => {
    const text = 'Ein Satz mit sieben Woertern und Umlauten: ä ö ü ß';
    const words = text.trim().split(/\s+/).length;
    expect(estimateTokens(text)).toBeGreaterThanOrEqual(words);
  });
});
