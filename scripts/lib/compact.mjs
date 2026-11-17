import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { logFilePath } from './verify-state.mjs';

/**
 * Kompakte Werkzeugausgabe: eine Bildschirmseite statt eines Logs.
 *
 * Der Agent soll aus einer Ausgabe den Befund, die Ursache, den Fix und den
 * Repro-Befehl lesen koennen - ohne Exit-Code-Raten und ohne Logsuche. Alles,
 * was nur beim Debuggen gebraucht wird, haengt an `RBD_VERBOSE=1`.
 *
 * Format ist bewusst stabil:
 *   <STATUS> · <Kopfzeile>
 *   <Feld>   <Wert>        (Feldbreite 9, ein Feld je Zeile)
 *   <Befund>              (immer sichtbar, ungekuerzt)
 *
 * Es gibt keine zweite Formatierung: `check:loc`, `agent:cause`, `pretask`,
 * `agent:context` und `verify-lane-claims` schreiben denselben Vertrag.
 */

/** Details nur auf ausdrueckliche Anforderung; Standard ist die Kurzfassung. */
export function isVerbose() {
  return process.env.RBD_VERBOSE === '1';
}

/** Ein Wert wird nie ueber die Zeilenbreite hinaus aufgeblasen. */
export function clip(value, max = 160) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const LABEL = 9;

/** Ein Feld je Zeile; leere Werte und leere Listen verschwinden. */
export function field(label, value) {
  const text = Array.isArray(value) ? value.filter(Boolean).join('; ') : value;
  if (text === undefined || text === null || String(text).trim() === '') return null;
  // Ein Trenner, damit ein neunzeichenlanges Label nicht am Wert klebt.
  return `${String(label).padEnd(LABEL)} ${clip(text)}`;
}

/**
 * Der Vertrag: Status, Kopfzeile, Fakten, Befunde, naechster Schritt.
 *
 * `facts` sind Felder, die immer erscheinen, `findings` sind Befunde, die
 * immer und ungekuerzt erscheinen; `details` nur im Verbose-Modus. Der
 * Rueckgabewert ist ein String, damit jeder Aufrufer ihn in einem
 * `console.log` ausgeben kann - keine verstreuten Einzelzeilen.
 */
export function compact({
  status = 'INFO',
  headline = '',
  facts = [],
  findings = [],
  details = [],
  maxDetails = 12,
}) {
  const lines = [`${String(status).toUpperCase()}${headline ? ` · ${clip(headline, 200)}` : ''}`];
  for (const entry of facts) {
    const line = Array.isArray(entry) ? field(entry[0], entry[1]) : entry;
    if (line) lines.push(line);
  }
  // Ein Befund ist der Grund fuer den Lauf: keine Kuerzung, kein Verbose-Zwang.
  for (const entry of findings) {
    if (entry === undefined || entry === null || String(entry).trim() === '') continue;
    lines.push(String(entry));
  }
  if (isVerbose()) {
    for (const entry of details.slice(0, maxDetails)) {
      const line = Array.isArray(entry) ? field(entry[0], entry[1]) : entry;
      if (line) lines.push(line);
    }
    const hidden = details.length - maxDetails;
    if (hidden > 0) lines.push(`${'Details'.padEnd(LABEL)}+${hidden} weitere (RBD_VERBOSE=1 zeigt sie)`);
  }
  return lines.join('\n');
}

/** Tabelle nur fuer echte Listen; eine Zeile je Eintrag, sonst nichts. */
export function table(header, rows) {
  if (!rows || rows.length === 0) return '';
  const width = Math.max(header[0].length, ...rows.map((row) => String(row[0]).length));
  const line = (cells) => cells.map((cell, index) => (index === 0 ? String(cell).padEnd(width) : String(cell))).join('  ');
  return [line(header), ...rows.map(line)].join('\n');
}

/**
 * Token-Budget: die sichtbare Antwort bleibt unter 500 Token.
 *
 * Der Vertrag gilt fuer alle Agenten-Werkzeuge (`agent:start`, `agent:pretask`,
 * Gates, Hooks, `turn:finish`). Gekuerzt wird nur Detail, nie Zustand: Status,
 * Blocker, Befunde und der naechste Befehl ueberleben, alles andere steht
 * vollstaendig im Log. `RBD_OUTPUT_FULL=1` hebt die Kappung auf; `--json` ist
 * Werkzeugformat und wird nie gekappt.
 */
export const TOKEN_BUDGET = 500;
export const FULL_ENV = 'RBD_OUTPUT_FULL';

/** Token, die der Logverweis selbst braucht (Pfad + Label). */
const POINTER_RESERVE = 60;

/** Logs entstehen nur auf Anforderung: `--log` am Befehl oder RBD_LOG=1 im Kind. */
export const LOG_FLAG = '--log';

export function logsEnabled(argv = process.argv) {
  return argv.includes(LOG_FLAG) || process.env.RBD_LOG === '1';
}

/** Konservative Obergrenze: deutsche Prosa braucht ~4 Zeichen je Token. */
export function estimateTokens(value) {
  return Math.ceil(Buffer.byteLength(String(value ?? ''), 'utf8') / 3);
}

/** Zeilen, die einen Zustand tragen, ueberleben jede Kuerzung. */
const KEEP_LINE = /(PASS|FAIL|ROT|GRUEN|GRÜN|GREEN|ERR-\d|BLOCK|READY|REBASE|CONFLICT|SKIP|\[gate\]|BLOCKIERT|status=|ok=|phase=|claim|pnpm run |node scripts\/|--brief|--json|RBD_)/i;
const HARD_LINE = /(ERR-\d|FAIL|ROT|BLOCKIERT)/;

