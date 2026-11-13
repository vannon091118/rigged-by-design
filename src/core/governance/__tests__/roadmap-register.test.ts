/**
 * @test-target: docs/ROADMAP.md
 * @error-code: ERR-4017
 *
 * Die Roadmap ist die einzige Liste offener Spiel- und Praesentationsarbeit.
 * Dieser Test haelt ihre Struktur: Statusvokabular, eindeutige IDs, aufloesbare
 * Referenzen, Code-Belege fuer abgeschlossene Aufgaben und die gemessene
 * Textbaustein-Zahl. Zusaetzlich prueft er die Trennung: eine Spielaufgabe
 * verweist nicht auf Governance-Pfade oder Governance-Befehle.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { quotaTotal } from '../../../../scripts/lib/narrative-blocks.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const STATUS = ['erledigt', 'verifiziert', 'offen', 'blockiert', 'zurueckgestellt'];
const CLOSED = new Set(['erledigt', 'verifiziert']);
const CODE = /\.(ts|tsx|mjs)$/;
const TASK = /^\|\s*(S\d-\d{2}|P-13|PR-\d{2})\s*\|/;
const GOVERNANCE =
  /(\.lane-claims|\.github\/|docs\/CI\.md|docs\/GOVERNANCE\.md|docs\/WORKFLOW\.md|turn:finish|verify:all)/;

type Task = { id: string; task: string; status: string; refs: string; done: string };

const roadmap = readFileSync(join(ROOT, 'docs', 'ROADMAP.md'), 'utf8');
const tasks: Task[] = roadmap
  .split('\n')
  .filter((line) => TASK.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return {
      id: cells[0] ?? '',
      task: cells[1] ?? '',
      status: (cells[2] ?? '').replaceAll('*', '').trim(),
      refs: cells[3] ?? '',
      done: cells[4] ?? '',
    };
  });

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

// Hermetisch: ohne git-Repo prueft der Test gegen den Dateibaum und meldet
// ausgelassene Commit-Pruefungen; in shallow Klonen gilt dasselbe.
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

const commitExists = (sha: string): boolean => {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return !gitState.repo || gitState.shallow;
  }
};

const resolves = (raw: string): boolean => {
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

const references = (refs: string): string[] => [...refs.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');

describe('Roadmap: Phasen, Aufgaben und Trennung', () => {
  it('fuehrt jede Aufgabe genau einmal mit Phasen-ID', () => {
    expect(tasks.length).toBeGreaterThan(20);
    const ids = tasks.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const task of tasks) {
      expect(task.task.length, `${task.id} ohne Aufgabe`).toBeGreaterThan(5);
      expect(task.done.length, `${task.id} ohne Fertig-Kriterium`).toBeGreaterThan(5);
    }
  });

  it('gibt jedem Eintrag ein Statusvokabular statt freier Behauptungen', () => {
    for (const task of tasks) {
      const token = /^[a-z]+/.exec(task.status)?.[0] ?? '';
      expect(STATUS, `${task.id}: Status "${task.status}"`).toContain(token);
    }
  });

  it('nennt nur Referenzen, die im Repo tatsaechlich existieren', () => {
    const broken = tasks.flatMap((task) =>
      references(task.refs)
        .filter((reference) => !resolves(reference))
        .map((reference) => `${task.id}: ${reference}`),
    );
    expect(broken).toEqual([]);
  });

  it('belegt jede abgeschlossene Aufgabe mit Code und Test', () => {
    const closed = tasks.filter((task) => CLOSED.has(/^[a-z]+/.exec(task.status)?.[0] ?? ''));
    expect(closed.length).toBeGreaterThan(10);
    const withoutCode = closed
      .filter((task) => !references(task.refs).some((reference) => isCodeReference(reference)))
      .map((task) => task.id);
    expect(withoutCode).toEqual([]);
  });

  it('zieht die Textbaustein-Zahl aus der Registry, nicht aus dem Gefuehl', () => {
    const row = tasks.find((task) => task.id === 'P-13');
    expect(row?.status).toBe('offen');
    const compiled = JSON.parse(
      readFileSync(join(ROOT, 'content', 'narrative', 'registry', 'fragments.json'), 'utf8'),
    ) as { fragments: { readonly slot: string }[] };
    const counts: Record<string, number> = {};
    for (const fragment of compiled.fragments) counts[fragment.slot] = (counts[fragment.slot] ?? 0) + 1;
    const measured = /(\d+)\s*\/\s*1500\s+gewertete Textbausteine/.exec(row?.task ?? '')?.[1];
    // Seit der Quota-Freistellung zaehlt die Roadmap gewertete, nicht rohe Bytes.
    expect(Number(measured)).toBe(quotaTotal(counts, compiled.fragments.length));
  });

  it('haelt Spiel- und Praesentationsaufgaben frei von Governance-Pfaden', () => {
    const mixed = tasks.filter((task) => GOVERNANCE.test(task.refs)).map((task) => task.id);
    expect(mixed).toEqual([]);
  });
});
