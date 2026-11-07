/**
 * Lane-Claims: Claim-, Konflikt- und Gate-Validierung für parallele Agenten-Arbeit.
 *
 * Jede Lane hat eine ID, einen Owner, einen Branch, einen Basis-SHA, eine
 * Pfad-Allowlist und optionale Contract-Writer-Claims. Gleichzeitig darf genau
 * ein Writer pro Contract-ID existieren. Read-only Konsumenten dürfen parallel
 * sein.
 *
 * Das Register wird als JSON-Datei unter `.lane-claims/claims.json` geführt.
 * `agent:context` liest daraus und gibt die aktive Kollisions- und
 * Dependency-Lage maschinenlesbar aus.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const CLAIMS_DIR = join(process.cwd(), '.lane-claims');
const CLAIMS_FILE = join(CLAIMS_DIR, 'claims.json');

/**
 * Fester Owner-Roster. Eine Lane ohne benannten Owner ist keine Lane: ohne
 * diese Liste konnte jeder Agent einen Claim mit beliebigem Owner anlegen,
 * und "wer darf das" war nirgends beantwortet.
 */
export const OWNERS = Object.freeze([
  'Integrator',
  'Governance-Owner',
  'Architektur-Owner',
  'Ledger-/Core-Owner',
  'Quality-/Capability-Owner',
  'Interaction-Contract-Owner',
  'Sim-/Domain-Owner',
  'Save-/Migrations-Owner',
  'Monitor',
]);

/** Branch-Schema fuer Arbeitslanes; Legacy-Prefixe bleiben erlaubt. */
export const BRANCH_PATTERN = /^lane\/[a-z0-9-]+\/[a-z0-9-]+$/;
export const LEGACY_PREFIXES = Object.freeze(['gov/', 'hygiene/', 'fix/']);

/** Ein einzelner Lane-Claim. */
export class LaneClaim {
  /**
   * @param {string} id - Lane-ID, z. B. `lane/contracts/actor-id`
   * @param {string} owner - Verantwortlicher Agent / Integrator
   * @param {string} branch - Git-Branch, z. B. `lane/contracts/actor-id`
   * @param {string} baseSha - Basis-SHA aus Schritt 0.1
   * @param {string[]} pathAllowlist - Erlaubte Pfade für Schreibzugriffe
   * @param {{ id: string, version: string, mode: 'read' | 'write' }[]} contracts - Contract-Claims
   * @param {string[]} dependencies - Andere Lane-IDs, die zuerst gemergt sein müssen
   * @param {string} gateProfile - 'quick' oder 'full'
   * @param {string} status - 'open' | 'merged' | 'archived' | 'parked'
   */
  constructor({ id, owner, branch, baseSha, pathAllowlist = [], contracts = [], dependencies = [], gateProfile = 'quick', status = 'open' }) {
    this.id = id;
    this.owner = owner;
    this.branch = branch;
    this.baseSha = baseSha;
    this.pathAllowlist = pathAllowlist;
    this.contracts = contracts;
    this.dependencies = dependencies;
    this.gateProfile = gateProfile;
    this.status = status;
    this.createdAt = baseSha;
  }

  /**
   * Prüft, ob ein Pfad innerhalb der Allowlist liegt.
   *
   * Drei Schreibweisen: exakter Pfad, Verzeichnis mit `/` am Ende und
   * rekursiv mit `/**`. Ohne den Verzeichnis-Fall waere ein Eintrag wie
   * `.githooks/` ein stilles Nichts - die Sperre saehe aus, als griffe sie.
   */
  allowsPath(filePath) {
    const normalized = String(filePath ?? '').replaceAll('\\', '/');
    return this.pathAllowlist.some((pattern) => {
      const clean = String(pattern ?? '').replaceAll('\\', '/');
      if (clean.endsWith('/**')) {
        const prefix = clean.slice(0, -3);
        return normalized === prefix || normalized.startsWith(`${prefix}/`);
      }
      if (clean.endsWith('/')) return normalized.startsWith(clean);
      return normalized === clean;
    });
  }

  /** Gibt die Contract-IDs zurück, die diese Lane schreibt. */
  writeContracts() {
    return this.contracts.filter((c) => c.mode === 'write').map((c) => c.id);
  }

