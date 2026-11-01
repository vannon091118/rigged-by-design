/**
 * Zentrales Fehlerregister. Jeder Gate-, Test- und Laufzeitfehler nennt hier
 * eine ID; ERR-0000 ist der einzige unbekannte Zustand und blockiert sofort.
 * @error-code: ERR-4001
 */

interface ErrorDefinition {
  readonly code: string;
  readonly area: 'governance' | 'core' | 'sim' | 'render' | 'docs';
  readonly cause: string;
  readonly fix: string;
}

export const ERROR_CODES = {
  UNKNOWN: {
    code: 'ERR-0000',
    area: 'governance',
    cause: 'Ein Fehler besitzt noch keinen Eintrag im zentralen Register.',
    fix: 'Neuen ERR-Code in error-codes.ts und docs/ERROR_CATALOG.md eintragen.',
  },
  AUTOFIX: {
    code: 'ERR-0911',
    area: 'governance',
    cause: 'Ein Verstoss ist vollautomatisch reparierbar.',
    fix: 'autofix:0911 ausfuehren und den Lauf wiederholen.',
  },
  LEDGER_PROOF: {
    code: 'ERR-1002',
    area: 'core',
    cause: 'Ledger- oder VaCoin-Invariante verletzt.',
    fix: 'Buchungspfad und Mikro-Geldarithmetik pruefen.',
  },
  GAME_PROOF: {
    code: 'ERR-1003',
    area: 'core',
    cause: 'RNG- oder RTP-Beweis fehlgeschlagen.',
    fix: 'Seed, Paytable und Einsatzpfad des Spiels pruefen.',
  },
  BUILD_FAILED: {
    code: 'ERR-1005',
    area: 'core',
    cause: 'Typecheck oder Production-Build bricht ab.',
    fix: 'Ersten Compilerfehler beheben, keine Fehler unterdruecken.',
  },
  WORLD_ASSERTION: {
    code: 'ERR-2001',
    area: 'sim',
    cause: 'Simulations- oder Weltzustand verletzt eine Zusicherung.',
    fix: 'Gast-, Platz- oder Geldpfad an der Ursache korrigieren.',
  },
  GRID_ASSERTION: {
    code: 'ERR-2002',
    area: 'sim',
    cause: 'Bereichs-, Footprint- oder Zugangsregel verletzt.',
    fix: 'grid-zones und Multi-Tile-Flaeche pruefen.',
  },
  DUMMY_UI: {
    code: 'ERR-3001',
    area: 'render',
    cause: 'UI oder Renderer zeigt einen hartcodierten Dummy-Wert.',
    fix: 'Wert an ein echtes Snapshot-Feld binden oder entfernen.',
  },
  MOVEMENT_QUEUE: {
    code: 'ERR-3002',
    area: 'sim',
    cause: 'Zentrale Warteschlangen- oder Bewegungslogik verletzt.',
    fix: 'movement-queue Invariante prüfen.',
  },
  TEST_CONTRACT: {
    code: 'ERR-4001',
    area: 'governance',
    cause: 'Testvertrag (@test-target oder @error-code) fehlt oder ist ungueltig.',
    fix: 'Header mit existierendem Ziel und registriertem Code ergaenzen.',
  },
  FALSE_POSITIVE: {
    code: 'ERR-4002',
    area: 'governance',
    cause: 'Test prueft nur Existenz, Snapshot oder eine Tautologie.',
    fix: 'Echte Zustandstransformation oder numerische Invariante pruefen.',
  },
  DEAD_EXPORT: {
    code: 'ERR-4003',
    area: 'governance',
    cause: 'Ein Export wird nirgendwo importiert.',
    fix: 'Export entfernen oder im echten Pfad importieren.',
  },
  AUDIT_FAILED: {
    code: 'ERR-4004',
    area: 'governance',
    cause: 'npm audit meldet mindestens eine Schwachstelle.',
    fix: 'Abhaengigkeit aktualisieren; keine Ausnahmen zulassen.',
  },
  FORBIDDEN_TRAILER: {
    code: 'ERR-4005',
    area: 'governance',
    cause: 'Commit oder PR-Body enthaelt einen Drittanbieter-Trailer.',
    fix: 'Trailer entfernen; Commit ueber sanitize-commit bereinigen.',
  },
  COMMIT_FORMAT: {
    code: 'ERR-4006',
    area: 'governance',
    cause: 'Deutsche Developer Notes oder Pflichtsektionen fehlen.',
    fix: 'Commit-Nachricht im vorgegebenen Steam-Notes-Format neu schreiben.',
  },
  DEPENDENCY_DOC: {
    code: 'ERR-4007',
    area: 'docs',
    cause: 'Dependency ohne Architektur-Begruendung oder ohne Nutzung.',
    fix: 'ARCHITECTURE.md und Dependency-Matrix synchronisieren.',
  },
  PUSH_FAILED: {
    code: 'ERR-4008',
    area: 'governance',
    cause: 'Der automatische Push auf den aktuellen Branch scheitert.',
    fix: 'Remote, Rechte und Branch-Schutz pruefen.',
  },
  LINT_FAILED: {
    code: 'ERR-4011',
    area: 'governance',
    cause: 'ESLint meldet einen nicht automatisch behebbaren Verstoss.',
    fix: 'Regelverstoss an der Ursache beheben.',
  },
  LOC_FAILED: {
    code: 'ERR-4012',
    area: 'governance',
    cause: 'Eine Datei ueberschreitet das LOC-Cap.',
    fix: 'Verantwortung splitten oder begruendete Exception setzen.',
  },
  DEPENDENCY_MATRIX: {
    code: 'ERR-4013',
    area: 'docs',
    cause: 'Dependency-Matrix ist nicht synchron zu Code und package.json.',
    fix: 'sync:deps ausfuehren und Begruendungen pruefen.',
  },
  GATE_TIMEOUT: {
    code: 'ERR-4014',
    area: 'governance',
    cause: 'Ein Gate ueberschreitet sein hartes Zeitlimit und wird beendet.',
    fix: 'Ursache im Gate suchen; das Limit nur bewusst und begruendet anheben.',
  },
  TEST_CATALOG: {
    code: 'ERR-4015',
    area: 'governance',
    cause: 'Der Testkatalog ist nicht synchron zu den Testdateien.',
    fix: 'catalog ausfuehren und die Einordnung im Diff pruefen.',
  },
  CI_DELEGATION: {
    code: 'ERR-4016',
    area: 'governance',
    cause: 'Ein langer Nachweis konnte in GitHub Actions nicht laufen oder ist dort rot.',
    fix: 'Lauf und Log pruefen; Ursache im Gate beheben.',
  },
} as const satisfies Readonly<Record<string, ErrorDefinition>>;

const REGISTRY = new Map<string, ErrorDefinition>(
  Object.values(ERROR_CODES).map((entry) => [entry.code, entry]),
);

export function isKnownCode(code: string): boolean {
  return REGISTRY.has(code);
}

/** Einheitliche Zeile fuer Pipeline, Reporter und Tests. */
export function formatError(index: number, code: string, component: string, message: string): string {
  const definition = REGISTRY.get(code);
  if (!definition) {
    throw new Error(`[IDX-${String(index).padStart(4, '0')}] [ERR-0000] governance: Unbekannter Code ${code}`);
  }
  if (code === 'ERR-0000') {
    throw new Error(`[IDX-${String(index).padStart(4, '0')}] [ERR-0000] ${component}: ${message}`);
  }
  return `[IDX-${String(index).padStart(4, '0')}] [${code}] ${component}: ${message}`;
}
