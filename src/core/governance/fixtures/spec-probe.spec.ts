/**
 * Fixture fuer die Testdatei-Erkennung des Headless-Core-Scanners (#916/#921).
 *
 * Die Datei liegt bewusst **ohne** `__tests__/` im Baum. Der Test prueft die
 * Klassifikation ihres Pfads als `.spec`-Testdatei direkt; ein Store-Import
 * ist dafuer nicht noetig und wuerde die Core-Importgrenze verletzen.
 * Vitest sammelt sie nicht, weil `test.include` nur `src/**\/*.test.{ts,tsx}`
 * umfasst.
 */
export const SPEC_PROBE = 'spec-probe' as const;
