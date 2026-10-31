/** Fuehrt unabhaengige Gates parallel aus, puffert ihre Ausgabe und nutzt den Inhalts-Cache. */
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { line, ROOT } from './report.mjs';
import { dropCached, isCached, markCached, treeKey } from './gate-cache.mjs';
import { killTracked, killTree, releaseOwner, trackPid, untrackPid } from './process-sweep.mjs';

const MAX_WORKERS = Math.max(1, Number(process.env.RBD_VERIFY_WORKERS) || Math.max(2, Math.min(4, availableParallelism() - 1)));
const running = new Set();

/** Fuehrt eine Stufe aus und traegt ihre PID ein, damit der Abbruchpfad sie findet. */
export function executeStep(step) {
  const started = Date.now();
  const command = step.command === 'npm' ? 'npm' : process.execPath;
  const args = step.command === 'npm' ? ['run', step.script] : [step.script, ...(step.args ?? [])];
  return new Promise((done) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: command === 'npm' && process.platform === 'win32',
      // Eigene Prozessgruppe: damit SIGINT/SIGKILL die ganze npm->vitest-Kette trifft.
      detached: process.platform !== 'win32',
      // Profile geben Umgebungsvariablen weiter, etwa das schnelle Test-Profil.
      env: { ...process.env, ...(step.env ?? {}) },
    });
    let output = '';
    if (child.pid) {
      running.add(child.pid);
      trackPid(step.name, child.pid);
    }
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (status) => {
      if (child.pid) {
        running.delete(child.pid);
        untrackPid(child.pid);
      }
      done({ status, output, ms: Date.now() - started });
    });
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

/** Jede rote Gate bleibt rot; gruene Gates werden nur bei identischem Hash uebersprungen. */
export async function runGates(steps) {
  const queue = [...steps];
  const key = treeKey();
  const failed = [];
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
      if (result.output.trim()) {
        const tail = result.output.endsWith('\n') ? '' : '\n';
        process.stdout.write(`=== Gate: ${step.name} (${(result.ms / 1000).toFixed(1)}s) ===\n${result.output}${tail}`);
      }
      if (result.status !== 0) {
        dropCached(step.name);
        failed.push(step.name);
        index += 1;
        console.error(line(index, step.code, `pipeline/${step.name}`, 'Gate fehlgeschlagen; Details oben'));
        continue;
      }
      if (step.cache) markCached(step.name, gateKey);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_WORKERS, queue.length) }, worker));
  return failed;
}
