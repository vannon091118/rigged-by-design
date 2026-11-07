#!/usr/bin/env node
/**
 * Claim-Register: eine Datei pro Lane.
 *
 * Neue Claims werden nicht mehr in das gemeinsame `claims.json` geschrieben.
 * Jede Lane legt ihre eigene Datei unter `.lane-claims/claims/` an; der Loader
 * fuehrt sie mit dem Legacy-Bestand zusammen. Dadurch kann eine neue Lane nicht
 * an einem gemeinsamen Register-Schreibpfad scheitern.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRANCH_PATTERN,
  LEGACY_PREFIXES,
  LaneClaim,
  OWNERS,
  loadClaimsStrict,
} from './lib/lane-claims.mjs';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'add';

function parseOptions(argv) {
  const options = { allow: [] };
  const booleans = new Set(['json', 'help']);
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

function fail(message) {
  console.error(`claim:register: ${message}`);
  process.exit(1);
}

const options = parseOptions(args);
const cwd = process.cwd();
const claimsDir = join(cwd, '.lane-claims');
const entriesDir = join(claimsDir, 'claims');
const legacyFile = join(claimsDir, 'claims.json');

if (command === 'list') {
  let claims = [];
  try {
    claims = loadClaimsStrict();
  } catch (error) {
    fail(`Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  }
  for (const claim of claims) {
    console.log(`${claim.status.padEnd(9)} ${claim.id}  ${claim.owner}  ${claim.branch}`);
  }
  process.exit(0);
}

const id = options.id ?? options._;
if (!id) fail('--id fehlt');
const owner = options.owner;
if (!owner) fail('--owner fehlt');
if (!OWNERS.includes(owner)) fail(`Owner '${owner}' ist nicht im Roster (${OWNERS.join(', ')})`);

const branch = options.branch ?? id;
if (!BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
  fail(`Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>`);
}

const task = options.task;
if (!task) fail('--task fehlt: Task-Ziel ist Teil des Arbeitsvertrags');

let base = options.base;
if (!base) {
  try {
    base = execFileSync('git', ['rev-parse', 'origin/main'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  }
}
if (!/^[0-9a-f]{40}$/.test(base)) fail(`--base ist kein vollstaendiger SHA: ${base}`);

const slug = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
if (!slug) fail(`Claim-ID '${id}' ergibt keinen Dateinamen`);
const claimPath = `.lane-claims/claims/${slug}.json`;
const claimFile = join(cwd, claimPath);

if (command !== 'add') fail(`unbekannter Befehl '${command}'; erlaubt sind add und list`);

if (existsSync(claimFile)) fail(`${claimPath} existiert bereits; bestehende Claims werden nicht ueberschrieben`);

let existing = [];
if (existsSync(legacyFile) || existsSync(entriesDir)) {
  try {
    existing = loadClaimsStrict();
  } catch (error) {
    fail(`Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  }
}
if (existing.some((claim) => claim.id === id)) fail(`Claim '${id}' ist bereits registriert`);
if (existing.some((claim) => claim.branch === branch)) fail(`Branch '${branch}' hat bereits einen Claim`);

const allowlist = [...new Set([...(options.allow ?? []), claimPath])];
if (allowlist.length === 1) fail('mindestens ein --allow-Pfad ist erforderlich');

const claim = new LaneClaim({
  id,
  owner,
  branch,
  baseSha: base,
  task,
  pathAllowlist: allowlist,
  contracts: [],
  dependencies: [],
  gateProfile: options['gate-profile'] ?? 'light',
  status: 'open',
});

mkdirSync(entriesDir, { recursive: true });
writeFileSync(claimFile, `${JSON.stringify(claim.toJSON(), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });

if (options.json !== undefined) {
  console.log(JSON.stringify({ ok: true, file: claimPath, claim: claim.toJSON() }, null, 2));
} else {
  console.log(`claim:register: ${id}`);
  console.log(`  Datei: ${claimPath}`);
  console.log(`  Owner: ${owner}`);
  console.log(`  Branch: ${branch}`);
  console.log(`  Basis: ${base}`);
  console.log(`  Pfade: ${allowlist.length}`);
  console.log('  Naechster Schritt: git add .lane-claims/claims/*.json && pnpm run agent:pretask --json');
}
