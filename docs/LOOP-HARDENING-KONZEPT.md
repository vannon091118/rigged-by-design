# Konzept: Prüfung und Härtung der autonomen Loop-Mechaniken

<!-- rbd-doc: managed -->

## Zweck

Dieses Dokument entwirft das System-Design für die Prüfung und Härtung der
**autonomen Loop-Mechaniken** — also des agent-zu-agent Koordinationsloops, der
game-designer → jenova → (lillith/shinon) → maintainer → governance-office →
hermes verbindet. Ziel ist ein sichtbarer, beeinflussbarer und nachweisbar
stabiler Loop, der bei jedem Schritt prüfbar ist und bei Blöcken klar
eskaliert.

## Rollen im Loop

| Rolle | Verantwortung |
|---|---|
| **game-designer** | Entwirft Mechaniken, leitet Logikkette ab, schlägt Visualisierung vor, formuliert offene Fragen, erstellt Kontext-Chain-Eintrag, übergibt an jenova |
| **jenova** | Implementiert die entworfenen Mechaniken, baut Tests, liefert Ausführungsergebnis, übergibt an lillith |
| **lillith** | Entwicklungs-Worker, übernimmt jenovas Implementierung, übergibt an shinon |
| **shinon** | Entwicklungs-Worker, übernimmt lilliths Arbeit, übergibt an governance-office |
| **governance-office** | Prüft Vertrag und Lücken, überarbeitet Typografie, meldet Brüche, gibt an maintainer weiter |
| **maintainer** | Reviewt PRs, merged oder schließt, taggt Releases, entscheidet bei Blöcken |
| **hermes** | Status-Check, orchestriert den Loop, meldet Vollständigkeit an den Nutzer |

## Logikkette (A → B → C)

```
A: DESIGN & HANDOFF                         B: IMPLEMENTIERUNG & VERIFIKATION
┌─────────────────────────────┐             ┌─────────────────────────────┐
│ 1. stop.flag prüfen         │             │ 5. Kontext-Chain-Eintrag    │
│    → bei Vorhandensein:     │             │    lesen, Entwurf validieren│
│       Stopp, an maintainer  │             │ 6. Code implementieren      │
│       melden                │             │    (jenova)                 │
│ 2. Konzept entwerfen        │             │ 7. Tests schreiben & laufen │
│    (dieses Dokument)        │             │    lassen, Verifikation     │
│ 3. Logikkette + Visualisierung│         │ 8. Ergebnis an lillith        │
│    + offene Fragen          │             │    übergeben (Handoff)      │
│ 4. Kontext-Chain-Eintrag    │             │ 9. lillith übernimmt,       │
│    erstellen                │             │    übergibt an shinon       │
│ 5. message_agent(target=jenova)│       │ 10. shinon übernimmt,         │
│                             │             │    übergibt an governance   │
└───────────────┬─────────────┘             │    office                   │
                │                           └───────────────┬─────────────┘
                ▼                                           ▼
        ┌─────────────────────────────────────────────────────────────┐
        C: REVIEW, ABSCHLUSS & STATUS                                     │
        ┌─────────────────────────────┐                                 │
        │ 11. governance-office:      │                                 │
        │     Vertragsprüfung,        │                                 │
        │     Lücken, Typografie,     │                                 │
        │     gibt an maintainer      │                                 │
        │ 12. maintainer: PR-Review,  │                                 │
        │     Merge/Close, Tag        │                                 │
        │ 13. hermes: Status-Check,   │                                 │
        │     Loop-Vollständigkeit,   │                                 │
        │     Nutzer-Info             │                                 │
        └─────────────────────────────┘                                 │
                                                                        │
                                                                        ▼
                                                             Loop bereit für nächsten Zyklus
```

## System-Verkettung (Detailliert)

### Schritt A — Design & Handoff (game-designer)

1. `stop.flag` prüfen → existiert nicht → Loop läuft weiter
2. Konzept entwerfen: Mechanik-Beschreibung, Logikkette, Visualisierung, offene Fragen
3. Kontext-Chain-Eintrag erstellen (siehe `docs/LOOP-HARDENING-KONTEXT.md`)
4. `message_agent(target="jenova", ...)` mit dem Entwurf und dem Kontext-Chain-Pfad

### Schritt B — Implementation & Verification (jenova → lillith → shinon)

5. Kontext-Chain-Eintrag lesen, Entwurf validieren
6. Implementierung im Claim-Scope durchführen (jenova)
7. Gezielte Tests: `pnpm rbd verify light` bzw. `pnpm rbd verify fast` (jenova)
8. Ergebnis an lillith übergeben (Handoff)
9. lillith übernimmt Implementierung, übergibt an shinon
10. shinon übernimmt, übergibt an governance-office

### Schritt C — Review, Abschluss & Status (governance-office → maintainer → hermes)

11. governance-office: Vertragsprüfung, Lücken melden, Typografie überarbeiten, gibt an maintainer weiter
12. maintainer: PR-Review, Merge oder Close, Tag
13. hermes: Status-Check aller Bots, Loop-Vollständigkeit, Nutzer informieren

## Invarianten (müssen jederzeit wahr sein)

- **stop.flag wird vor jedem Schritt geprüft** — bei Vorhandensein: sofortiger Stopp, Meldung an maintainer
- **Jeder Kontext-Chain-Eintrag hat einen eindeutigen Owner und einen nächsten Agenten**
- **Keine Implementierung ohne vorheriges Design** (jenova baut nicht ohne Konzept)
- **Jeder Schritt ist für den Nutzer sichtbar** (Statusmeldungen an hermes, Kontext-Chain-Einträge im Repo)
- **Kein direkter Push auf main** — immer über Branch + PR + Maintainer-Merge

## Abgrenzung zum Spiel-Loop

Dieses Dokument betrifft den **agenten-autonomen Loop** (Koordination der Bots), nicht den
**Spiel-Simulations-Loop** (tickWorld, dayPhase, Ledger etc. in `src/core/`). Beides ist
unabhängig zu prüfen und zu härten.
