# Konzept: Issue #976 (P1 Save) — Save-System-Verifizierung und -Härtung

<!-- rbd-doc: managed -->

## Aufgabe

Task #3 (P0) — Spiel-Design-Schritt 1 in der autonomen Loop-Kette (game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes).

Identifiziertes Issue: **#976 (P1 Save)** — Save-System-Verifizierung und -Härtung.
P0 Issue #684 ist identifiziert, aber **blockiert** (fehlende User-Entscheidung, kein Loop-Stopp für dieses Design).

## Ziel

Das Save-System (Save v11, Envelope mit FNV-1a Prüfsumme, Migration v5–v10 → v11, Ledger-Integrität, PRNG-Persistenz) soll verifiziert und gehärtet werden, sodass Save/Load-Roundtrips konsistent sind, keine Datenverluste auftreten und der Spielzustand nach einem Load exakt mit dem Vor-Save-Zustand übereinstimmt.

## Akzeptanzkriterien

| # | Kriterium | Nachweis |
|---|-----------|----------|
| 1 | Save/Load-Roundtrip erhält Weltzustand, Ledger, PRNG-Zustand und Narrative-Facts unverändert | `save-roundtrip.test.ts` |
| 2 | Save-Envelope enthält gültige FNV-1a 32-Bit-Prüfsumme und Format-Versionierung | `envelope.ts`, `save-layout.test.ts` |
| 3 | Ledger-Integrität bleibt nach Save/Load erhalten (Summe aller Konten = null) | `ledger-integrity.ts`, `verifyBalanceSheet()` |
| 4 | PRNG-Zustand wird exakt an der gespeicherten Stelle fortgesetzt (kein Re-Seed) | `prng-persistence.test.ts` |
| 5 | Migration v5–v10 → v11 normalisiert kaputte Einträge und leitet Layout deterministisch ab | `save-cadence.ts`, Migration-Tests |
| 6 | Fail-closed bei Save-Fault: kein Save/Journal aus Fehlerpfad | `world-tick.ts`, `reset()` |

## Logikkette (A → B → C)

```
A: ANALYSE & DESIGN (game-designer)
┌─────────────────────────────────────────────────────────────┐
│ 1. stop.flag prüfen → nicht vorhanden → Loop läuft          │
│ 2. AGENTS.md, docs/governance/INDEX.md gelesen              │
│ 3. .lane-claims/board-state.json geprüft                    │
│ 4. P0/P1 Issue identifiziert: #976 (P1 Save), #684 (P0 blockiert) │
│ 5. Design-Konzept erstellt (Ziel, Akzeptanzkriterien, Logikkette, Fragen) │
│ 6. Kontext-Chain-Eintrag erstellt (next_agent: jenova)      │
│ 7. Handoff an jenova via message_agent                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
B: IMPLEMENTIERUNG & VERIFIKATION (jenova → lillith → shinon)
┌─────────────────────────────────────────────────────────────┐
│ jenova: Design validieren → Save-System implementieren/testen│
│        → Ergebnis in Eintrag → message_agent(lillith)        │
│ lillith: QA/Validierung → Eintrag → message_agent(shinon)    │
│ shinon: Integration → Eintrag → message_agent(governance-office)│
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
C: REVIEW, ABSCHLUSS & STATUS (governance-office → maintainer → hermes)
┌─────────────────────────────────────────────────────────────┐
│ governance-office: Vertrag prüfen, Lücken, Typografie → Eintrag│
│                      → message_agent(maintainer)             │
│ maintainer: PR-Review → Merge/Close → Tag → Eintrag          │
│                      → message_agent(hermes)                 │
│ hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info    │
└─────────────────────────────────────────────────────────────┘
```

## Offene Fragen an die Implementierung (jenova)

1. **Save-Version:** Soll Save v11 als Basis bleiben oder wird eine neue Version (v12) benötigt?
2. **Migration:** Welche der v5–v10 Migrationen sind bereits implementiert, welche fehlen noch?
3. **Prüfsumme:** Soll die FNV-1a 32-Bit-Prüfsumme auf 64-Bit erweitert werden?
4. **Ledger-Integrität:** Soll `verifyBalanceSheet()` bei jedem Save automatisch aufgerufen werden (fail-closed)?
5. **PRNG-Namespace:** Werden gameplay und presentation Streams getrennt persistiert?
6. **Test-Ausführung:** Welche Tests können ohne node/pnpm laufen? Welche sind blockiert?
7. **Save-Pfad:** Wird der Save-Lokation (lokal, IndexedDB, Dateisystem) für Android berücksichtigt?

## Blocker (nicht loop-stoppend)

- `node` und `pnpm` sind nicht ausführbar in dieser Umgebung (Android-Terminal)
- `pnpm rbd docs read` kann nicht laufen → kein gültiger Receipt für PreToolUse-Hook
- `pnpm rbd verify light/fast` kann nicht ausgeführt werden
- Dies ist ein dokumentierter Blocker, kein Loop-Stopp

## Invarianten (gültig für den gesamten Loop)

- `stop.flag` wird vor jedem Schritt geprüft
- Jeder Kontext-Chain-Eintrag hat Owner und nächsten Agenten
- Keine Implementierung ohne vorheriges Design
- Jeder Schritt ist für den Nutzer sichtbar
- Kein direkter Push auf `main` — immer über Branch + PR + Maintainer-Merge

## Kontext-Chain-Eintrag

| Feld | Wert |
|------|------|
| entry_id | task-3-save-001 |
| task_id | 3 |
| priorität | P0 (für die Kette), P1 (für Issue #976) |
| erstellt_von | game-designer |
| status | bereit_für_implementation |
| current_agent | game-designer |
| next_agent | jenova |
| issue_id | 976 |
| blocker | node/pnpm nicht ausführbar (dokumentiert, nicht loop-stoppend) |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |

## Handoff-Format

```
HANDOFF an: jenova (@jenova)
Aufgabe: Entwurf für Issue #976 (P1 Save) validieren, Save-System implementieren, verifizieren, Ergebnis zurückschreiben
Nachweise: docs/LOOP-SAVE-KONZEPT.md (dieses Dokument)
Nächster Schritt nach jenova: lillith (QA/Validierung)
Danach: shinon → governance-office → maintainer → hermes (Status)
stop.flag: nicht vorhanden → Loop läuft
```
