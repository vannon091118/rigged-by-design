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

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findClaimCollisions, patternPrefix, patternsOverlap } from './claim-collisions.mjs';

export { patternPrefix, patternsOverlap };

const CLAIMS_DIR = join(process.cwd(), '.lane-claims');
const CLAIMS_FILE = join(CLAIMS_DIR, 'claims.json');
// Neue Lanes schreiben je eine eigene Datei. Damit ist die Registrierung
// serialisiert, ohne dass alle Agenten dieselbe JSON-Datei gleichzeitig
// ueberschreiben. `claims.json` bleibt als Legacy-Bestand lesbar.
const CLAIM_ENTRIES_DIR = join(CLAIMS_DIR, 'claims');
export const CLAIM_ENTRY_PREFIX = '.lane-claims/claims/';
export const COORDINATION_FILES = Object.freeze(['.lane-claims/claims.json']);

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

/**
 * Die acht Meta-Dateien. Feature-Lanes duerfen sie nicht inhaltlich schreiben;
 * der mechanische Pfad (Doku-Marker, Versionszeile) bleibt erlaubt. Dieselbe
 * Liste fuehrt `verify-lane-claims.mjs` und `turn-push.mjs` filtert damit den
 * Index, damit ein globales `git add -A` keine Meta-Datei mitschleppt.
 */
export const META_FILES = Object.freeze([
  'AGENTS.md',
  'docs/INVENTORY.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVTAGEBUCH.md',
  'docs/ROADMAP.md',
  'package.json',
  'pnpm-lock.yaml',
]);

/** Pfade, die jede Lane mechanisch aktualisieren darf (Version, Inventur). */
export const MECHANICAL_FILES = Object.freeze(['package.json', 'pnpm-lock.yaml', 'docs/INVENTORY.md']);

/** Diese Dateien fuehrt nur die Governance-Lane inhaltlich. */
export const GOVERNANCE_ONLY_FILES = Object.freeze(['AGENTS.md', 'docs/ARCHITECTURE.md', 'docs/ROADMAP.md']);

/** True, wenn der Pfad zu den gesperrten Meta-Dateien gehoert. */
export function isForbiddenForLanes(filePath) {
  return META_FILES.includes(String(filePath ?? '').replaceAll('\\', '/'));
}

/**
 * Prueft einen Pfad gegen eine Allowlist. Die eine Auslegung fuer Claim,
 * Staging-Scope und Gate: exakter Pfad, Verzeichnis mit `/` am Ende und
 * rekursiv mit `/**`. Ohne den Verzeichnis-Fall waere ein Eintrag wie
 * `.githooks/` ein stilles Nichts - die Sperre saehe aus, als griffe sie.
 */
export function allowsPath(allowlist, filePath) {
  const normalized = String(filePath ?? '').replaceAll('\\', '/');
  return allowlist.some((pattern) => {
    const clean = String(pattern ?? '').replaceAll('\\', '/');
    if (clean.endsWith('/**')) {
      const prefix = clean.slice(0, -3);
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }
    if (clean.endsWith('/')) return normalized.startsWith(clean);
    return normalized === clean;
  });
}

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
   * @param {string|null} mergedEvidence - Belegart des Merge-Nachweises
   * @param {string|null} mergedSha - Commit, der den Beleg traegt
   */
  constructor({ id, owner, branch, baseSha, task = '', goal = '', pathAllowlist = [], contracts = [], dependencies = [], gateProfile = 'quick', status = 'open', mergedEvidence = null, mergedSha = null }) {
    this.id = id;
    this.owner = owner;
    this.branch = branch;
    this.baseSha = baseSha;
    this.task = task;
    this.goal = goal;
    this.pathAllowlist = pathAllowlist;
    this.contracts = contracts;
    this.dependencies = dependencies;
    this.gateProfile = gateProfile;
    this.status = status;
    this.mergedEvidence = mergedEvidence;
    this.mergedSha = mergedSha;
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
    return allowsPath(this.pathAllowlist, filePath);
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
      ...(this.task ? { task: this.task } : {}),
      ...(this.goal ? { goal: this.goal } : {}),
      pathAllowlist: this.pathAllowlist,
      contracts: this.contracts,
      dependencies: this.dependencies,
      gateProfile: this.gateProfile,
      status: this.status,
      ...(this.mergedEvidence ? { mergedEvidence: this.mergedEvidence } : {}),
      ...(this.mergedSha ? { mergedSha: this.mergedSha } : {}),
      createdAt: this.createdAt,
    };
  }
}

