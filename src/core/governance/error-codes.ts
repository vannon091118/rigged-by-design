/**
 * Zentrales Fehlerregister. Jeder Gate-, Test- und Laufzeitfehler nennt hier
 * eine ID; ERR-0000 ist der einzige unbekannte Zustand und blockiert sofort.
 * @error-code: ERR-4001
 */

type EscalationLevel = 'AUTO_FIX' | 'LOCAL_GATE' | 'REMOTE_CI' | 'AGENT' | 'BLOCKED';

interface ErrorDefinition {
  readonly code: string;
  readonly level: EscalationLevel;
  readonly area: 'governance' | 'core' | 'sim' | 'render' | 'docs';
  readonly cause: string;
  readonly fix: string;
}

export const ERROR_CODES = {
  UNKNOWN: { code: 'ERR-0000', level: 'BLOCKED', area: 'governance', cause: 'Ein Fehler besitzt noch keinen Eintrag im zentralen Register.', fix: 'Neuen ERR-Code in error-codes.ts und im Fehlerregister in docs/ARCHITECTURE.md eintragen.' },
  AUTOFIX: { code: 'ERR-0911', level: 'AUTO_FIX', area: 'governance', cause: 'Ein Verstoss ist vollautomatisch reparierbar.', fix: 'autofix:0911 ausfuehren und den Lauf wiederholen.' },
  DETERMINISM: { code: 'ERR-1001', level: 'BLOCKED', area: 'governance', cause: 'Zufalls- oder Zeitquelle ausserhalb des erlaubten RNG in core/ oder store/.', fix: 'Quelle entfernen; Zufall nur ueber den geseedeten Prng, Zeit nur aus world.tick.' },
  LEDGER_PROOF: { code: 'ERR-1002', level: 'BLOCKED', area: 'core', cause: 'Ledger- oder VaCoin-Invariante verletzt.', fix: 'Buchungspfad und Mikro-Geldarithmetik pruefen.' },
  GAME_PROOF: { code: 'ERR-1003', level: 'BLOCKED', area: 'core', cause: 'RNG- oder RTP-Beweis fehlgeschlagen.', fix: 'Seed, Paytable und Einsatzpfad des Spiels pruefen.' },
  BUILD_FAILED: { code: 'ERR-1005', level: 'AGENT', area: 'core', cause: 'Typecheck oder Production-Build bricht ab.', fix: 'Ersten Compilerfehler beheben, keine Fehler unterdruecken.' },
  WORLD_ASSERTION: { code: 'ERR-2001', level: 'BLOCKED', area: 'sim', cause: 'Simulations- oder Weltzustand verletzt eine Zusicherung.', fix: 'Gast-, Platz- oder Geldpfad an der Ursache korrigieren.' },
  GRID_ASSERTION: { code: 'ERR-2002', level: 'AGENT', area: 'sim', cause: 'Bereichs-, Footprint- oder Zugangsregel verletzt.', fix: 'grid-zones und Multi-Tile-Flaeche pruefen.' },
  DUMMY_UI: { code: 'ERR-3001', level: 'AGENT', area: 'render', cause: 'UI oder Renderer zeigt einen hartcodierten Dummy-Wert.', fix: 'Wert an ein echtes Snapshot-Feld binden oder entfernen.' },
  TEST_CONTRACT: { code: 'ERR-4001', level: 'AGENT', area: 'governance', cause: 'Testvertrag (@test-target oder @error-code) fehlt oder ist ungueltig.', fix: 'Header mit existierendem Ziel und registriertem Code ergaenzen.' },
  FALSE_POSITIVE: { code: 'ERR-4002', level: 'AGENT', area: 'governance', cause: 'Test prueft nur Existenz, Snapshot oder eine Tautologie.', fix: 'Echte Zustandstransformation oder numerische Invariante pruefen.' },
  DEAD_EXPORT: { code: 'ERR-4003', level: 'AGENT', area: 'governance', cause: 'Ein Export wird nirgendwo importiert.', fix: 'Export entfernen oder im echten Pfad importieren.' },
  AUDIT_FAILED: { code: 'ERR-4004', level: 'AGENT', area: 'governance', cause: 'npm audit meldet mindestens eine Schwachstelle.', fix: 'Abhaengigkeit aktualisieren; keine Ausnahmen zulassen.' },
  FORBIDDEN_TRAILER: { code: 'ERR-4005', level: 'AUTO_FIX', area: 'governance', cause: 'Commit oder PR-Body enthaelt einen Drittanbieter-Trailer.', fix: 'Trailer entfernen; Commit ueber sanitize-commit bereinigen.' },
  COMMIT_FORMAT: { code: 'ERR-4006', level: 'AGENT', area: 'governance', cause: 'Deutsche Developer Notes oder Pflichtsektionen fehlen.', fix: 'Commit-Nachricht im vorgegebenen Steam-Notes-Format neu schreiben.' },
  DEPENDENCY_DOC: { code: 'ERR-4007', level: 'AGENT', area: 'docs', cause: 'Dependency ohne Architektur-Begruendung oder ohne Nutzung.', fix: 'ARCHITECTURE.md und Dependency-Matrix synchronisieren.' },
  PUSH_FAILED: { code: 'ERR-4008', level: 'REMOTE_CI', area: 'governance', cause: 'Der automatische Push auf den Arbeitsbranch scheitert, auch nach dem Nachziehen von origin/main.', fix: 'Remote-Arbeit nachziehen und lokal neu aufsetzen; bleibt der Push bei aktuellem Remote abgelehnt, Rechte und Branch-Schutz pruefen.' },
  LINT_FAILED: { code: 'ERR-4011', level: 'AGENT', area: 'governance', cause: 'ESLint meldet einen nicht automatisch behebbaren Verstoss.', fix: 'Regelverstoss an der Ursache beheben.' },
  LOC_FAILED: { code: 'ERR-4012', level: 'AGENT', area: 'governance', cause: 'Eine Datei ueberschreitet das LOC-Cap.', fix: 'Verantwortung splitten oder begruendete Exception setzen.' },
  DEPENDENCY_MATRIX: { code: 'ERR-4013', level: 'AUTO_FIX', area: 'docs', cause: 'Dependency-Matrix ist nicht synchron zu Code und package.json.', fix: 'sync:deps ausfuehren und Begruendungen pruefen.' },
  GATE_TIMEOUT: { code: 'ERR-4014', level: 'REMOTE_CI', area: 'governance', cause: 'Ein Gate ueberschreitet sein hartes Zeitlimit und wird beendet.', fix: 'Ursache im Gate suchen; das Limit nur bewusst und begruendet anheben.' },
  TEST_CATALOG: { code: 'ERR-4015', level: 'AUTO_FIX', area: 'governance', cause: 'Der Testkatalog ist nicht synchron zu den Testdateien.', fix: 'catalog ausfuehren und die Einordnung im Diff pruefen.' },
  CI_DELEGATION: { code: 'ERR-4016', level: 'REMOTE_CI', area: 'governance', cause: 'Ein langer Nachweis konnte in GitHub Actions nicht laufen oder ist dort rot.', fix: 'Lauf und Log pruefen; Ursache im Gate beheben.' },
  DOC_GATE: { code: 'ERR-4017', level: 'AUTO_FIX', area: 'docs', cause: 'Pflichtdokument, Marker oder Pflichtabschnitt fehlt.', fix: 'npm run docs:sync ausfuehren und die Struktur ergaenzen.' },
  HOOK_INSTALL: { code: 'ERR-4018', level: 'LOCAL_GATE', area: 'governance', cause: 'Repo-Hooks liessen sich nicht aktivieren.', fix: 'git config core.hooksPath .githooks pruefen.' },
  TREE_GATE: { code: 'ERR-4019', level: 'AGENT', area: 'governance', cause: 'Datei liegt im falschen Ordner oder eine Schicht importiert nach aussen.', fix: 'Datei verschieben; Import nach innen ziehen.' },
  REDUNDANCY_GATE: { code: 'ERR-4020', level: 'AGENT', area: 'governance', cause: 'Datei, Kommando oder Fehlercode ist doppelt vorhanden.', fix: 'Eine Wahrheit behalten und die Kopie entfernen.' },
  DOC_STUB: { code: 'ERR-4021', level: 'AGENT', area: 'docs', cause: 'Doc-Stub ohne brauchbaren Titel aufgerufen.', fix: 'npm run docs:stub -- "Titel" mit mindestens 8 Zeichen.' },
  CONTENT_SCHEMA: { code: 'ERR-4022', level: 'AGENT', area: 'governance', cause: 'Content-Beitrag, Vokabular, Turn-Manifest, Makro oder Registry verletzt den NAR-09/NAR-10-Vertrag.', fix: 'Feld, ID, Klassifizierung oder Makro korrigieren; Registry mit pnpm run narrative:compile neu erzeugen.' },
  DIRECT_PUSH_REJECTED: { code: 'ERR-4023', level: 'AGENT', area: 'governance', cause: 'Direkter Push auf main wird vom Branch-Schutz abgelehnt; der Arbeitsbranch ist gepusht.', fix: 'Fokussierten PR gegen main oeffnen und ueber das Gate promoten; kein Direktpush auf main.' },
  LOCAL_GATE_RED: { code: 'ERR-4024', level: 'LOCAL_GATE', area: 'governance', cause: 'Das lokale Gate (verify:quick oder verify:all) in turn:finish ist rot; kein Commit und kein Push.', fix: 'Den ersten Befund im Gate-Log beheben und turn:finish erneut ausfuehren.' },
  TRANSFER_INVALID: { code: 'ERR-5001', level: 'BLOCKED', area: 'core', cause: 'Importierter Spielstand ist beschaedigt oder fremd.', fix: 'Export pruefen; reparierbare Felder werden automatisch ergaenzt.' },
  CAPABILITY_GATE: { code: 'ERR-4025', level: 'AGENT', area: 'governance', cause: 'Capability-Manifest verletzt den Vertrag: fehlende Tests, ungültige IDs oder veraltete Pfadverweise.', fix: 'Manifest korrigieren, Tests ergänzen oder Fähigkeit als unverified/tombstoned markieren.' },
  GOVERNANCE_FREEZE: { code: 'ERR-4030', level: 'BLOCKED', area: 'governance', cause: 'Governance-Pfad ohne gueltige PIN-Freigabe oder ungeclaimter Ledger-/Save-/RNG-/Boot-Pfad.', fix: 'Freigabe ueber scripts/freeze-unlock.mjs erzeugen oder die Aenderung verwerfen; keine stille Uebernahme.' },
  TEST_RED: { code: 'ERR-4026', level: 'AGENT', area: 'governance', cause: 'Die Testsuite ist rot: ein Befund ausserhalb von Geld-, Ledger-, RNG- oder Save-Invarianten.', fix: 'Befund als Issue abholen und beheben; die Arbeit laeuft weiter, die CI bleibt die Werkstatt.' },
} as const satisfies Readonly<Record<string, ErrorDefinition>>;

const REGISTRY = new Map<string, ErrorDefinition>(Object.values(ERROR_CODES).map((entry) => [entry.code, entry]));

export function isKnownCode(code: string): boolean {
  return REGISTRY.has(code);
}

/** Einheitliche Zeile fuer Pipeline, Reporter und Tests. */
export function formatError(index: number, code: string, component: string, message: string): string {
  const definition = REGISTRY.get(code);
  if (!definition) throw new Error(`[IDX-${String(index).padStart(4, '0')}] [ERR-0000] governance: Unbekannter Code ${code}`);
  if (code === 'ERR-0000') throw new Error(`[IDX-${String(index).padStart(4, '0')}] [ERR-0000] ${component}: ${message}`);
  return `[IDX-${String(index).padStart(4, '0')}] [${code}] ${component}: ${message}`;
}
