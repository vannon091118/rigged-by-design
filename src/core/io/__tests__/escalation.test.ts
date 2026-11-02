/**
 * @test-target: src/core/io/issues.ts
 * @error-code: ERR-5001
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../../governance/error-codes';
import { ESCALATION_LEVELS, escalationFor, issue } from '../issues';

const ROOT = process.cwd();

describe('Eskalationsleiter und Import-Befund', () => {
  it('haelt die TypeScript-Leiter und die geteilte Datei deckungsgleich', () => {
    const shared = JSON.parse(readFileSync(resolve(ROOT, 'src/Config/escalation-levels.json'), 'utf8')) as string[];
    expect(shared).toEqual([...ESCALATION_LEVELS]);
  });

  it('nennt im Import-Befund den registrierten Code statt eines Literals', () => {
    expect(issue('FATAL', 'world', 'Welt kaputt').code).toBe(ERROR_CODES.TRANSFER_INVALID.code);
  });

  it('uebersetzt jeden Befund in genau eine Stufe der Leiter', () => {
    const levels = ['FATAL', 'REPAIR', 'IGNORE'] as const;
    expect(levels.map((level) => escalationFor(level))).toEqual(['BLOCKED', 'AUTO_FIX', 'LOCAL_GATE']);
  });
});
