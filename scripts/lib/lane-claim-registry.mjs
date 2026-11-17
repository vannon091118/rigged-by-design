/**
 * Das Claim-Register: Legacy-`claims.json` plus je eine Datei pro Lane.
 * Ein fehlendes oder kaputtes Register ist ein Fehler, kein leeres Register.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LaneClaim } from './lane-claim.mjs';

const CLAIMS_DIR = join(process.cwd(), '.lane-claims');
const CLAIMS_FILE = join(CLAIMS_DIR, 'claims.json');
const CLAIM_ENTRIES_DIR = join(CLAIMS_DIR, 'claims');

function readClaimEntries(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const entries = Array.isArray(data) ? data : [data];
  if (entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new Error(`Claim-Eintrag ist kein Objekt: ${file}`);
  }
  return entries;
}

export function loadClaimsStrict() {
  const files = [];
  if (existsSync(CLAIMS_FILE)) files.push(CLAIMS_FILE);
  if (existsSync(CLAIM_ENTRIES_DIR)) {
    for (const name of readdirSync(CLAIM_ENTRIES_DIR).filter((entry) => entry.endsWith('.json')).sort()) {
      files.push(join(CLAIM_ENTRIES_DIR, name));
    }
  }
  if (files.length === 0) throw new Error(`Claim-Register fehlt: ${CLAIMS_DIR}`);

  const byId = new Map();
  for (const file of files) {
    for (const entry of readClaimEntries(file)) {
      if (byId.has(entry.id)) {
        throw new Error(`Doppelter Claim '${entry.id}' in ${byId.get(entry.id).file} und ${file}`);
      }
      byId.set(entry.id, { entry, file });
    }
  }
  return [...byId.values()].map(({ entry }) => new LaneClaim(entry));
}

/** Fehler werden fuer Anzeige und Kontext zu einer leeren Liste. */
export function loadClaims() {
  try {
    return loadClaimsStrict();
  } catch {
    return [];
  }
}

function claimEntryFiles() {
  const files = new Map();
  if (!existsSync(CLAIM_ENTRIES_DIR)) return files;
  for (const name of readdirSync(CLAIM_ENTRIES_DIR).filter((entry) => entry.endsWith('.json')).sort()) {
    const file = join(CLAIM_ENTRIES_DIR, name);
    for (const entry of readClaimEntries(file)) {
      if (files.has(entry.id)) throw new Error(`Doppelter Claim '${entry.id}' in ${files.get(entry.id)} und ${file}`);
      files.set(entry.id, file);
    }
  }
  return files;
}

function writeClaimFile(file, claim) {
  mkdirSync(CLAIM_ENTRIES_DIR, { recursive: true });
  const temp = `${file}.new`;
  writeFileSync(temp, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
}

/** Claim-Dateien bleiben Dateien, Legacy-Claims bleiben in claims.json. */
export function saveClaims(claims) {
  mkdirSync(CLAIMS_DIR, { recursive: true });
  const entryFiles = claimEntryFiles();
  const legacy = [];
  for (const claim of claims) {
    const json = typeof claim.toJSON === 'function' ? claim.toJSON() : claim;
    const file = entryFiles.get(json.id);
    if (file) {
      const current = JSON.parse(readFileSync(file, 'utf8'));
      if (JSON.stringify(current, null, 2) !== JSON.stringify(json, null, 2)) writeClaimFile(file, json);
    } else legacy.push(json);
  }
  const nextLegacy = JSON.stringify(legacy, null, 2);
  const currentLegacy = existsSync(CLAIMS_FILE) ? JSON.stringify(JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')), null, 2) : null;
  if (currentLegacy === nextLegacy) return;
  const temp = `${CLAIMS_FILE}.new`;
  writeFileSync(temp, nextLegacy, 'utf8');
  renameSync(temp, CLAIMS_FILE);
}

export function upsertClaim(claim) {
  const claims = loadClaims();
  const index = claims.findIndex((c) => c.id === claim.id);
  if (index >= 0) claims[index] = claim;
  else claims.push(claim);
  saveClaims(claims);
  return claim;
}

export function removeClaim(id) {
  const claims = loadClaims();
  const entryFiles = claimEntryFiles();
  const filtered = claims.filter((c) => c.id !== id);
  saveClaims(filtered);
  if (entryFiles.has(id)) unlinkSync(entryFiles.get(id));
  return filtered.length !== claims.length;
}

export function openClaims() {
  return loadClaims().filter((c) => c.status === 'open');
}

/**
 * Erst der offene Claim, sonst ein gemergter derselben Lane. Ein Nachtrag auf
 * dem Branch einer gemergten Lane braucht keinen neuen Claim.
 */
export function selectClaim(claims, branch) {
  const list = Array.isArray(claims) ? claims : [];
  return (
    list.find((entry) => entry.status === 'open' && entry.branch === branch) ??
    list.find((entry) => entry.status === 'merged' && entry.branch === branch) ??
    null
  );
}

export function claimForBranch(branch) {
  return selectClaim(loadClaims(), branch);
}

export function pathAllowedForClaim(filePath, laneId) {
  const claim = openClaims().find((c) => c.id === laneId);
  if (!claim) return false;
  return claim.allowsPath(filePath);
}