  toJSON() {
    return {
      id: this.id,
      owner: this.owner,
      branch: this.branch,
      baseSha: this.baseSha,
      pathAllowlist: this.pathAllowlist,
      contracts: this.contracts,
      dependencies: this.dependencies,
      gateProfile: this.gateProfile,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Laedt das Register streng. Eine fehlende, kaputte oder nicht-array-foermige
 * Registerdatei ist ein Fehler, kein leeres Register: fail-open hiesse, dass
 * ein beschaedigtes claims.json jedem Agenten freie Fahrt gibt.
 */
export function loadClaimsStrict() {
  if (!existsSync(CLAIMS_FILE)) throw new Error(`Claim-Register fehlt: ${CLAIMS_FILE}`);
  const data = JSON.parse(readFileSync(CLAIMS_FILE, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`Claim-Register ist kein Array: ${CLAIMS_FILE}`);
  return data.map((entry) => new LaneClaim(entry));
}

/** Laedt alle Claims fuer Anzeige und Kontext; Fehler werden zu einer leeren Liste. */
export function loadClaims() {
  try {
    return loadClaimsStrict();
  } catch {
    return [];
  }
}

/** Speichert alle Claims im Register. */
export function saveClaims(claims) {
  mkdirSync(CLAIMS_DIR, { recursive: true });
  // Atomar: erst daneben schreiben, dann ersetzen. Ein paralleler Agent sieht
  // so entweder das alte oder das neue Register, nie eine halbe Datei.
  const temp = `${CLAIMS_FILE}.new`;
  writeFileSync(temp, JSON.stringify(claims.map((c) => c.toJSON()), null, 2), 'utf8');
  renameSync(temp, CLAIMS_FILE);
}

/** Fügt einen neuen Claim hinzu oder aktualisiert einen bestehenden. */
export function upsertClaim(claim) {
  const claims = loadClaims();
  const index = claims.findIndex((c) => c.id === claim.id);
  if (index >= 0) claims[index] = claim;
  else claims.push(claim);
  saveClaims(claims);
  return claim;
}

/** Entfernt einen Claim (z. B. nach Merge oder Archive). */
export function removeClaim(id) {
  const claims = loadClaims();
  const filtered = claims.filter((c) => c.id !== id);
  saveClaims(filtered);
  return filtered.length !== claims.length;
}

/** Gibt alle offenen Claims zurück. */
export function openClaims() {
  return loadClaims().filter((c) => c.status === 'open');
}

/** Validiert, ob ein Pfad durch einen offenen Claim abgedeckt ist. */
export function pathAllowedForClaim(filePath, laneId) {
  const claims = openClaims();
  const claim = claims.find((c) => c.id === laneId);
  if (!claim) return false;
  return claim.allowsPath(filePath);
}

/**
 * Praefix eines Allowlist-Eintrags. `docs/**`, `docs/` und `docs` zeigen alle
 * auf denselben Bereich; der Vergleich darf nicht an der Schreibweise haengen.
 */
export function patternPrefix(pattern) {
  return String(pattern ?? '')
    .replaceAll('\\', '/')
    .replace(/\/\*\*$/, '')
    .replace(/\/$/, '');
}

export function patternsOverlap(a, b) {
  const pa = patternPrefix(a);
  const pb = patternPrefix(b);
  if (!pa || !pb) return false;
  return pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`);
}

/** Prüft, ob zwei Claims sich überschneiden (gleiche Pfade oder schreibende Contracts). */
export function findCollisions(newClaim) {
  const claims = openClaims();
  const collisions = [];

  for (const existing of claims) {
    if (existing.id === newClaim.id) continue;

    // Pfad-Ueberschneidung auf Praefix-Ebene: `docs/**`, `docs/` und
    // `docs/CHANGELOG.md` muessen sich als Ueberschneidung erkennen, egal
    // welche Schreibweise eine Lane gewaehlt hat.
    const pathOverlap = newClaim.pathAllowlist.some((a) =>
      existing.pathAllowlist.some((b) => patternsOverlap(a, b)),
    );

    // Contract-Writer-Kollision: beide schreiben denselben Contract
    const newWrites = new Set(newClaim.writeContracts());
    const existingWrites = new Set(existing.writeContracts());
    const contractConflict = [...newWrites].some((id) => existingWrites.has(id));

    if (pathOverlap || contractConflict) {
      collisions.push({
        lane: existing.id,
        reason: pathOverlap ? 'Pfad-Überschneidung in Allowlist' : '',
        contractConflict: contractConflict ? [...newWrites].filter((id) => existingWrites.has(id)) : [],
      });
    }
  }

  return collisions;
}

/** Prüft, ob ein Contract-Id gleichzeitig von zwei offenen Lanes geschrieben wird. */
export function contractWriterConflicts(contractId) {
  const claims = openClaims();
  const writers = claims.filter((c) => c.writeContracts().includes(contractId));
  return writers.length > 1 ? writers : null;
}

/** Gibt eine maschinenlesbare Zusammenfassung für agent:context. */
export function contextSummary() {
  const claims = openClaims();
  const parked = loadClaims().filter((c) => c.status === 'parked');
  const merged = loadClaims().filter((c) => c.status === 'merged');

  const allCollisions = [];
  for (const claim of claims) {
    const collisions = findCollisions(claim);
    if (collisions.length > 0) {
      allCollisions.push({ lane: claim.id, collisions });
    }
  }

  return {
    open: claims.map((c) => ({
      id: c.id,
      owner: c.owner,
      branch: c.branch,
      baseSha: c.baseSha,
      pathAllowlist: c.pathAllowlist,
      writeContracts: c.writeContracts(),
      dependencies: c.dependencies,
      gateProfile: c.gateProfile,
    })),
    parked: parked.map((c) => ({ id: c.id, owner: c.owner, reason: 'PARKED in ROADMAP.md' })),
    merged: merged.map((c) => ({ id: c.id, branch: c.branch })),
    collisions: allCollisions,
  };
}