/** Kuerzt einen Bericht auf das Budget, ohne Zustand zu verlieren. */
export function budgetText(value, { label = 'output', logPath = null, limit = TOKEN_BUDGET } = {}) {
  const raw = String(value ?? '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n').filter((entry) => entry.trim() !== '');
  // Ein Pfad ist nur dann ein Verweis, wenn die Datei existiert: sonst
  // behauptet die Antwort ein Log, das niemand geschrieben hat.
  const file = logPath && existsSync(logPath) ? logPath : null;
  const footer = file ? `vollstaendig: ${file}` : `vollstaendig mit ${LOG_FLAG}`;
  if (lines.length === 0) return `${label}: keine Ausgabe\n${footer}`;
  if (estimateTokens(raw) <= limit) return raw.replace(/\s+$/, '');
  const header = clip(lines[0], 160);
  const kept = [];
  const seen = new Set([header]);
  let hidden = 0;
  for (const entry of lines.slice(1)) {
    const trimmed = entry.trim();
    if (!KEEP_LINE.test(trimmed)) {
      hidden += 1;
      continue;
    }
    // Zeilenlayout nicht normalisieren: die Feldbreite ist Teil des Vertrags.
    const line = trimmed.length <= 150 ? trimmed : `${trimmed.slice(0, 149)}…`;
    if (seen.has(line)) continue;
    seen.add(line);
    kept.push(line);
  }
  const render = (entries, count) => [header, '', ...entries, '', `… ${count} Zeile(n) gekuerzt · ${footer}`].join('\n');
  let selected = kept.slice();
  let count = hidden;
  while (selected.length > 1 && estimateTokens(render(selected, count)) > limit) {
    const at = selected.findLastIndex((line) => !HARD_LINE.test(line));
    if (at <= 0) break;
    selected = selected.filter((_, index) => index !== at);
    count += 1;
  }
  let out = render(selected, count);
  if (estimateTokens(out) > limit) {
    // Letzte Stufe: nur harte Befunde, zeilenweise gekuerzt, von hinten
    // verworfen, bis der Vertrag haelt. Nie mitten in einer Zeile schneiden.
    const tight = selected.filter((line) => HARD_LINE.test(line)).map((line) => clip(line, 70));
    while (tight.length > 0 && estimateTokens(render(tight, count)) > limit) tight.pop();
    out = render(tight, count);
  }
  return out;
}

/** Vollstaendiges Log neben der gekuerzten Ausgabe. */
export function budgetLogPath(label) {
  // Keine Wanduhr (Determinismus-Regel): PID plus monotone Laufzeit reicht,
  // damit parallele Laeufe nicht dieselbe Logdatei ueberschreiben.
  return logFilePath(label);
}

const CAPTURED = Symbol.for('rbd.outputBudget.capture');

/**
 * Faengt die Ausgabe eines Werkzeugs ab, legt sie vollstaendig ins Log und
 * gibt beim Beenden nur den Bericht im Budget aus. Der Flush haengt an
 * `process.on('exit')`, damit auch ein Abbruch mit `process.exit(1)` gekappt
 * wird; Exit-Codes bleiben unveraendert.
 */
export function captureConsole({ label, logPath = null, enabled = true } = {}) {
  if (!enabled || process.env[FULL_ENV] === '1' || process[CAPTURED]) return { flush() {} };
  // Werkzeugformat bleibt vollstaendig: gilt fuer jeden Aufrufer, nicht nur
  // fuer den, der --json ausdruecklich weiterreicht.
  if (process.argv.includes('--json')) return { flush() {} };
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  const outChunks = [];
  const errChunks = [];
  const collect = (list) => (chunk) => {
    list.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  };
  process.stdout.write = collect(outChunks);
  process.stderr.write = collect(errChunks);
  const withLog = logsEnabled();
  let done = false;
  const flush = (code = process.exitCode ?? 0) => {
    if (done) return;
    done = true;
    process.stdout.write = stdout;
    process.stderr.write = stderr;
    const output = outChunks.join('');
    const errors = errChunks.join('');
    const full = `${output}${errors}`;
    if (full.trim() === '') return;
    // Logs nur fuer fehlerhafte Laeufe und nur mit Error Code: ein gruener
    // Lauf hinterlaesst keine Datei, auch nicht mit --log.
    const failed = code !== 0;
    const path = withLog && failed ? (logPath ?? budgetLogPath(label)) : null;
    // Zeile 1 traegt den Code, auch wenn er im Body schon vorkommt: der
    // erste Blick soll die Klassifikation zeigen, nicht die Stelle suchen.
    const errCode = /(ERR-\d{4})/.exec(full)?.[1] ?? 'ERR-4019';
    const coded = failed ? `[${errCode}] ${label} fehlgeschlagen\n${full}` : full;
    if (path) {
      try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, coded, 'utf8');
      } catch {
        // Ein nicht schreibbares Log kippt keinen Lauf; der Bericht nennt den Pfad.
      }
    }
    const written = path;
    // Passt alles ins Budget, bleiben die Strieme getrennt: stdout ist stdout,
    // stderr ist stderr, und ein Vertrag auf genau eine Zeile haelt weiter.
    if (estimateTokens(full) <= TOKEN_BUDGET - POINTER_RESERVE) {
      if (output) stdout(output.endsWith('\n') ? output : `${output}\n`);
      if (errors) stderr(errors.endsWith('\n') ? errors : `${errors}\n`);
      return;
    }
    const body = budgetText(full, { label, logPath: written, limit: TOKEN_BUDGET - POINTER_RESERVE });
    stdout(body.endsWith('\n') ? body : `${body}\n`);
  };
  process.on('exit', (code) => flush(code));
  process[CAPTURED] = true;
  return { flush };
}
