# Visualisierung: Mechanische Erzwingung der autonomen Agenten-Chain (Task #2)

<!-- rbd-doc: managed -->

## Offizielle Chain-Kette

```
game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes
```

## ASCII-Übersicht: Cron-gesteuerter Chain-Lauf

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ CRONJOBS — Automatischer Trigger (alle 2-7 Min / alle 60 Min)                │
 │                                                                             │
 │  [Cron-Tick]                                                                │
 │     │                                                                       │
 │     ▼                                                                       │
 │  stop.flag prüfen ──► existiert? ──┬─ JA ──► STOPP → an maintainer melden   │
 │                                   └─ NEIN                                    │
 │     │                                                                       │
 │     ▼                                                                       │
 │  Kontext-Chain-Eintrag lesen                                                │
 │     │                                                                       │
 │     ▼                                                                       │
 │  current_agent + status bestimmen                                           │
 │     │                                                                       │
 │     ▼                                                                       │
 │  message_agent(target=current_agent) ─────────────────────────────────────┐ │
 │                                                                             │ │
 └───────────────────────────────────────────────────────────────────────────┘ │ │
                                                                              ▼ │
 ┌─────────────────────────────────────────────────────────────────────────────┐ │
 │ AGENTEN-CHAIN (mechanisch erzwungen)                                         │ │
 │                                                                             │ │
 │  jenova:  liest Eintrag → validiert → implementiert → testet               │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  schreibt Ergebnis in Eintrag (status=ergebnis_bereit, next=lillith)       │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  message_agent(target="lillith")                                            │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  lillith: liest Eintrag → QA/Validierung → schreibt Ergebnis               │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  message_agent(target="shinon")                                             │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  shinon: liest Eintrag → Integration → schreibt Ergebnis                    │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  message_agent(target="governance-office")                                  │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  governance-office: liest Eintrag → Vertrag prüfen → schreibt Ergebnis      │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  message_agent(target="maintainer")                                         │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  maintainer: liest Eintrag → PR-Review → Merge/Close → Tag                  │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  message_agent(target="hermes")                                             │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  hermes: liest Eintrag → Status-Check → Loop-Vollständigkeit → Nutzer-Info │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  Eintrag: status = loop_abgeschlossen                                       │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 └───────────────────────────────────────────────────────────────────────────┘ │ │
                                                                              ▼ │
 ┌─────────────────────────────────────────────────────────────────────────────┐ │
 │ AUTOCOMPACT-RESILIENZ                                                        │ │
 │                                                                             │ │
 │  [Kontext-Fenster kompaktiert]                                              │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  Agent startet neu, Kontext-Fenster leer                                    │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  Liest Kontext-Chain-Eintrag (externe Wahrheit)                             │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  current_agent == Selbst? ──┬─ JA ──► Setzt fort beim gespeicherten status │ │
 │                             └─ NEIN ──► Wartet auf Handoff (nichts tun)    │ │
 │                                                                             │ │
 └───────────────────────────────────────────────────────────────────────────┘ │ │
                                                                              ▼ │
 ┌─────────────────────────────────────────────────────────────────────────────┐ │
 │ ZYKLUS-ABSCHLUSS & WIEDERHOLUNG                                              │ │
 │                                                                             │ │
 │  status = loop_abgeschlossen                                                │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  Nächster Cron-Durchlauf: neue cycle_id, neuer Zyklus                       │ │
 │     │                                                                       │ │
 │     ▼                                                                       │ │
 │  [stop.flag gesetzt? → Chain eingefroren bis Entfernung]                    │ │
 │                                                                             │ │
 └─────────────────────────────────────────────────────────────────────────────┘
```

## Kompakte System-Verkettung (A → B → C)

```
A: TRIGGER & ZUSTAND (Cronjob)
  ├─ stop.flag prüfen (vor jedem Lauf)
  ├─ Kontext-Chain-Eintrag lesen
  ├─ current_agent + status bestimmen
  ├─ message_agent(target=current_agent)
  └─ Eintrag aktualisieren (current_agent, last_activity_ts)
       │
       ▼
B: AGENTEN-CHAIN (jenova → lillith → shinon → governance-office → maintainer → hermes)
  ├─ jenova: validieren → implementieren → testen → Eintrag → message_agent(lillith)
  ├─ lillith: QA → Eintrag → message_agent(shinon)
  ├─ shinon: Integration → Eintrag → message_agent(governance-office)
  ├─ governance-office: Vertrag prüfen → Eintrag → message_agent(maintainer)
  ├─ maintainer: PR-Review → Merge/Close → Tag → Eintrag → message_agent(hermes)
  └─ hermes: Status-Check → Loop-Vollständigkeit → Nutzer-Info → Eintrag: loop_abgeschlossen
       │
       ▼
C: RESILIENZ & WIEDERHOLUNG (Autocompact + Cron)
  ├─ Kontext-Fenster kompaktiert? → Eintrag lesen → fortfahren beim gespeicherten status
  ├─ Timeout (>60 Min ohne Aktivität)? → Blocker an maintainer melden
  ├─ Agent-Ausfall (keine Antwort, Fehler, Timeout)? → Restart (gleiche Rolle, frischer Kontext) oder Turnover (anderer Agent übernimmt Rolle, Zustände übertragen)
  ├─ stop.flag gesetzt? → Chain eingefroren
  └─ Zyklus abgeschlossen? → Neue cycle_id, nächster Cron-Durchlauf startet neuen Zyklus
```

## Invarianten (mechanische Erzwingung)

```
stop.flag ───┐
             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  JEDER Schritt prüft stop.flag vor Ausführung                                │
│  Kontext-Chain-Eintrag ist einzige externe Wahrheit (überlebt Autocompact)   │
│  Kein Agent startet ohne Handoff oder Cron-Trigger                           │
│  Jeder Schritt schreibt Ergebnis vor Handoff an nächsten Agenten              │
│  Nach Kompaktierung: Fortsetzung beim gespeicherten status (nicht bei Schritt 1)│
│  Timeout >60 Min ohne Aktivität → Blocker an maintainer                      │
│  Agent-Ausfall (keine Antwort, Fehler, Timeout) → Restart oder Turnover      │
│  Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)          │
│  Handoff-Kette: jenova → lillith → shinon → governance-office → maintainer → hermes│
└──────────────────────────────────────────────────────────────────────────────┘
```

## Zeitliche Abfolge (Stundenlauf-Beispiel)

```
T+0min:    Cron-Tick → game-designer startet Zyklus 1
T+2min:    game-designer → message_agent(jenova)
T+5min:    jenova implementiert → message_agent(lillith)
T+12min:   lillith QA → message_agent(shinon)
T+20min:   shinon Integration → message_agent(governance-office)
T+30min:   governance-office Vertrag → message_agent(maintainer)
T+45min:   maintainer PR-Review → Merge → message_agent(hermes)
T+50min:   hermes Status-Check → loop_abgeschlossen
T+60min:   Cron-Tick → neuer Zyklus (cycle_id+1) oder stop.flag-Prüfung
...
T+360min:  (6 Stunden später) Chain läuft weiterhin autonom, solange stop.flag nicht gesetzt
```
