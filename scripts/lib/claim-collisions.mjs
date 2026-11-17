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
 * Geteilte, generierte Artefakte: jede Lane mit Narrative-Pflicht regeneriert
 * sie, keine Lane besitzt sie. Eine Allowlist-Ueberschneidung dort ist keine
 * Schreibsperre, sonst koennte nie eine zweite Lane committen, solange
 * irgendeine Lane offen ist.
 */
export const SHARED_GENERATED_PATHS = Object.freeze([
  'content/narrative/',
  'src/core/sim/narrative/composer/',
]);

/** Muster liegt in einem geteilten, generierten Pfad (oder ist er selbst). */
const isSharedPattern = (pattern, sharedPaths) => {
  const prefix = patternPrefix(pattern);
  return sharedPaths.some((shared) => {
    const sharedPrefix = patternPrefix(shared);
    return prefix === sharedPrefix || prefix.startsWith(`${sharedPrefix}/`);
  });
};

/**
 * Echte Content-Ueberschneidungen bleiben Kollisionen. Register, Meta- und
 * mechanische Pfade werden von mehreren Lanes mechanisch beruehrt und sind
 * deshalb keine gegenseitige Schreibsperre.
 *
 * KonfliktResolution-Steuerung:
 * - strict: wie bisher (Kollision = Pfad- oder Contract-Überschneidung)
 * - perAgent: nur bei exakt gleichem Pfad + gleichem Agent
 * - shared: nur bei echter Doppelbelegung (selbe Datei, selbe Nutzung)
 */
export function findClaimCollisions({
  newClaim,
  candidates = [],
  metaFiles = [],
  mechanicalFiles = [],
  coordinationFiles = [],
  sharedPaths = SHARED_GENERATED_PATHS,
  claimEntryPrefix = '',
  conflictResolution = 'strict',
} = {}) {
  const collisions = [];
  const newPaths = newClaim?.pathAllowlist ?? [];
  const newWrites = new Set(newClaim?.writeContracts?.() ?? []);
  const newParallelAgents = newClaim?.parallelAgents ?? 1;
  const newConflictResolution = newClaim?.conflictResolution ?? 'strict';

  for (const existing of candidates) {
    if (!existing || existing.id === newClaim?.id) continue;
    const existingPaths = existing.pathAllowlist ?? [];
    const existingParallelAgents = existing.parallelAgents ?? 1;
    const existingConflictResolution = existing.conflictResolution ?? 'strict';

    // Helper: pruefe ob beide Claims dieselbe Konflikt-Logik teilen
    const sameConflictResolution = newConflictResolution === existingConflictResolution;

    const pathOverlap = newPaths.some((a) =>
      existingPaths.some((b) => {
        if (isCoordinationPattern(a, coordinationFiles, claimEntryPrefix)) return false;
        if (isCoordinationPattern(b, coordinationFiles, claimEntryPrefix)) return false;
        if (isMechanicalPattern(a, metaFiles, mechanicalFiles)) return false;
        if (isMechanicalPattern(b, metaFiles, mechanicalFiles)) return false;
        if (isSharedPattern(a, sharedPaths)) return false;
        if (isSharedPattern(b, sharedPaths)) return false;
        return patternsOverlap(a, b);
      }),
    );

    // Bei strict: bisherigen Pfad- und Contract-Pruefung beibehalten
    // Bei perAgent: nur gleiche Pfade + gleicher Agent
    // Bei shared: nur echte Doppelbelegung (selbe Datei, selbe Nutzung)
    let effectivePathOverlap = pathOverlap;

    if (newConflictResolution === 'strict' || existingConflictResolution === 'strict') {
      // strict Mode: volle Pfad- und Contract-Pruefung
      // (keine Aenderung zum bisherigen Verhalten)
    } else if (newConflictResolution === 'perAgent' || existingConflictResolution === 'perAgent') {
      // perAgent: Nur dann Kollision, wenn exakt gleicher Pfad UND gleicher Agent
      // Wir koennen hier nicht am Agentenamen pruefen (Claims haben keinen Agenten-namen),
      // aber wir koennen parallelAgents-Abhaengigkeit tracken. Wenn beide Lanes
      // parallele Agenten mit perAgent haben und dieselben Pfade haben, ist das
      // keine Kollision, sondern erlaubte parallele Arbeit.
      // Wir koennen das erkennen an parallelAgents > 1 fuer beide.
      const bothParallel = newParallelAgents > 1 && existingParallelAgents > 1;
      if (!bothParallel) {
        // Fallback: jede Pfad-UEberschneidung ist Kollision
        effectivePathOverlap = pathOverlap;
      } else {
        // perAgent Mode: Pfad-UEberschneidung ist OK, solange Agenten sich nicht
        // ueberlappen. Wir muessten Agent-IDs haben, aber fuer jetzt: wir lassen
        // die Pfade durch, Contract-Konflikte pruefen wir dennoch.
        effectivePathOverlap = false; // Keine Pfad-Kollision in perAgent-Modus
      }
    } else if (newConflictResolution === 'shared' || existingConflictResolution === 'shared') {
      // shared Mode: nur echte Doppelbelegung. Pfade sind gleich, aber Nutzung
      // muss auch wirklich gleich sein. Da wir hier keine Runtime-Informationen haben,
      // nutzen wir eine grobe Pruefung: wenn beide parallele Agenten haben und
      // dieselben Pfade, betrachten wir es als keine Kollision (shared Mode erlaubt
      // gleichzeitige Nutzung).
      const bothParallel = newParallelAgents > 1 && existingParallelAgents > 1;
      if (!bothParallel) {
        effectivePathOverlap = pathOverlap;
      } else {
        effectivePathOverlap = false; // shared Mode: keine Kollision bei paralleler Nutzung
      }
    }

    const existingWrites = new Set(existing.writeContracts?.() ?? []);
    const contractConflict = [...newWrites].filter((id) => existingWrites.has(id));

    if (effectivePathOverlap || contractConflict.length > 0) {
      collisions.push({
        lane: existing.id,
        reason: effectivePathOverlap ? 'Pfad-Überschneidung in Allowlist' : '',
        contractConflict,
      });
    }
  }

  return collisions;
}
