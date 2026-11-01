# Fehlerkatalog

Jede Meldung aus Pipeline, Tests oder Gate-Skripten beginnt mit `[IDX-XXXX] [ERR-YYYY]`.
`ERR-0000` ist der einzige unbekannte Zustand und blockiert den Build sofort.
Neue Fehlerarten brauchen zuerst einen Eintrag hier **und** in `src/core/governance/error-codes.ts`.

| Code | Komponente | Ursache | Loesung |
| --- | --- | --- | --- |
| ERR-0000 | Governance | Unbekannter Fehler ohne Registereintrag. | Neuen Code in beiden Registern nachtragen; Lauf wiederholen. |
| ERR-0911 | Governance | Automatisch reparierbarer Verstoss (Format, Matrix, Trailer). | `npm run autofix:0911` ausfuehren; der Runner protokolliert den Eingriff. |
| ERR-1002 | Core / Geld | Ledger- oder VaCoin-Invariante verletzt. | Buchungspfad und Mikro-Geldarithmetik pruefen. |
| ERR-1003 | Core / Spiele | RNG-, RTP- oder Determinismusbeweis fehlgeschlagen. | Seed, Paytable und Einsatzpfad des Spiels pruefen. |
| ERR-1005 | Build | Typecheck oder Production-Build bricht ab. | Ersten Compilerfehler an der Ursache beheben. |
| ERR-2001 | Simulation | Welt-, Gast- oder Servicezustand verletzt eine Zusicherung. | Kausalitaet im betroffenen Zustandsautomaten korrigieren. |
| ERR-2002 | Simulation / Grid | Bereichs-, Footprint- oder Zugangsregel verletzt. | `grid-zones` und Multi-Tile-Flaeche pruefen. |
| ERR-3001 | Render / UI | Hartcodierter Dummy-Wert oder toter Platzhalter sichtbar. | An echtes Snapshot-Feld binden oder entfernen. |
| ERR-3002 | Simulation / Bewegung | Zentrale Warteschlangen- oder Bewegungslogik verletzt. | `movement-queue` Invariante prüfen. |
| ERR-4001 | Testvertrag | `@test-target` oder `@error-code` fehlt/ist ungueltig. | Header mit existierendem Ziel und registriertem Code ergaenzen. |
| ERR-4002 | Testqualitaet | Reiner Existenz-, Snapshot- oder Tautologie-Test. | Zustandstransformation oder numerische Invariante pruefen. |
| ERR-4003 | Toter Code | Export wird nirgendwo importiert. | Export entfernen oder im echten Pfad verwenden. |
| ERR-4004 | Dependencies | `npm audit` meldet mindestens eine Schwachstelle. | Paket aktualisieren; keine Ausnahmen. |
| ERR-4005 | Commit | Drittanbieter-Trailer oder Tool-Werbung im Commit/PR-Body. | Trailer entfernen; `sanitize-commit` nutzen. |
| ERR-4006 | Commit | Deutsche Developer Notes oder Pflichtsektionen fehlen. | Nachricht im Steam-Notes-Format neu schreiben. |
| ERR-4007 | Architektur | Dependency ohne Begruendung oder ohne reale Nutzung. | `docs/ARCHITECTURE.md` und Matrix synchronisieren. |
| ERR-4008 | Delivery | Automatischer Push auf den aktuellen Branch scheitert. | Remote-Arbeit nachziehen und lokal neu aufsetzen; bleibt der Push bei aktuellem Remote abgelehnt, Rechte und Branch-Schutz pruefen. |
| ERR-4011 | Lint | ESLint-Verstoss, der nicht automatisch behebbar ist. | Regelverstoss an der Ursache beheben. |
| ERR-4012 | LOC-Guard | Datei ueberschreitet ihr LOC-Cap oder nutzt eine verbotene Ausnahme. | Verantwortung splitten und unter die Hot Zone ihrer Zustaendigkeit reduzieren; keine neuen Exceptions. |
| ERR-4013 | Architektur | Dependency-Matrix ist nicht synchron. | `npm run sync:deps` ausfuehren und Begruendungen pruefen. || ERR-4014 | Pipeline | Ein Gate ueberschreitet sein hartes Zeitlimit und wird samt Prozessbaum beendet. | Ursache im Gate suchen; das Limit nur bewusst und begruendet anheben. |
| ERR-4015 | Testkatalog | Testkatalog ist nicht synchron zu den Testdateien. | `npm run catalog` ausfuehren und die Einordnung im Diff pruefen. |
| ERR-4016 | CI-Delegation | Ein langer Nachweis konnte nicht in GitHub Actions laufen oder ist dort rot. | Lauf und Log im Browser pruefen; Ursache im Gate beheben, nicht lokal nachbauen. |
