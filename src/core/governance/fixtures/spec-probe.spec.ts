/**
 * Fixture fuer die Testdatei-Erkennung des Headless-Core-Scanners (#916/#921).
 *
 * Die Datei liegt bewusst **ohne** `__tests__/` im Baum. Der Test prueft die
 * Klassifikation ihres Pfads als `.spec`-Testdatei direkt; ein Store-Import
 * oder ein Export ist dafuer nicht noetig. Vitest sammelt sie nicht, weil die
 * Testkonfiguration nur `.test`-Dateien einbindet.
 */
