/**
 * Claim-Register-Ein-/Ausgabe: Optionen, Pfade, atomare Writes und Laden.
 * Die Befehle liegen in `claim-register-commands.mjs` und
 * `claim-register-maintenance.mjs`; diese Datei kennt keine Fachlogik.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { refreshBase } from './base-refresh.mjs';
import { loadClaimsStrict, validateNewClaim } from './lane-claims.mjs';

export function parseRegisterOptions(argv) {
  const options = { allow: [] };
  const booleans = new Set(['json', 'help', 'apply', 'parallel']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') continue;
    if (!token.startsWith('--')) {
      options._ = token;
      continue;
    }
    const [name, inline] = token.slice(2).split('=', 2);
    if (booleans.has(name)) {
      options[name] = true;
      continue;
    }
    const value = inline !== undefined ? inline : argv[++index];
    if (name === 'allow') {
      if (!value) throw new Error('--allow braucht einen Pfad');
      options.allow.push(...String(value).split(',').map((entry) => entry.trim()).filter(Boolean));
    } else {
      if (!value) throw new Error(`--${name} braucht einen Wert`);
      options[name] = value;
    }
  }
  return options;
}

export function makeRegisterIO({ cwd, options, fail }) {
  const claimsDir = join(cwd, '.lane-claims');
  const entriesDir = join(claimsDir, 'claims');
  const legacyFile = join(claimsDir, 'claims.json');

  function readEntries(file) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const entries = Array.isArray(data) ? data : [data];
    if (entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
      throw new Error(`Claim-Eintrag ist kein Objekt: ${file}`);
    }
    return entries;
  }

  function entryFiles() {
    const files = new Map();
    if (!existsSync(entriesDir)) return files;
    for (const name of readdirSync(entriesDir)) {
      if (!name.endsWith('.json')) continue;
      const file = join(entriesDir, name);
      for (const entry of readEntries(file)) {
        if (files.has(entry.id)) throw new Error(`Doppelter Claim '${entry.id}' in ${files.get(entry.id)} und ${file}`);
        files.set(entry.id, file);
      }
    }
    return files;
  }

  function claimFileFor(id) {
    const slug = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (!slug) fail(`Claim-ID '${id}' ergibt keinen Dateinamen`);
    return join(entriesDir, `${slug}.json`);
  }

  function writeAtomic(file, value, { overwrite = true } = {}) {
    mkdirSync(entriesDir, { recursive: true });
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (!overwrite) {
      const fd = openSync(file, 'wx');
      try {
        writeFileSync(fd, content, 'utf8');
      } finally {
        closeSync(fd);
      }
      return;
    }
    const temp = `${file}.new`;
    writeFileSync(temp, content, 'utf8');
    renameSync(temp, file);
  }

  function withLegacyLock(fn) {
    mkdirSync(claimsDir, { recursive: true });
    const lock = `${legacyFile}.lock`;
    let fd;
    try {
      fd = openSync(lock, 'wx');
    } catch {
      fail(`Legacy-Register ist gesperrt: ${lock}`);
    }
    try {
      return fn();
    } finally {
      closeSync(fd);
      try {
        unlinkSync(lock);
      } catch {
        // Ein bereits entfernter Lock ist kein zweiter Fehler.
      }
    }
  }

  function loadForCommand() {
    if (!existsSync(legacyFile) && !existsSync(entriesDir)) return [];
    try {
      return loadClaimsStrict();
    } catch (error) {
      fail(`Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
    }
  }

  function baseSha() {
    if (options.base) return options.base;
    const refreshed = refreshBase({ cwd });
    if (refreshed.sha) return refreshed.sha;
    try {
      return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    } catch {
      fail('keine Basis: weder origin/main noch HEAD aufloesbar');
      return '';
    }
  }

  function requireId() {
    const id = options.id ?? options._;
    if (!id) fail('--id fehlt');
    return id;
  }

  function validateOrFail(claim, { legacy = false } = {}) {
    const result = validateNewClaim(claim, { legacy });
    if (!result.ok) fail(result.violations.join('; '));
  }

  function printClaim(claim) {
    if (options.json) {
      console.log(JSON.stringify({ ok: true, claim }, null, 2));
      return;
    }
    console.log(`claim:register: ${claim.id}`);
    console.log(`  Owner: ${claim.owner}`);
    console.log(`  Branch: ${claim.branch}`);
    console.log(`  Basis: ${claim.baseSha}`);
    console.log(`  Issue: ${claim.issue ? `#${claim.issue}` : '(keine Nummer)'}`);
    console.log(`  Status: ${claim.status}`);
    console.log(`  Pfade: ${claim.pathAllowlist.length}`);
    console.log('  Naechster Schritt: pnpm run agent:pretask --json');
  }

  return {
    cwd, options, claimsDir, entriesDir, legacyFile,
    readEntries, entryFiles, claimFileFor, writeAtomic, withLegacyLock,
    loadForCommand, baseSha, requireId, validateOrFail, printClaim,
  };
}
