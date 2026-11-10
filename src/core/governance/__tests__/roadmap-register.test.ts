/**
 * @test-target: docs/ROADMAP.md
 * @error-code: ERR-4017
 *
 * Das Register in `docs/ROADMAP.md` ist die einzige Liste offener Punkte. Damit
 * es nicht wieder einen Stand behauptet, den der Code schon widerlegt, prueft
 * dieser Test die Struktur: Statusvokabular, eindeutige IDs, aufloesbare
 * Referenzen (Datei, Symbol, Commit) und die Fortschrittszahl gegen die
 * kompilierte Registry. Die inhaltliche Behauptung "offen" gegen bereits
 * gemergten Code kann ein Dokumenten-Gate nicht entscheiden; deshalb muss jeder
 * geschlossene Punkt seinen Code und seinen Test nennen - und genau diese
 * Referenzen muessen existieren.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const STATUS = ['offen', 'verifiziert', 'erledigt', 'gemergt', 'zurueckgestellt', 'blockiert'];
const CLOSED = new Set(['verifiziert', 'erledigt', 'gemergt']);
const CODE = /\.(ts|tsx|mjs)$/;

type RegisterRow = { id: string; point: string; status: string; evidence: string };

const roadmap = readFileSync(join(ROOT, 'docs', 'ROADMAP.md'), 'utf8');
const start = roadmap.indexOf('### Offene Stellen');
const end = roadmap.indexOf('#### PARKED', start);
const register = start >= 0 && end > start ? roadmap.slice(start, end) : '';
const rows: RegisterRow[] = register
  .split('\n')
  .filter((line) => /^\|\s*P-\d+\s*\|/.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return { id: cells[0] ?? '', point: cells[1] ?? '', status: cells[2] ?? '', evidence: cells[3] ?? '' };
  });

const statusToken = (row: RegisterRow): string =>
  /^[a-z]+/.exec(row.status.replaceAll('*', '').trim())?.[0] ?? '';

const codeFiles: string[] = [];
const collect = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (CODE.test(entry.name)) codeFiles.push(path);
  }
};
collect(join(ROOT, 'src'));
collect(join(ROOT, 'scripts'));
const corpus = codeFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

// Hermetisch: Ohne git-Repo (z. B. Quell-Zip ohne .git) faellt der Test nicht
// um, sondern prueft gegen den Dateibaum und meldet jede ausgelassene
// Commit-Pruefung laut. In shallow Klonen gilt dasselbe fuer SHAs ausserhalb
// der geladenen Historie. In vollen Klonen bleibt ein fehlender Commit ein
// echter Befund.
const gitState = ((): { repo: boolean; shallow: boolean } => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'ignore' });
    const shallow =
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim() === 'true';
    return { repo: true, shallow };
  } catch {
    console.warn(
      'Roadmap-Register-Hinweis: kein git-Repo gefunden - Dateireferenzen werden gegen den Dateibaum ' +
        'geprueft, Commit-SHAs sind hier nicht nachpruefbar und werden als ungeprueft gemeldet.',
    );
    return { repo: false, shallow: false };
  }
})();

const tracked = ((): string[] => {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  } catch {
    return codeFiles;
  }
})();
const basenames = new Set(tracked.map((file) => basename(file)));

const skippedCommits: string[] = [];
const commitExists = (sha: string): boolean => {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    if (!gitState.repo || gitState.shallow) {
      skippedCommits.push(sha);
      return true;
    }
    return false;
  }
};

const resolves = (raw: string): boolean => {
  // Reine Zahlen sind CI-Lauf-IDs; sie sind offline nicht nachpruefbar und
  // bleiben als Belegart ausdruecklich erlaubt.
  if (/^\d{6,}$/.test(raw)) return true;
  if (/^[0-9a-f]{7,40}$/.test(raw)) return commitExists(raw);
  const clean = raw.replace(/:\d+$/, '');
  if (existsSync(join(ROOT, clean))) return true;
  const filePart = clean.split(/[#(]/)[0] ?? '';
  if (basenames.has(basename(filePart))) return true;
  const symbol = /[A-Za-z_$][\w$]*/.exec(clean)?.[0];
  return Boolean(symbol && corpus.includes(symbol));
};