/**
 * Laedt das Register streng: Legacy-Datei und Claim-Dateien werden vereinigt.
 * Eine fehlende, kaputte oder nicht lesbare Registerdatei ist ein Fehler, kein
 * leeres Register: fail-open hiesse, dass ein beschaedigtes claims.json jedem
 * Agenten freie Fahrt gibt.
 */
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

/** Laedt alle Claims fuer Anzeige und Kontext; Fehler werden zu einer leeren Liste. */
export function loadClaims() {
  try {
    return loadClaimsStrict();
  } catch {
    return [];
  }
}

/** Datei je Claim-ID im neuen Register; Legacy-Claims haben keinen Eintrag. */
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

/** Atomar eine einzelne Claim-Datei schreiben. */
function writeClaimFile(file, claim) {
  mkdirSync(CLAIM_ENTRIES_DIR, { recursive: true });
  const temp = `${file}.new`;
  writeFileSync(temp, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
}

/**
 * Speichert Claims an ihrem angestammten Ort: Claim-Dateien bleiben Dateien,
 * Legacy-Claims bleiben in claims.json. So erzeugt ein Reconcile-Lauf keine
 * Doppel-Eintraege, die der strenge Loader ablehnen wuerde.
 */
export function saveClaims(claims) {
  mkdirSync(CLAIMS_DIR, { recursive: true });
  const entryFiles = claimEntryFiles();
  const legacy = [];
  for (const claim of claims) {
    const json = typeof claim.toJSON === 'function' ? claim.toJSON() : claim;
    const file = entryFiles.get(json.id);
    if (file) writeClaimFile(file, json);
    else legacy.push(json);
  }
  // Atomar: erst daneben schreiben, dann ersetzen. Ein paralleler Agent sieht
  // so entweder das alte oder das neue Register, nie eine halbe Datei.
  const temp = `${CLAIMS_FILE}.new`;
  writeFileSync(temp, JSON.stringify(legacy, null, 2), 'utf8');
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
  const entryFiles = claimEntryFiles();
  const filtered = claims.filter((c) => c.id !== id);
  saveClaims(filtered);
  if (entryFiles.has(id)) unlinkSync(entryFiles.get(id));
  return filtered.length !== claims.length;
}

/** Gibt alle offenen Claims zurück. */
export function openClaims() {
  return loadClaims().filter((c) => c.status === 'open');
}

/**
 * Der Vertrag einer Lane: erst der offene Claim, sonst ein bereits gemergter
 * derselben Lane. Ein Nachtrag auf dem Branch einer gemergten Lane - etwa der
 * Register-Status, der erst nach dem Merge belegbar ist - braucht keinen neuen
 * Claim: der stuende nach seinem eigenen Merge sofort wieder als `open` im
 * Register und schoebe die Selbstreferenz nur eine Ebene weiter. Die
 * Allowlist des gemergten Claims gilt unveraendert weiter.
 */
export function selectClaim(claims, branch) {
  const list = Array.isArray(claims) ? claims : [];
  return (
    list.find((entry) => entry.status === 'open' && entry.branch === branch) ??
    list.find((entry) => entry.status === 'merged' && entry.branch === branch) ??
    null
  );
}

/** Liest das Register und waehlt den Claim fuer einen Branch; ohne Claim `null`. */
export function claimForBranch(branch) {
  return selectClaim(loadClaims(), branch);
}

/** Validiert, ob ein Pfad durch einen offenen Claim abgedeckt ist. */
export function pathAllowedForClaim(filePath, laneId) {
  const claims = openClaims();
  const claim = claims.find((c) => c.id === laneId);
  if (!claim) return false;
  return claim.allowsPath(filePath);
}

/** Prueft, ob zwei Claims sich ueberschneiden (gleiche Pfade oder schreibende Contracts). */
export function findCollisions(newClaim, candidates = openClaims()) {
  return findClaimCollisions({
    newClaim,
    candidates,
    metaFiles: META_FILES,
    mechanicalFiles: MECHANICAL_FILES,
    coordinationFiles: COORDINATION_FILES,
    claimEntryPrefix: CLAIM_ENTRY_PREFIX,
  });
}

/** Prüft, ob ein Contract-Id gleichzeitig von zwei offenen Lanes geschrieben wird. */
export function contractWriterConflicts(contractId) {
  const claims = openClaims();
  const writers = claims.filter((c) => c.writeContracts().includes(contractId));
  return writers.length > 1 ? writers : null;
}

/**
 * Kontrollebene: Pfade, die die Pruefung selbst steuern. Eine Lane, die diese
 * Pfade ohne Governance-Domaene fuehrt, schreibt an ihrem eigenen Pruefer.
 */
export const CONTROL_PLANE = Object.freeze(['.github', 'scripts', 'src/Config']);

/** Lane-Domaenen, die die Kontrollebene fuehren duerfen. */
export const isGovernanceLane = (id) => /^(?:lane\/(?:governance|ci)\/|gov\/)/.test(String(id ?? ''));
const CONTROL_PLANE_LANE = /^(?:lane\/(?:governance|ci)\/|gov\/)/;

/** Ein Muster der Allowlist, das die Kontrollebene beruehrt. */
export function isControlPlanePattern(pattern) {
  const prefix = patternPrefix(pattern);
  return CONTROL_PLANE.some((area) => prefix === area || prefix.startsWith(`${area}/`));
}

/**
 * Prueft einen neu registrierten Claim. `legacy` laesst den historischen
 * Bestand unangetastet; neue Claim-Dateien muessen den vollstaendigen Vertrag
 * tragen. Die Kontrollebene und die inhaltlichen Meta-Dateien bleiben der
 * Governance-Lane vorbehalten.
 */
export function validateNewClaim(claim, { legacy = false } = {}) {
  const violations = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    return { ok: false, violations: ['Claim ist kein Objekt'] };
  }
  const label = String(claim.id ?? '(ohne id)');
  if (!String(claim.id ?? '').trim()) violations.push('Claim-ID fehlt');
  if (!OWNERS.includes(claim.owner)) violations.push(`${label}: Owner '${claim.owner ?? ''}' ist nicht im Roster`);
  if (!claim.branch || (!BRANCH_PATTERN.test(claim.branch) && !LEGACY_PREFIXES.some((prefix) => claim.branch.startsWith(prefix)))) {
    violations.push(`${label}: Branch '${claim.branch ?? ''}' folgt nicht dem Schema`);
  }
  if (!legacy && !/^[0-9a-f]{40}$/.test(String(claim.baseSha ?? ''))) {
    violations.push(`${label}: baseSha ist kein vollstaendiger Commit`);
  } else if (legacy && !/^[0-9a-f]{7,40}$/.test(String(claim.baseSha ?? ''))) {
    violations.push(`${label}: baseSha ist kein Commit`);
  }
  const allowlist = Array.isArray(claim.pathAllowlist) ? claim.pathAllowlist : [];
  if (allowlist.length === 0) violations.push(`${label}: Pfad-Allowlist ist leer`);
  if (!['light', 'quick', 'full'].includes(claim.gateProfile)) violations.push(`${label}: gateProfile '${claim.gateProfile ?? ''}' ist unbekannt`);
  if (!legacy) {
    if (!String(claim.task ?? '').trim()) violations.push(`${label}: task fehlt`);
    if (claim.goal !== undefined && typeof claim.goal !== 'string') violations.push(`${label}: goal ist kein Text`);
    if (!isGovernanceLane(claim.id)) {
      if (allowlist.some(isControlPlanePattern)) {
        violations.push(`${label}: Kontrollebene (.github/, scripts/, src/Config/) nur fuer Governance- oder CI-Lanes`);
      }
      const forbidden = new Set([...GOVERNANCE_ONLY_FILES, ...META_FILES.filter((file) => !MECHANICAL_FILES.includes(file))]);
      for (const file of forbidden) {
        if (allowlist.some((pattern) => allowsPath([pattern], file))) {
          violations.push(`${label}: Meta-Datei '${file}' nur fuer Governance-Lanes`);
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * True, wenn ein Muster vollstaendig von der bisherigen Allowlist gedeckt ist.
 * `scripts/` deckt `scripts/promote.mjs`; `scripts/promote.mjs` deckt kein
 * neues `scripts/*`. Genau diese Richtung ist die Selbsterweiterung.
 */
export function patternCoveredBy(pattern, allowlist) {
  const prefix = patternPrefix(pattern);
  return allowlist.some((entry) => {
    const base = patternPrefix(entry);
    return base === prefix || prefix.startsWith(`${base}/`);
  });
}

/**
 * Vergleich eines Claims mit seinem Stand aus der vertrauenswuerdigen Basis.
 * Erlaubt sind Pfade, die die Basis schon deckt, und Statuswechsel nach vorn;
 * verboten sind neue Pfade, ein neuer Owner, ein neuer Branch und zusaetzliche
 * Contract-Writer. `previous === null` heisst: der Claim ist neu.
 */
export function auditClaimChange(previous, next) {
  const violations = [];
  if (!next) return { ok: false, violations: ['Claim fehlt im neuen Register'] };
  const label = next.id;
  if (!previous) return validateNewClaim(next);
  if (previous.owner !== next.owner) violations.push(`${label}: Owner gewechselt (${previous.owner} -> ${next.owner})`);
  if (previous.status === 'open' && previous.branch !== next.branch) {
    violations.push(`${label}: Branch gewechselt (${previous.branch} -> ${next.branch})`);
  }
  if (previous.status === 'merged' && next.status === 'open') {
    violations.push(`${label}: gemergter Claim wieder geoeffnet`);
  }
  for (const pattern of next.pathAllowlist ?? []) {
    if (!patternCoveredBy(pattern, previous.pathAllowlist ?? [])) {
      violations.push(`${label}: Allowlist erweitert (${pattern})`);
    }
  }
  const before = new Set((previous.contracts ?? []).filter((c) => c.mode === 'write').map((c) => c.id));
  for (const contract of next.contracts ?? []) {
    if (contract.mode === 'write' && !before.has(contract.id)) {
      violations.push(`${label}: Contract-Writer '${contract.id}' hinzugefuegt`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Vergleichbare Form eines Claims ohne Klassenzugehoerigkeit. */
const claimFingerprint = (claim) =>
  JSON.stringify({
    owner: claim.owner,
    branch: claim.branch,
    baseSha: claim.baseSha,
    task: claim.task ?? '',
    goal: claim.goal ?? '',
    pathAllowlist: claim.pathAllowlist ?? [],
    contracts: claim.contracts ?? [],
    dependencies: claim.dependencies ?? [],
    gateProfile: claim.gateProfile,
    status: claim.status,
    mergedEvidence: claim.mergedEvidence ?? null,
    mergedSha: claim.mergedSha ?? null,
  });

/**
 * Register gegen den Basisstand pruefen: die eigene Lane darf ihren Claim
 * nicht erweitern, und eine Feature-Lane fasst fremde Claims nicht an. Ein
 * neu angelegter Claim ist erlaubt, solange er nicht die Kontrollebene ohne
 * Governance-Domaene fuehrt. Governance darf fremde Claims nur im Status
 * weiterziehen, nicht ihren Vertrag umschreiben.
 */
export function auditRegisterAgainstBase({ baseClaims = [], registrationClaims = [], nextClaims = [], branch } = {}) {
  const violations = [];
  const own = selectClaim(nextClaims, branch);
  // Ohne eigenen Claim entscheidet die bestehende Claim-Pruefung; hier gibt es
  // dann nichts gegenzupruefen.
  if (!own) return { ok: true, violations };
  const governance = CONTROL_PLANE_LANE.test(own.id);
  const baseById = new Map(baseClaims.map((claim) => [claim.id, claim]));
  // Die eigene Lane wird gegen ihre erste Registrierung geprueft, damit sie
  // ihre Allowlist nicht ueber mehrere Commits erweitert. Fremde Claims werden
  // immer gegen die vertrauenswuerdige Basis geprueft, nicht gegen den
  // PR-Stand.
  const registrationById = new Map((registrationClaims.length > 0 ? registrationClaims : baseClaims).map((claim) => [claim.id, claim]));

  for (const claim of nextClaims) {
    const before = claim.id === own.id
      ? (registrationById.get(claim.id) ?? baseById.get(claim.id) ?? null)
      : (baseById.get(claim.id) ?? null);
    if (claim.id === own.id) {
      violations.push(...auditClaimChange(before, claim).violations);
      continue;
    }
    if (!before) {
      if (!governance) {
        violations.push(`${claim.id}: neuer fremder Claim in einer Feature-Lane`);
      } else {
        violations.push(...validateNewClaim(claim).violations);
      }
      continue;
    }
    violations.push(...auditClaimChange(before, claim).violations);
    if (!governance && claimFingerprint(before) !== claimFingerprint(claim)) {
      violations.push(`${claim.id}: fremder Claim veraendert (nur Governance)`);
    } else if (governance) {
      const statusOnly = {
        ...before,
        status: claim.status,
        mergedEvidence: claim.mergedEvidence,
        mergedSha: claim.mergedSha,
      };
      if (claimFingerprint(statusOnly) !== claimFingerprint(claim)) {
        violations.push(`${claim.id}: Governance darf fremde Claims nur im Status aendern`);
      }
    }
  }

  for (const before of baseClaims) {
    if (!nextClaims.some((claim) => claim.id === before.id) && !governance) {
      violations.push(`${before.id}: Claim aus dem Register entfernt (nur Governance)`);
    }
  }
  return { ok: violations.length === 0, violations };
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
      task: c.task ?? '',
      goal: c.goal ?? '',
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
