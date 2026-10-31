/**
 * Fuehrt unabhaengige Gates parallel aus, puffert ihre Ausgabe und nutzt den Inhalts-Cache.
 *
 * Die Konsole traegt das Ergebnis, nicht die Bleiwueste: jedes Gate schreibt sein
 * vollstaendiges Log in den Berichtsordner, ausgegeben wird im Erfolgsfall eine
 * Zeile und im Fehlerfall dessen Ende. `RBD_VERIFY_VERBOSE=1` gibt alles aus.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, relative } from 'node:path';
import { line, ROOT } from './report.mjs';
import { dropCached, isCached, markCached, treeKey } from './gate-cache.mjs';
import { killTracked, killTree, releaseOwner, trackPid, untrackPid } from './process-sweep.mjs';

const MAX_WORKERS = Math.max(1, Number(process.env.RBD_VERIFY_WORKERS) || Math.max(2, Math.min(4, availableParallelism() - 1)));
const running = new Set();
const DEFAULT_GATE_TIMEOUT_MS = 15 * 60_000;
const FAILURE_TAIL_LINES = 40;
const VERBOSE = process.env.RBD_VERIFY_VERBOSE === '1';

let reportDir;
/**
 * Berichtsordner fuer Logs und Zusammenfassung. Er liegt im Cache, nicht im
 * Arbeitsbaum: Verify bleibt lesend, und das Gitignor hält ihn aus jedem Hash.
 */
function reports() {
  if (reportDir !== undefined) return reportDir;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = process.env.RBD_VERIFY_REPORTS ?? join(ROOT, '.verify-cache', 'reports', stamp);
  try {
    mkdirSync(dir, { recursive: true });
    reportDir = dir;
  } catch {
    reportDir = null;
  }
  return reportDir;
}

function saveLog(name, body) {
  const dir = reports();
  if (!dir) return null;
  const file = join(dir, `${name.replace(/[^a-zA-Z0-9._-]/g, '-')}.log`);
  try {
    writeFileSync(file, body);
    return relative(ROOT, file).replaceAll('\\', '/');
  } catch {
    return null;
  }
}

function tail(text, lines = FAILURE_TAIL_LINES) {
  const all = text.trimEnd().split(/\r?\n/);
  return all.length <= lines ? all.join('\n') : [...all.slice(0, 2), `… (${all.length - lines} Zeilen ausgelassen)`, ...all.slice(-lines)].join('\n');
}

/** Fuehrt eine Stufe aus und traegt ihre PID ein, damit der Abbruchpfad sie findet. */
export function executeStep(step) {
  const started = Date.now();
  const command = step.command === 'npm' ? 'npm' : process.execPath;
  const args = step.command === 'npm' ? ['run', step.script] : [step.script, ...(step.args ?? [])];
  const timeoutMs = Number.isFinite(step.timeoutMs) && step.timeoutMs > 0 ? step.timeoutMs : DEFAULT_GATE_TIMEOUT_MS;
  return new Promise((done) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: ROOT,
        shell: command === 'npm' && process.platform === 'win32',
        // Eigene Prozessgruppe: damit SIGINT/SIGKILL die ganze npm->vitest-Kette trifft.
        detached: process.platform !== 'win32',
        // Profile geben Umgebungsvariablen weiter, etwa das schnelle Test-Profil.
        env: { ...process.env, ...(step.env ?? {}) },
      });
    } catch (error) {
      done({ status: null, output: String(error), ms: Date.now() - started, timedOut: false, timeoutMs });
      return;
    }
    let output = '';
    let timedOut = false;
    let settled = false;
    let timer;
    let forceTimer;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      if (child.pid) {
        running.delete(child.pid);
        untrackPid(child.pid);
      }
      done({
        status: timedOut ? 124 : status,
        output,
        ms: Date.now() - started,
        timedOut,
        timeoutMs,
      });
    };
    // Das Limit wird direkt nach dem Spawn gesetzt; die Registry-Pflege folgt
    // danach und darf den Timer nicht erst verzoegert aufziehen.
    timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
      // Falls taskkill oder ein Prozess die Schliessung verzoegert, bleibt die
      // Pipeline nicht am Gate haengen. Zweiter Kill fuer den Prozessbaum.
      forceTimer = setTimeout(() => {
        if (child.pid) killTree(child.pid);
        finish(null);
      }, 5_000);
    }, timeoutMs);
    if (child.pid) {
      running.add(child.pid);
      // Eine nicht schreibbare Registry darf das Gate nicht zum Absturz bringen;
      // der Abbruchpfad findet den Prozess dann nur ueber die laufende Menge.
      try {
        trackPid(step.name, child.pid);
      } catch {
        // Registry ist Komfort, nicht die Pruefung selbst.
      }
    }
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (status) => finish(status));
    child.on('error', () => finish(null));
  });
}

