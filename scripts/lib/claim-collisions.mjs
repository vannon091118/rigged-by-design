/**
 * Reine Kollisionslogik fuer Lane-Claims.
 *
 * Der Loader in `lane-claims.mjs` kennt Registerdateien und Meta-Pfade; diese
 * Datei kennt nur Muster und Claims. Dadurch bleibt die Kollisionsentscheidung
 * testbar, ohne Git, Dateisystem oder den aktuellen Arbeitsbaum zu lesen.
 */

/** Praefix eines Allowlist-Eintrags; `docs/**`, `docs/` und `docs` sind gleich. */
export function patternPrefix(pattern) {
  return String(pattern ?? '')
    .replaceAll('\\', '/')
    .replace(/\/\*\*$/, '')
    .replace(/\/$/, '');
}

/** Zwei Allowlist-Muster beruehren denselben Pfadbereich. */
export function patternsOverlap(a, b) {
  const pa = patternPrefix(a);
  const pb = patternPrefix(b);
  if (!pa || !pb) return false;
  return pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`);
}

const isEntryPattern = (pattern, claimEntryPrefix) =>
  Boolean(claimEntryPrefix) && patternPrefix(pattern).startsWith(claimEntryPrefix);

const isCoordinationPattern = (pattern, coordinationFiles, claimEntryPrefix) => {
  const prefix = patternPrefix(pattern);
  return coordinationFiles.includes(prefix) || isEntryPattern(prefix, claimEntryPrefix);
};

const isMechanicalPattern = (pattern, metaFiles, mechanicalFiles) => {
  const prefix = patternPrefix(pattern);
  return mechanicalFiles.includes(prefix) || metaFiles.includes(prefix);
};

/**
 * Echte Content-Ueberschneidungen bleiben Kollisionen. Register, Meta- und
 * mechanische Pfade werden von mehreren Lanes mechanisch beruehrt und sind
 * deshalb keine gegenseitige Schreibsperre.
 */
export function findClaimCollisions({
  newClaim,
  candidates = [],
  metaFiles = [],
  mechanicalFiles = [],
  coordinationFiles = [],
  claimEntryPrefix = '',
} = {}) {
  const collisions = [];
  const newPaths = newClaim?.pathAllowlist ?? [];
  const newWrites = new Set(newClaim?.writeContracts?.() ?? []);

  for (const existing of candidates) {
    if (!existing || existing.id === newClaim?.id) continue;
    const existingPaths = existing.pathAllowlist ?? [];
    const pathOverlap = newPaths.some((a) =>
      existingPaths.some((b) => {
        if (isCoordinationPattern(a, coordinationFiles, claimEntryPrefix)) return false;
        if (isCoordinationPattern(b, coordinationFiles, claimEntryPrefix)) return false;
        if (isMechanicalPattern(a, metaFiles, mechanicalFiles)) return false;
        if (isMechanicalPattern(b, metaFiles, mechanicalFiles)) return false;
        return patternsOverlap(a, b);
      }),
    );

    const existingWrites = new Set(existing.writeContracts?.() ?? []);
    const contractConflict = [...newWrites].filter((id) => existingWrites.has(id));

    if (pathOverlap || contractConflict.length > 0) {
      collisions.push({
        lane: existing.id,
        reason: pathOverlap ? 'Pfad-Überschneidung in Allowlist' : '',
        contractConflict,
      });
    }
  }

  return collisions;
}
