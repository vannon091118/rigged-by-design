/**
 * Pflichtlektuere als Receipt: sieben Kerne, ein Hash je Dokument, ein Budget.
 *
 * Der 10k-Vertrag ist ein Lesepfad. Wer `rbd docs read` ausfuehrt, bekommt die
 * fuenf Pflichtdokus vollstaendig und die Test-/Governance-Kerne; danach
 * arbeitet der PreToolUse-Hook nur weiter, solange genau dieser Stand gelesen
 * wurde. Aendert sich ein Kern, wird das Receipt stale und der Hook verlangt
 * einen erneuten Lesevorgang. Kein Git-Hook haengt daran: der Lesepfad darf
 * den Commit-/Push-Ablauf nicht bremsen.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  READING_DOCS,
  READING_TOKEN_BUDGET,
  budgetedText,
  countTokens,
} from './doc-core.mjs';
import { ROOT } from './report.mjs';

export const RECEIPT_PATH = '.verify-cache/doc-read.json';
export const RECEIPT_VERSION = 1;
/** Ein Lesebefehl, zwei Clients (Claude-Hook und guarded Shell). */
export const DOC_READ_COMMAND = /^(?:pnpm\s+)?rbd\s+docs\s+read(?:\s|$)|^node\s+scripts\/doc-audit\.mjs\s+--read(?:\s|$)/;

/** Ein Lesebefehl gilt nur ungekürzt und ungepillt als Pflichtlektuere. */
export function isDocReadCommand(command) {
  const line = String(command ?? '').trim();
  return DOC_READ_COMMAND.test(line) && !/[|>]/.test(line);
}
/** Eine Gate-Ausgabe, die durch diese Pipe ihren Exit-Status verliert. */
export const LOSSY_PIPE = /\|\s*(?:head|tail|grep|sed|awk|wc)\b/;

const hash = (text) => createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');

/** Die budgetierten Inhalte und Hashes des Lesepfads. */
export function readingEntries(root = ROOT) {
  return READING_DOCS.map((doc) => {
    let text = null;
    try {
      text = readFileSync(join(root, doc.path), 'utf8');
    } catch {
      // Fehlt der Kern, bleibt das Receipt ungueltig; der Aufrufer nennt den Pfad.
    }
    const body = text === null ? '' : (budgetedText(doc, text) ?? '');
    const tokens = countTokens(body);
    return {
      path: doc.path,
      title: doc.title,
      scope: doc.scope,
      body,
      hash: hash(body),
      tokens,
      ok: text !== null && body !== '' && tokens <= 500,
    };
  });
}

/** Der vollstaendige Lesepfad; die Summe ist die belegte 10k-Zahl. */
export function readingBudget(root = ROOT) {
  const entries = readingEntries(root);
  const tokens = entries.reduce((sum, entry) => sum + entry.tokens, 0);
  return {
    entries,
    tokens,
    budget: READING_TOKEN_BUDGET,
    ok: entries.every((entry) => entry.ok) && tokens <= READING_TOKEN_BUDGET,
  };
}

/** Der Text, den ein Agent vor dem ersten Edit liest. */
export function readingText(root = ROOT) {
  const report = readingBudget(root);
  const header = [
    `Pflichtlektuere · ${report.entries.length} Dokumente · ${report.tokens}/${report.budget} Token`,
    'Lies diese Kerne. Tiefe nur fuer den konkreten Auftrag; keine unnoetigen Volldokumente.',
  ].join('\n');
  const body = report.entries
    .map((entry) => `\n\n===== ${entry.path} · ${entry.tokens} Token =====\n\n${entry.body.trim()}`)
    .join('');
  return `${header}${body}\n`;
}

/** Receipt schreiben; bei Budget- oder Kernverstoss wird nichts geschrieben. */
export function writeReceipt(root = ROOT) {
  const report = readingBudget(root);
  if (!report.ok) return { ok: false, ...report };
  const path = join(root, RECEIPT_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const docs = Object.fromEntries(report.entries.map((entry) => [entry.path, entry.hash]));
  writeFileSync(
    path,
    `${JSON.stringify({ version: RECEIPT_VERSION, budget: report.budget, tokens: report.tokens, docs }, null, 2)}\n`,
    'utf8',
  );
  return { ok: true, path, ...report };
}

function readReceipt(root) {
  const path = join(root, RECEIPT_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Fehlt das Receipt, ist es alt oder wurde ein Kern seit dem Lesen geaendert,
 * liefert diese Funktion den Grund. Leer heisst: der Lesepfad ist belegt.
 */
export function receiptProblems(root = ROOT) {
  const report = readingBudget(root);
  if (!report.ok) {
    const broken = report.entries.filter((entry) => !entry.ok).map((entry) => entry.path);
    return [
      `Lesepfad unvollstaendig: ${broken.join(', ') || 'Budget ueberschritten'} (${report.tokens}/${report.budget}).`,
    ];
  }
  const receipt = readReceipt(root);
  if (!receipt) return [`Pflichtlektuere fehlt: \`pnpm rbd docs read\` (${report.tokens}/${report.budget} Token).`];
  if (receipt.version !== RECEIPT_VERSION) return ['Lesereceipt hat eine unbekannte Version: erneut `pnpm rbd docs read`.'];
  const problems = [];
  for (const entry of report.entries) {
    if (receipt.docs?.[entry.path] !== entry.hash) {
      problems.push(`${entry.path}: seit dem Lesen geaendert (erneut \`pnpm rbd docs read\`).`);
    }
  }
  if (receipt.tokens !== report.tokens) {
    problems.push(`Lesepfad: ${receipt.tokens} statt ${report.tokens} Token im Receipt.`);
  }
  return problems;
}
