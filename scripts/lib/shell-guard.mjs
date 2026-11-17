/**
 * Die Regeln der guarded Shell, ohne Bash und ohne Seiteneffekt.
 *
 * Die Shell ist die zweite Ebene neben dem Claude-PreToolUse-Hook: sie sitzt
 * im interaktiven Agenten-Terminal und prueft die Werkzeuge, die dort wirklich
 * getippt werden. Vor dem Lesepfad ist nur `rbd docs read` erlaubt; danach
 * bleiben destructives Git, `main`-Push, Agenten-Merge und verlustreiche
 * Gate-Pipes gesperrt. Jeder Verstoss wird gezaehlt, damit der Watcher ihn
 * sichtbar eskalieren kann.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LOSSY_PIPE, isDocReadCommand, receiptProblems } from './doc-read.mjs';
import { ROOT } from './report.mjs';

export const GUARD_STATE_PATH = '.verify-cache/shell-guard.json';
export const GUARD_LOG_PATH = '.verify-cache/shell-guard.log';

const GATE = /^(?:pnpm|npm|npx|rbd|vitest|node\s+(?:scripts|bin)\/)/;

/** Immer gesperrt, auch mit gueltigem Receipt. */
const FORBIDDEN = [
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard ist verboten; WIP adoptieren.'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'git clean ist verboten; fremde Dateien bleiben.'],
  [/\bgit\s+stash\b/, 'git stash ist verboten; WIP bleibt im Baum.'],
  [/\bgit\s+push\s+--force\b/, 'Force-Push ist verboten.'],
  [ /\bgit\s+push\b[^\n]*\b(?:origin\s+)?main(?:\s|$)/, 'Direktpush auf main ist verboten; Branch + PR.'],
  [/\bgit\s+branch\s+-D\b/, 'Branch-Loeschung mit -D ist verboten.'],
  [/\bgh\s+pr\s+merge\b/, 'Agenten mergen nicht; der Maintainer merged.'],
  [/\bgh\s+issue\s+(?:close|reopen)\b/, 'Agenten schliessen keine Issues.'],
];

const ALLOW = Object.freeze({ decision: 'allow' });

function deny(reason, code) {
  return { decision: 'deny', reason, code };
}

/** Entscheidung fuer genau eine getippte Zeile. */
export function shellGuardDecision({ command = '', root = ROOT } = {}) {
  const line = String(command ?? '').replace(/\s+/g, ' ').trim();
  if (line === '') return ALLOW;

  for (const [pattern, reason] of FORBIDDEN) {
    if (pattern.test(line)) return deny(reason, 'FORBIDDEN');
  }

  const receipt = receiptProblems(root);
  if (receipt.length > 0) {
    if (isDocReadCommand(line)) return ALLOW;
    return deny(`Pflichtlektuere fehlt/veraltet. ${receipt[0]} Starte \`pnpm rbd docs read\`.`, 'DOC_READ');
  }

  if (GATE.test(line) && LOSSY_PIPE.test(line)) {
    return deny('Gate-/Testausgabe nicht durch head/tail/grep pipen: der Exit-Status geht verloren.', 'LOSSY_PIPE');
  }
  return ALLOW;
}

function readState(root) {
  try {
    return JSON.parse(readFileSync(join(root, GUARD_STATE_PATH), 'utf8'));
  } catch {
    return { count: 0, last: null };
  }
}

/** Verstoss zaehlen und als eine Zeile im Log halten. */
export function recordViolation({ root = ROOT, command = '', reason = '', code = 'DENY' } = {}) {
  const state = readState(root);
  const next = {
    count: Number(state.count ?? 0) + 1,
    last: { code, reason: String(reason).slice(0, 240), command: String(command).slice(0, 240) },
  };
  const path = join(root, GUARD_STATE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  writeFileSync(join(root, GUARD_LOG_PATH), `${JSON.stringify(next.last)}\n`, { encoding: 'utf8', flag: 'a' });
  return next;
}

/** Der Watcher liest nur diese eine Zeile; sie bleibt klein und parsefrei. */
export function guardStatusLine(root = ROOT) {
  const receipt = receiptProblems(root);
  const state = readState(root);
  if (receipt.length > 0) return `ROT · ${receipt[0]} · Verstoesse ${state.count}`;
  if (state.count > 0) return `INFO · Lesepfad gueltig · Verstoesse ${state.count} · letzter: ${state.last?.code ?? ''}`;
  return 'OK · Lesepfad gueltig · 0 Verstoesse';
}

export function guardState(root = ROOT) {
  return { ...readState(root), receipt: receiptProblems(root) };
}

export { existsSync };
