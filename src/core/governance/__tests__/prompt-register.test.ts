/**
 * @test-target: scripts/lib/prompt-register.mjs
 * @error-code: ERR-4017
 *
 * #885: Jeder Prompt mit Verhaltenswirkung hat ein Board-Issue. Der Test
 * haelt die Registerform, die Board-Form und die Abdeckung fest, damit ein
 * neuer `.cron`-Prompt ohne Issue rot wird statt still zu bleiben.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PROMPT_REGISTER_FILE, parsePromptRegister, promptProblems, summarizePromptIssues,
} from '../../../../scripts/lib/prompt-register.mjs';

const ROW = (prompt: string, kind: string, severity: string, issue: string) =>
  `| ${prompt} | \`${prompt}\` | ${kind} | ${severity} | ${issue} |`;

describe('Prompt-Register (#885)', () => {
  it('liest nur echte Registerzeilen', () => {
    const text = [
      '| Prompt | Pfad | Art | Sev | Issue |',
      '| --- | --- | --- | --- | --- |',
      ROW('.cron/maintainer-prompt.md', 'datei', 'sev-1', '#892'),
      '| Fremd | ohne Backticks | datei | sev-1 | #1 |',
      '| Andere Tabelle | `x` | unbekannt | sev-1 | #2 |',
    ].join('\n');
    const entries = parsePromptRegister(text);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      prompt: '.cron/maintainer-prompt.md', kind: 'datei', severity: 'sev-1', issue: 892,
    });
  });

  it('meldet fehlendes Issue, fehlenden Schweregrad und fehlende Datei', () => {
    const text = [ROW('AGENTS.md', 'datei', 'sev-2', '-'), ROW('docs/GOVERNANCE.md', 'datei', 'hoch', '#889')].join('\n');
    const problems = promptProblems({ text, fileExists: (path: string) => path !== 'docs/GOVERNANCE.md' });
    expect(problems.join('\n')).toContain('AGENTS.md hat kein Board-Issue');
    expect(problems.join('\n')).toContain('docs/GOVERNANCE.md hat keinen Schweregrad');
    expect(problems.join('\n')).toContain('docs/GOVERNANCE.md ist registriert, existiert aber nicht');
  });

  it('verlangt jede .cron-Datei und die beiden Pflichtprompts', () => {
    const text = [ROW('AGENTS.md', 'datei', 'sev-2', '#891'), ROW('docs/GOVERNANCE.md', 'datei', 'sev-1', '#889')].join('\n');
    const problems = promptProblems({ text, cronFiles: ['.cron/maintainer-prompt.md', '.cron/SECURITY.md'] });
    expect(problems).toEqual([
      `${PROMPT_REGISTER_FILE}: .cron/maintainer-prompt.md ist nicht registriert.`,
      `${PROMPT_REGISTER_FILE}: .cron/SECURITY.md ist nicht registriert.`,
    ]);
    expect(promptProblems({ text })).toEqual([]);
  });

  it('fehlt das Register, ist der Befund das Register selbst', () => {
    expect(promptProblems({ text: null })).toEqual([`${PROMPT_REGISTER_FILE}: Prompt-Register fehlt.`]);
    expect(promptProblems({ text: '| Prompt | Pfad | Art | Sev | Issue |\n' })).toHaveLength(1);
  });

  it('sortiert die Board-Form nach Issue und laesst Unbelegtes weg', () => {
    const summarized = summarizePromptIssues([
      { issue: 893, prompt: 'scheduled/main-prompt', severity: 'sev-1', kind: 'external' },
      { issue: null, prompt: 'ohne-issue.md', severity: 'sev-2', kind: 'datei' },
      { issue: 889, prompt: 'docs/GOVERNANCE.md', severity: 'sev-1', kind: 'datei' },
    ]);
    expect(summarized.map((entry: { issue: number }) => entry.issue)).toEqual([889, 893]);
  });

  it('ist im echten Baum abgedeckt', () => {
    const root = process.cwd();
    const text = readFileSync(resolve(root, PROMPT_REGISTER_FILE), 'utf8');
    const cronFiles = ['.cron/SECURITY.md', '.cron/maintainer-prompt.md'];
    expect(promptProblems({ text, cronFiles })).toEqual([]);
    expect(parsePromptRegister(text).length).toBe(5);
  });
});
