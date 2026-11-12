/**
 * @test-target: content/narrative/contributions
 * @error-code: ERR-2001
 *
 * Spieltexte duerfen ohne Kenntnis des Repos verstaendlich sein. Dieser Test
 * haelt die 2026-11-11 bereinigten Beitraege frei von Governance-Vokabular und
 * verhindert, dass ein Claim, Merge oder Gate als Weltbeobachtung zurueckkehrt.
 * Die Wortgrenzen sind Unicode-fest, damit "pruefen" nicht als "PR" zaehlt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const DIR = join(ROOT, 'content', 'narrative', 'contributions');
const GOVERNANCE =
  /(?<![\p{L}\p{N}])(Claims?|Merge|Squash|CI|Gates?|Lane|PR|Commit|Branch|Register(stand)?|Task|Agent(en)? [0-9]|Sprint)(?![\p{L}\p{N}])/iu;

const files = readdirSync(DIR).filter((file) => file.endsWith('.json'));

const textOf = (file: string): string => {
  const parsed = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as { text?: string };
  return parsed.text ?? '';
};

describe('Narrative: Welttexte ohne Governance-Sprache', () => {
  it('nennt in keinem Beitrag einen Repo-Vorgang', () => {
    const guilty = files
      .filter((file) => GOVERNANCE.test(textOf(file)))
      .map((file) => `${file}: ${textOf(file)}`);
    expect(guilty).toEqual([]);
  });

  it('laesst keinen Beitrag ohne Text zurueck', () => {
    const empty = files.filter((file) => textOf(file).trim().length === 0);
    expect(empty).toEqual([]);
  });
});