const isCodeReference = (raw: string): boolean => {
  const clean = raw.replace(/:\d+$/, '').split(/[#(]/)[0] ?? '';
  if (CODE.test(clean)) return true;
  const symbol = /[A-Za-z_$][\w$]*/.exec(clean)?.[0];
  return Boolean(symbol && corpus.includes(symbol));
};

const references = (evidence: string): string[] => [...evidence.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');

describe('Roadmap-Register', () => {
  it('fuehrt jede offene Stelle genau einmal und ohne Luecke in der Nummerierung', () => {
    expect(register.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(10);
    const numbers = rows.map((row) => Number(row.id.slice(2)));
    expect(new Set(numbers).size).toBe(numbers.length);
    const sorted = [...new Set(numbers)].sort((left, right) => left - right);
    expect(sorted).toEqual(Array.from({ length: sorted.length }, (_, index) => index + 1));
    for (const row of rows) expect(row.point.length, `${row.id} ohne Punkt`).toBeGreaterThan(3);
  });

  it('gibt jedem Eintrag ein Statusvokabular statt freier Behauptungen', () => {
    for (const row of rows) {
      expect(STATUS, `${row.id}: Status "${row.status}"`).toContain(statusToken(row));
      expect(row.evidence.length, `${row.id} ohne Beleg`).toBeGreaterThan(3);
    }
  });

  it('nennt nur Referenzen, die im Repo tatsaechlich existieren', () => {
    const broken = rows.flatMap((row) =>
      references(row.evidence)
        .filter((reference) => !resolves(reference))
        .map((reference) => `${row.id}: ${reference}`),
    );
    if (skippedCommits.length > 0) {
      console.warn(
        `Roadmap-Register-Hinweis: ${skippedCommits.length} Commit-SHA(s) konnten in diesem Klon nicht ` +
          `nachgeprueft werden (kein Repo oder shallow): ${[...new Set(skippedCommits)].slice(0, 5).join(', ')}` +
          (skippedCommits.length > 5 ? ' ...' : '') +
          ' - kein Beleg, nur ungeprueft.',
      );
    }
    expect(broken).toEqual([]);
  });

  it('belegt jeden geschlossenen Punkt mit Code und nicht nur mit Prosa', () => {
    const closed = rows.filter((row) => CLOSED.has(statusToken(row)));
    expect(closed.length).toBeGreaterThan(3);
    const withoutCode = closed
      .filter((row) => !references(row.evidence).some((reference) => isCodeReference(reference)))
      .map((row) => row.id);
    expect(withoutCode).toEqual([]);
  });

  it('zieht die Fortschrittszahl aus der kompilierten Registry, nicht aus dem Gefuehl', () => {
    const row = rows.find((entry) => entry.id === 'P-13');
    expect(statusToken(row ?? { id: '', point: '', status: '', evidence: '' }).startsWith('offen')).toBe(true);
    const compiled = JSON.parse(
      readFileSync(join(ROOT, 'content', 'narrative', 'registry', 'fragments.json'), 'utf8'),
    ) as { fragments: unknown[] };
    const measured = /(\d+)\s*\/\s*1500/.exec(row?.point ?? '')?.[1];
    expect(Number(measured)).toBe(compiled.fragments.length);
  });

  it('fuehrt die Kante Beziehungen -> Ruf als verifiziert und belegt sie am Code', () => {
    const row = rows.find((entry) => entry.id === 'P-12');
    expect(statusToken(row ?? { id: '', point: '', status: '', evidence: '' }).startsWith('verifiziert')).toBe(true);
    const cited = references(row?.evidence ?? '');
    expect(cited).toEqual(
      expect.arrayContaining([
        'src/core/sim/narrative/relationships.ts',
        'src/core/sim/spawn.ts',
        'src/core/sim/__tests__/reputation.test.ts',
      ]),
    );
    expect(row?.evidence).toContain('relationshipStanding');
  });
});
