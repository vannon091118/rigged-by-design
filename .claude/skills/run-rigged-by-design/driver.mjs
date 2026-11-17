#!/usr/bin/env node
// Treiber für run-rigged-by-design Skill.
// Liest den laufenden Vite-Dev-Server-Port aus dem Dev-Log und gibt ihn
// als letzten Output aus. Wenn kein Server läuft, startet er `pnpm run dev`
// im Hintergrund und wartet auf Bereitschaft.
// Die eigentliche Browser-Navigation erfolgt über die MCP-Browser-Tools.

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REPO_ROOT = process.cwd();
const LOG_FILE = join(tmpdir(), 'rigged-dev.log');

function log(msg) {
  process.stdout.write(`[run-rigged-by-design] ${msg}\n`);
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
}

function viteBinExists() {
  return existsSync(`${REPO_ROOT}\\node_modules\\.bin\\vite`)
    || existsSync(`${REPO_ROOT}\\node_modules\\.bin\\vite.cmd`);
}

function findPortInLog() {
  try {
    const content = stripAnsi(readFileSync(LOG_FILE, 'utf-8'));
    const matches = content.matchAll(/http:\/\/localhost:(\d+)\//g);
    const ports = Array.from(matches, (m) => m[1]);
    if (ports.length > 0) {
      return ports[ports.length - 1];
    }
  } catch {
    // Log-Datei existiert noch nicht
  }
  return null;
}

function waitForServer(timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = setInterval(() => {
      const port = findPortInLog();
      if (port) {
        clearInterval(poll);
        resolve(port);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        reject(new Error(`Server nicht bereit nach ${timeoutMs}ms`));
      }
    }, 500);
  });
}

async function main() {
  // 1. Prüfen, ob vite installiert ist
  if (!viteBinExists()) {
    log('Vite NICHT gefunden. Führe zuerst: pnpm install');
    process.exit(1);
  }
  log('Vite ist installiert.');
  log(`Log-Datei: ${LOG_FILE}`);

  // 2. Prüfen, ob der Server bereits läuft
  let existingPort = findPortInLog();
  if (existingPort) {
    log(`Server läuft bereits auf Port ${existingPort}.`);
    console.log(existingPort);
    return;
  }

  // 3. Dev-Server im Hintergrund starten (shell=true für pnpm-CMD unter Windows)
  log('Starte Vite Dev-Server im Hintergrund...');
  const child = spawn('pnpm.cmd', ['run', 'dev'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    shell: true,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.unref();

  // 4. Warten bis der Server bereit ist
  log('Warte auf Server-Bereitschaft...');
  const port = await waitForServer();
  log(`Server bereit auf http://localhost:${port}/`);
  console.log(port); // letzter Output: Port für aufrufenden Agenten
}

main().catch((err) => {
  log(`FEHLER: ${err.message}`);
  process.exit(1);
});
