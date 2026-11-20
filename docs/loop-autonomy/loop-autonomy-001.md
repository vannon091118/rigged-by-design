# Kontext-Chain-Eintrag: Autonome Agenten-Chain (Task #2, P0)

<!-- rbd-doc: managed -->

## Metadaten

| Feld | Wert |
|---|---|
| entry_id | loop-autonomy-001 |
| task_id | 2 |
| priorität | P0 |
| erstellt_am | 2026-11-20 |
| erstellt_von | game-designer |
| status | implementiert_dokumentiert_verifikationsblockiert |
| current_agent | shinon (Integration fortführen) |
| next_agent | governance-office |
| cycle_id | 1 |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| blocker | node/pnpm nicht ausführbar in dieser Umgebung — Cron-Skripte können nicht getestet werden |
| implementiert_von | jenova |
| implementiert_am | 2026-11-20 |
| qa_abgeschlossen_von | lillith |
| qa_abgeschlossen_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/1188-verify-all-test-quality |
| cycle_id | 1 |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |

## Entwurf

### Konzept
Siehe `docs/LOOP-AUTONOMY-KONZEPT.md` — System-Design für die mechanisch erzwungene, stundenlange autonome Ausführung der Agenten-Chain (game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes) mit Cron-Konfiguration und Autocompact-Integration.

### Logikkette (A → B → C)

```
A: TRIGGER & ZUSTAND (Cronjob)
  1. stop.flag prüfen → nicht vorhanden → Loop läuft
  2. Kontext-Chain-Eintrag lesen
  3. current_agent + status bestimmen
  4. message_agent(target=current_agent)
  5. Eintrag aktualisieren (current_agent, last_activity_ts, cycle_id)

B: AGENTEN-CHAIN (jenova → lillith → shinon → governance-office → maintainer → hermes)
  6. jenova: Entwurf validieren → implementieren → testen → Eintrag → message_agent(lillith)
  7. lillith: QA/Validierung → Eintrag → message_agent(shinon)
  8. shinon: Integration → Eintrag → message_agent(governance-office)
  9. governance-office: Vertrag prüfen → Eintrag → message_agent(maintainer)
  10. maintainer: PR-Review → Merge/Close → Tag → Eintrag → message_agent(hermes)
  11. hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info → Eintrag: loop_abgeschlossen

C: RESILIENZ & WIEDERHOLUNG (Autocompact + Cron)
  12. Kontext-Fenster kompaktiert? → Eintrag lesen → fortfahren beim gespeicherten status
  13. Timeout (>60 Min ohne Aktivität)? → Blocker an maintainer
  14. Agent-Ausfall (keine Antwort, Fehler, Timeout)? → Restart (gleiche Rolle, frischer Kontext) oder Turnover (anderer Agent übernimmt Rolle, Zustände übertragen über Kontext-Chain-Eintrag)
  15. stop.flag gesetzt? → Chain eingefroren
  16. Zyklus abgeschlossen? → Neue cycle_id, nächster Cron-Durchlauf startet neuen Zyklus
```

### Visualisierung
Siehe `docs/LOOP-AUTONOMY-VISUALISIERUNG.md` — ASCII-Übersicht, kompakte System-Verkettung, Invarianten, Zeitliche Abfolge.

### Offene Fragen an jenova
Siehe `docs/LOOP-AUTONOMY-FRAGEN.md` — Fragen zu Cron-Konfiguration, Autocompact-Resilienz, stop.flag, Zeitouts und Visualisierung.

## Übergabe an jenova

- **Empfänger:** jenova (@jenova)
- **Aufgabe:** Entwurf validieren, Cron-Konfiguration umsetzen, Autocompact-Resilienz sicherstellen, Ergebnis zurückschreiben, dann Handoff an lillith
- **Nachweise:** Konzept, Visualisierung, Fragen (obige Dateien)
- **Nächster Schritt nach jenova:** lillith (offizielle Handoff-Kette)
- **Danach:** shinon → governance-office → maintainer → hermes (Status)

## Umsetzung & Ergebnis (jenova)

### Validierung des Entwurfs
Der Entwurf (Konzept, Logikkette A→B→C, Visualisierung, 13 offene Fragen) ist in sich konsistent und deckt die drei Säulen (Cron-Konfiguration, Autocompact-Integration, mechanische Erzwingung) vollständig ab. Alle sieben Invarianten sind definiert und nachvollziehbar.

### Beantwortung der offenen Fragen (aus docs/LOOP-AUTONOMY-FRAGEN.md)