/** Bricht alle laufenden Gates ab und uebergibt einen sauberen Registry-Stand. */
export function abortGates() {
  running.clear();
  killTracked();
  releaseOwner();
}

// Auch bei Absturz oder process.exit duerfen keine npm/vitest-Kinder ueberleben.
process.on('exit', () => {
  for (const pid of running) killTree(pid);
});

/** Zusammenfassung als Markdown: eine Zeile je Gate, mit Pfad zum vollen Log. */
function summarize(rows, failed) {
  const dir = reports();
  if (!dir || rows.length === 0) return;
  const lines = [
    '# Gate-Bericht',
    '',
    `Erstellt: ${new Date().toISOString()}`,
    `Ergebnis: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.join(', ')})`}`,
    '',
    '| Gate | Ergebnis | Dauer | Log |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.name} | ${row.status} | ${row.seconds}s | ${row.logPath ? `\`${row.logPath}\`` : '—'} |`),
  ];
  try {
    writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
    console.log(`Gate-Bericht: ${relative(ROOT, dir).replaceAll('\\', '/')}/summary.md`);
  } catch {
    // Der Bericht ist Komfort; das Gate-Ergebnis haengt nicht daran.
  }
}

/** Jede rote Gate bleibt rot; gruene Gates werden nur bei identischem Hash uebersprungen. */
export async function runGates(steps) {
  const queue = [...steps];
  const key = treeKey();
  const failed = [];
  const rows = [];
  let index = 0;
  const worker = async () => {
    for (let step = queue.shift(); step; step = queue.shift()) {
      // Der Cache-Key traegt das Profil mit: ein gruener Schnellauslauf der Suite darf
      // den Vollauslauf mit RTP-, Balance- und Soak-Nachweisen niemals ersetzen.
      const gateKey = `${key}\0${JSON.stringify(step.env ?? {})}`;
      const reused = step.cache && isCached(step.name, gateKey) && (step.ready?.() ?? true);
      if (reused) {
        console.log(`[cached] ${step.name} uebersprungen, Baum unveraendert (${key.slice(0, 8)})`);
        continue;
      }
      const result = await executeStep(step);
      const seconds = (result.ms / 1000).toFixed(1);
      const status = result.timedOut ? 'TIMEOUT' : result.status === 0 ? 'PASS' : 'FAIL';
      const logPath = saveLog(
        step.name,
        `# ${step.name} ${status} (${seconds}s)\n# ${step.command} ${[step.script, ...(step.args ?? [])].join(' ')}\n\n${result.output}`,
      );
      rows.push({ name: step.name, status, seconds, logPath });
      if (VERBOSE && result.output.trim()) {
        const newline = result.output.endsWith('\n') ? '' : '\n';
        process.stdout.write(`=== Gate: ${step.name} (${seconds}s) ===\n${result.output}${newline}`);
      }
      if (result.timedOut) {
        dropCached(step.name);
        failed.push(step.name);
        index += 1;
        const limit = result.timeoutMs >= 1000 ? `${(result.timeoutMs / 1000).toFixed(0)}s` : `${result.timeoutMs}ms`;
        if (result.output.trim()) process.stderr.write(`${tail(result.output)}\n`);
        console.error(line(index, 'ERR-4014', `pipeline/${step.name}`, `Gate nach ${limit} hart beendet`));
        continue;
      }
      if (result.status !== 0) {
        dropCached(step.name);
        failed.push(step.name);
        index += 1;
        if (result.output.trim()) process.stderr.write(`${tail(result.output)}\n`);
        const where = logPath ? `; vollstaendiges Log: ${logPath}` : '';
        console.error(line(index, step.code, `pipeline/${step.name}`, `Gate fehlgeschlagen${where}`));
        continue;
      }
      console.log(`[gate] ${step.name}: PASS (${seconds}s)${logPath ? ` -> ${logPath}` : ''}`);
      if (step.cache) markCached(step.name, gateKey);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_WORKERS, queue.length) }, worker));
  summarize(rows, failed);
  return failed;
}
