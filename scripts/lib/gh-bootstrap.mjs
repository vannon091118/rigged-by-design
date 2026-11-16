/**
 * `gh` bereitstellen, ohne Workflow und ohne Nutzer-Eingriff.
 *
 * Die Credential-Kette endet bei `gh auth token`. Fehlt die CLI, laedt dieses
 * Modul sie aus dem offiziellen Release nach `~/.local/bin` (kein sudo, kein
 * Systempaket) und meldet den Pfad. Danach fehlt nur noch `gh auth login`.
 *
 * Abschaltbar mit `RBD_NO_GH_INSTALL=1`; Zielverzeichnis ueber `RBD_GH_DIR`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** Der Name, unter dem `gh` gesucht wird. */
export function ghBinary() {
  return process.env.RBD_GH_BIN || 'gh';
}

/** Ist `gh` da? Reine Lese-Probe mit Timeout. */
export function ghStatus() {
  try {
    const version = execFileSync(ghBinary(), ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n')[0];
    return { present: true, version, path: ghBinary() };
  } catch {
    return { present: false, version: null, path: null };
  }
}

/** Zielverzeichnis: benutzereigen, damit kein sudo noetig ist. */
export function ghTargetDir() {
  return process.env.RBD_GH_DIR || join(homedir(), '.local', 'bin');
}

/**
 * SHA256 einer Datei — die einzige Pruefung, die einen ungepruefte Installation
 * ausschliesst. Fehlt die Pruefsumme im Release, wird nicht installiert.
 */
export function sha256OfFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Erwartete Pruefsumme aus `gh_<version>_checksums.txt`; `null`, wenn nicht belegbar. */
export function expectedChecksum({ version, file }) {
  try {
    const text = execFileSync('curl', ['-fsSL', '--max-time', '60',
      `https://github.com/cli/cli/releases/download/v${version}/gh_${version}_checksums.txt`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 65000,
    });
    const line = text.split('\n').find((entry) => entry.trim().endsWith(`  ${file}`) || entry.trim().endsWith(` *${file}`));
    const hash = line ? line.trim().split(/\s+/)[0] : '';
    return /^[0-9a-f]{64}$/i.test(hash) ? hash.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Laedt `gh` aus dem offiziellen Release; ohne Pruefsumme wird abgebrochen. */
export function installGh({ version = process.env.RBD_GH_VERSION || '2.63.2' } = {}) {
  if (process.env.RBD_NO_GH_INSTALL === '1') {
    return { ok: false, skipped: true, reason: 'RBD_NO_GH_INSTALL=1' };
  }
  if (process.platform !== 'linux') {
    return { ok: false, reason: `automatischer Download nur unter Linux (hier: ${process.platform})` };
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const file = `gh_${version}_linux_${arch}.tar.gz`;
  const url = `https://github.com/cli/cli/releases/download/v${version}/${file}`;
  const dir = ghTargetDir();
  const work = join(tmpdir(), `rbd-gh-${process.pid}`);
  try {
    mkdirSync(dir, { recursive: true });
    mkdirSync(work, { recursive: true });
    execFileSync('curl', ['-fsSL', '--max-time', '120', url, '-o', join(work, file)], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 130000,
    });
    const expected = expectedChecksum({ version, file });
    if (!expected) {
      return { ok: false, verified: false, reason: `keine Pruefsumme fuer ${file} verfuegbar; Installation abgebrochen`, url };
    }
    const actual = sha256OfFile(join(work, file));
    if (actual !== expected) {
      return { ok: false, verified: false, reason: `Pruefsumme weicht ab (${actual.slice(0, 12)} != ${expected.slice(0, 12)})`, url };
    }
    execFileSync('tar', ['-xzf', join(work, file), '-C', work], { stdio: 'ignore', timeout: 60000 });
    const source = join(work, `gh_${version}_linux_${arch}`, 'bin', 'gh');
    if (!existsSync(source)) throw new Error(`Archiv enthaelt ${source} nicht`);
    const target = join(dir, 'gh');
    // copy statt rename: /tmp und $HOME koennen auf verschiedenen Dateisystemen liegen.
    copyFileSync(source, target);
    chmodSync(target, 0o755);
    return { ok: true, verified: true, checksum: expected, path: target, url, version };
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error).split('\n')[0].slice(0, 160), url };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Kontext fuer den naechsten Schritt: vorhanden, nachgeladen oder fehlend. */
export function ensureGh({ install = true } = {}) {
  const before = ghStatus();
  if (before.present) return { ...before, attempted: false };
  const result = install ? installGh() : { ok: false, skipped: true, reason: 'Download nicht angefordert' };
  if (result.ok) {
    // Dieselbe Prozess-Sitzung soll die frische CLI sofort finden, ohne dass
    // der Nutzer die Shell neu startet.
    const dir = ghTargetDir();
    if (!(process.env.PATH ?? '').split(':').includes(dir)) {
      process.env.PATH = `${dir}:${process.env.PATH ?? ''}`;
    }
    return { present: true, version: result.version, path: result.path, attempted: true, install: result };
  }
  const after = ghStatus();
  return { ...after, attempted: true, install: result };
}