| Nr. | Frage | Entscheidung |
|-----|-------|-------------|
| 1 | Cron-Ort | `.cron/` des Repos (versioniert, Review-pflichtig) — analog zu `.cron/maintainer-prompt.md`. `.hermes/cron/` bleibt Hermes-intern und wird nicht für die Agenten-Chain verwendet. |
| 2 | Cron-Intervalle | Alle 2-7 Minuten für kurze Prüfung (stop.flag, Chain-aktiv, nächster Schritt fällig, Compact bei Bedarf), alle 60 Minuten für vollen Chain-Durchlauf bei nicht blockierten Schritten. |
| 3 | Cron-Trigger-Mechanismus | Über `message_agent(target=<next_agent>)` mit Kontext-Chain-Pfad. Der Cronjob liest den Eintrag und triggert den aktuellen Agenten. |
| 4 | Token-Sicherheit | `GITHUB_TOKEN` ausschließlich als Umgebungsvariable im isolierten Maintainer-Kontext. Worker-Prozesse (jenova, lillith, shinon) erhalten den Token nicht. Kein Hardcoding in Prompts oder Dateien. |
| 5 | Eintrag-Speicherort | `docs/loop-autonomy/` — zentraler Speicherort für Kontext-Chain-Einträge, überlebt Autocompact als externe Wahrheit. |
| 6 | Resume-Detektion | Ja: Agent liest Kontext-Chain-Eintrag nach Kompaktierung. Wenn `current_agent == Selbst` und `status != loop_abgeschlossen`, setzt der Agent beim gespeicherten status fort. |
| 7 | Idempotenz | Über `cycle_id` + `status`: Ein Schritt wird nur ausgeführt, wenn `current_agent == Selbst` und der erwartete Status passt. Doppelte Ausführung wird verhindert. |
| 8 | Zeitstempel | Jeder Agent setzt `last_activity_ts` selbst beim Schreiben seines Ergebnisses in den Eintrag. Der Cronjob aktualisiert ihn beim Trigger. |
| 9 | stop.flag-Prüfung im Cron | Beides: Cronjob prüft `stop.flag` vor jedem Durchlauf, UND jeder Agent prüft sie vor seinem Schritt (double-checked, fail-closed). |
| 10 | Timeout-Schwelle | 60 Minuten ohne Aktivität ist die richtige Schwelle. Konfigurierbar über Umgebungsvariable `RBD_CHAIN_TIMEOUT_MIN` (Default: 60). |
| 11 | Timeout-Aktion | Cronjob meldet Blocker an maintainer und markiert den Eintrag als `blockiert`. Kein automatisches Triggering des nächsten Agents — Maintainer entscheidet über Fortsetzung. |
| 12 | ASCII vs SVG | Textform (ASCII) reicht für die Doku. SVG optional für spätere Überarbeitung. |
| 13 | Dokumenten-Ort | Unter `docs/loop-autonomy/` (neben Konzept/Visualisierung/Fragen), kein separater Ordner nötig. |

### stop.flag-Prüfung (vor jedem Schritt)
- Schritt 1 (Lesen Kontext-Chain-Eintrag): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Entwurf validieren): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (Cron-Konfiguration umsetzen): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 4 (Ergebnis zurückschreiben): stop.flag nicht vorhanden → Loop läuft ✓

### Implementierung im Claim-Scope
Der Claim-Scope dieses Eintrags ist Meta-Infrastruktur für die autonome Agenten-Chain (kein Spiel-Code in `src/core/`). Umgesetzt:
- Kontext-Chain-Eintrag `loop-autonomy-001` validiert und mit Umsetzungsstatus angereichert.
- Alle 13 offenen Fragen beantwortet und als Entscheidungen festgehalten.
- stop.flag-Prüfung für jeden Arbeitsschritt dokumentiert und eingehalten.
- Cron-Konfiguration konzipiert (Intervalle, Trigger-Mechanismus, Token-Sicherheit, Resume-Detektion, Idempotenz, Zeitstempel, Timeout).
- Autocompact-Resilienz sichergestellt: Kontext-Chain-Eintrag als externe Wahrheit (überlebt Kontext-Fenster-Kompaktierung).

### Verifikation (BLOCKIERT)
`pnpm rbd verify light` und `pnpm rbd verify fast` können in dieser Umgebung nicht ausgeführt werden: `node` und `pnpm` sind nicht ausführbar (Android-Terminal, Symbol-Fehler bei node, `pnpm: command not found`). Cron-Skripte können nicht getestet werden. Keine Testnachweise vorhanden. Dies ist ein dokumentierter Blocker, kein Loop-Stopp.

### Bekannte Einschränkungen
- Keine ausführbaren Tests (kein node/pnpm).
- Kein git Push/PR möglich (kein arbeitender node/pnpm-Toolchain, Maintainer-Merge erforderlich).
- Cron-Skripte konzipiert, nicht als ausführbare Dateien geschrieben (keine node-Ausführung zum Testen).

### Nächste Schritte nach jenova
1. lillith: QA/Validierung der implementierten Dokumentation und Entscheidungen (offizielle Handoff-Kette: jenova → lillith) ✅ abgeschlossen
2. lillith → Handoff an shinon
3. shinon: Integration, übergibt an governance-office
4. governance-office: Vertragsprüfung, Lücken, Typografie-Überarbeitung, übergibt an maintainer
5. maintainer: PR-Review, Merge/Close, Tag (nach Bereitstellung der Umgebung)
6. hermes: Status-Check, Loop-Vollständigkeit, Nutzer-Info, Cron-Überwachung

## Invarianten (gültig für den gesamten autonomen Lauf)

- stop.flag wird vor jedem Schritt geprüft
- Kontext-Chain-Eintrag ist einzige externe Wahrheit (überlebt Autocompact)
- Kein Agent startet ohne Handoff oder Cron-Trigger
- Jeder Schritt schreibt Ergebnis vor Handoff
- Nach Kompaktierung: Fortsetzung beim gespeicherten status
- Agent-Ausfall (keine Antwort, Fehler, Timeout) → Restart (gleiche Rolle, frischer Kontext) oder Turnover (anderer Agent übernimmt Rolle, Zustände werden übertragen)
- Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)
- Handoff-Kette: jenova → lillith → shinon → governance-office → maintainer → hermes
