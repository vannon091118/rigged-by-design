# Visualisierung: Autonome Loop-Mechaniken (A → B → C)

<!-- rbd-doc: managed -->

## Offizielle Loop-Kette

```
game-designer → jenova → lillith → shinon → governance-office → maintainer
```

Hinweise:
- Jenovas Handoff-Ziel ist **lillith** (nicht maintainer)
- governance-office gibt an **maintainer** weiter (nicht an hermes)
- hermes erhält den finalen Status-Check, ist aber nicht in der direkten Handoff-Kette

## ASCII-Übersicht (Logikkette)

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ A: DESIGN & HANDOFF (game-designer)                                         │
 │                                                                             │
 │  [Start]                                                                    │
 │     │                                                                       │
 │     ▼                                                                       │
 │  stop.flag prüfen ──► existiert? ──┬─ JA ──► STOPP → an maintainer melden   │
 │                                   └─ NEIN                                    │
 │     │                                                                       │
 │     ▼                                                                       │
 │  Konzept entwerfen (Mechanik, Logikkette, Fragen)                           │
 │     │                                                                       │
 │     ▼                                                                       │
 │  Kontext-Chain-Eintrag erstellen                                            │
 │     │                                                                       │
 │     ▼                                                                       │
 │  message_agent(target="jenova")  ─────────────────────────────────────────┐ │
 │                                                                             │ │
 └───────────────────────────────────────────────────────────────────────────┘ │ │
                                                                              ▼ │
 ┌─────────────────────────────────────────────────────────────────────────────┐ │
 │ B: IMPLEMENTIERUNG & VERIFIKATION                                           │ │
 │                                                                             │ │
 │  jenova: Kontext-Chain-Eintrag lesen                                        │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  jenova: Entwurf validieren                                                 │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  jenova: Code implementieren (Claim-Scope)                                  │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  jenova: Tests (pnpm rbd verify light / fast)                               │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  jenova → Handoff an lillith                                                │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  lillith: übernimmt Implementierung                                         │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  lillith → Handoff an shinon                                                │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  shinon: übernimmt, übergibt an governance-office                           │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 └───────────────────────────────────────────────────────────────────────────┘ │ │
                                                                              ▼ │
 ┌─────────────────────────────────────────────────────────────────────────────┐ │
 │ C: REVIEW, ABSCHLUSS & STATUS                                               │ │
 │                                                                             │ │
 │  governance-office: Vertrag prüfen, Lücken melden, Typografie               │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  governance-office → Handoff an maintainer                                  │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  maintainer: PR-Review → Merge/Close → Tag                                  │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  hermes: Status-Check aller Bots, Loop-Vollständigkeit, Nutzer-Info         │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  [Loop bereit für nächsten Zyklus]                                          │ │
 └─────────────────────────────────────────────────────────────────────────────┘ │
                                                                               │
                                                                               ▼
```

## System-Verkettung (A → B → C, kompakt)

```
A: game-designer
  ├─ stop.flag prüfen
  ├─ Konzept entwerfen (dieses Dokument)
  ├─ Logikkette + Visualisierung
  ├─ Offene Fragen formulieren
  └─ Kontext-Chain-Eintrag erstellen
       │ message_agent(target="jenova")
       ▼
B: jenova → lillith → shinon
  ├─ jenova: Entwurf validieren, implementieren, testen
  ├─ jenova → Handoff an lillith
  ├─ lillith: übernimmt Implementierung
  ├─ lillith → Handoff an shinon
  ├─ shinon: übernimmt, übergibt an governance-office
       │
       ▼
C: governance-office → maintainer → hermes
  ├─ governance-office: Vertrag prüfen, Lücken, Typografie
  ├─ governance-office → Handoff an maintainer
  ├─ maintainer: PR-Review, Merge/Close, Tag
  └─ hermes: Status-Check, Loop-Vollständigkeit, Nutzer-Info
```

## Invarianten (sichtbar und beeinflussbar)

```
stop.flag ───┐
             ▼
┌──────────────────────────────────────────────────────────────┐
│  JEDER Schritt prüft stop.flag vor Ausführung                │
│  JEDER Kontext-Chain-Eintrag hat Owner + nächsten Agenten    │
│  Keine Implementierung ohne vorheriges Design                │
│  JEDER Schritt ist für den Nutzer sichtbar (hermes-Status)   │
│  Kein direkter Push auf main (immer Branch + PR + Merge)     │
│  Handoff-Kette: jenova → lillith → shinon → governance-office│
│    → maintainer (hermes erhält Status, kein Handoff-Ziel)    │
└──────────────────────────────────────────────────────────────┘
```
