# Konzept: Autonome Agenten-Chain für stundenlange Ausführung (Task #2, P0)

<!-- rbd-doc: managed -->

## Zweck

Dieses Dokument entwirft das System-Design für die **mechanisch erzwungene, stundenlange autonome Ausführung** der Agenten-Chain:

```
game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes
```

Die Chain soll ohne menschliches Zutun zwischen den Schritten über Stunden hinweg laufen können. Drei Säulen tragen das Design:

1. **Cron-Konfiguration** — wiederkehrender, automatischer Trigger der gesamten Chain in definierten Intervallen
2. **Autocompact-Integration** — bei Kontext-Fenster-Kompaktierung läuft die Chain automatisch weiter und stoppt nicht
3. **Visualisierung** — mechanische Erzwingung der Kette (ASCII, Textfluss)

## Rollen und Verantwortlichkeiten (erweitert)

| Rolle | Verantwortung in der autonomen Chain |
|---|---|
| **game-designer** | Entwirft Mechanik, erstellt Kontext-Chain-Eintrag, übergibt an jenova |
| **jenova** | Implementiert, testet, übergibt an lillith |
| **lillith** | QA/Validierung, übergibt an shinon |
| **shinon** | Integration, übergibt an governance-office |
| **governance-office** | Vertragsprüfung, Lücken, Typografie, übergibt an maintainer |
| **maintainer** | PR-Review, Merge/Close, Tag, entscheidet bei Blöcken |
| **hermes** | Status-Check, Loop-Vollständigkeit, Nutzer-Info, Cron-Überwachung |

## Säule 1: Cron-Konfiguration

### Cron-Trigger

Ein zentraler Cronjob (im `.hermes/cron/` oder `.cron/` des Repos) löst die Chain in definierten Intervallen aus. Vorgeschlagene Intervalle:

| Intervall | Zweck |
|---|---|
| Alle 10 Minuten | Kurze Prüfung: Chain aktiv? stop.flag gesetzt? Nächster Schritt fällig? |
| Alle 60 Minuten | Voller Chain-Durchlauf, wenn kein Schritt blockiert |
| Bei Bedarf (Event-gesteuert) | Handoff zwischen Agenten löst sofortigen nächsten Schritt aus |

### Cron-Logik (pro Durchlauf)

```bash
1. stop.flag prüfen
   ├─ vorhanden → Stopp, Meldung an maintainer, Cron-Ende
   └─ nicht vorhanden → Weiter zu Schritt 2

2. Kontext-Chain-Eintrag lesen (current_agent, next_agent, status)

3. Agent-Ausfallerkennung:
   ├─ Wenn current_agent == Agent selbst und status != loop_abgeschlossen:
   │   ├─ Wenn Antwort innerhalb X Minuten (z. B. 2x Cron-Intervall) → Weiter zu Schritt 4
   │   └─ Bei Timeout/Ausfall → Restart des Agenten (gleiche Rolle, frischer Kontext)
   │   │   ├─ Bei Erfolg → Weiter zu Schritt 4 mit Restart-Agent
   │   │   └─ Bei wiederholtem Ausfall → Turnover: anderer Agent übernimmt Rolle
   │   │       ├─ Zustände werden übertragen (kontext-chains-eintrag als externe Wahrheit)
   │   │       └─ Weiter zu Schritt 4 mit Turnover-Agent
   │
   └─ Weiter zu Schritt 4

4. Nächsten Agenten via message_agent triggern
5. Kontext-Chain-Eintrag aktualisieren (current_agent, last_activity_ts)
```

### Zustandsdatei (Kontext-Chain-Eintrag)

Der Kontext-Chain-Eintrag dient als **persistenter Zustandsbesitzer** der Chain. Er enthält:

- `entry_id` — eindeutige ID
- `current_agent` — welcher Bot gerade aktiv ist
- `next_agent` — welcher Bot als Nächstes dran ist
- `status` — z. B. `bereit_für_implementation`, `implementierung_gestartet`, `ergebnis_bereit`, `loop_abgeschlossen`
- `last_activity_ts` — Zeitstempel der letzten Aktivität (für Timeout-Erkennung)
- `cycle_id` — ID des aktuellen Chain-Zyklus
- `stop.flag_geprüft` — boolean

## Säule 2: Autocompact-Integration

### Problem

Wenn das Kontext-Fenster eines Agents kompaktiert wird (z. B. durch Hermes intern), geht der laufende Kontext des Chain-Schritts verloren. Der Agent "vergisst", dass er mitten in einer Chain-Aktion ist.

### Lösung: Kontext-Chain-Eintrag als externe Wahrheit

Der Kontext-Chain-Eintrag (unter `docs/loop-hardening/` oder zentral) ist die **einzige externe Wahrheit** über den Chain-Zustand. Er lebt außerhalb des Kontext-Fensters einzelner Agenten.

### Autocompact-Workflow

```
1. Agent A erhält Handoff für Chain-Schritt N
2. Agent A liest Kontext-Chain-Eintrag → next_agent == A, status == wartet_auf_A
3. Agent A führt Schritt N aus
4. Agent A schreibt Ergebnis in Kontext-Chain-Eintrag → status == ergebnis_bereit, next_agent == B
5. Agent A sendet message_agent(target="B")
6. [Kontext-Fenster von A wird kompaktiert — egal, Zustand ist im Eintrag gespeichert]
7. Cronjob oder Agent B liest Kontext-Chain-Eintrag → next_agent == B, status == wartet_auf_B
8. Agent B setzt fort
```

### Resume-Mechanismus nach Kompaktierung

Wenn ein Agent nach Kompaktierung neu gestartet wird:

```
1. Agent startet neu, Kontext-Fenster leer
2. Agent liest Kontext-Chain-Eintrag
3. Wenn current_agent == Agent selbst und status != loop_abgeschlossen:
   → Agent setzt dort fort, wo der Eintrag steht (kein Neustart von Schritt 1)
4. Wenn current_agent != Agent selbst:
   → Agent wartet auf seinen Handoff (nichts tun)
```

## Säule 3: Mechanische Erzwingung

### stop.flag als Master-Kill-Switch

- Vor **jedem** Schritt wird `stop.flag` geprüft
- Bei Vorhandensein: sofortiger Stopp, Meldung an maintainer, Chain friert ein
- Erst nach manueller Entfernung von `stop.flag` durch maintainer läuft die Chain weiter

### Timeout-Erkennung

Der Cronjob überwacht `last_activity_ts` im Kontext-Chain-Eintrag:

- Wenn `now - last_activity_ts > 60 Minuten` und `status != loop_abgeschlossen`:
  → Blocker erkannt, Meldung an maintainer, Chain wird als `blockiert` markiert

### Fail-Closed-Verhalten

- Jeder Schritt ist fail-closed: Bei Unsicherheit (fehlender Eintrag, unklarer Status) stoppt der Schritt und meldet an maintainer
- Kein Schritt wird doppelt ausgeführt (Idempotenz durch `cycle_id` und `status`)

## Logikkette (A → B → C)

```
A: TRIGGER & ZUSTAND (Cronjob)
┌─────────────────────────────────────────────────────────────┐
│ 1. stop.flag prüfen → vorhanden? → STOPP → an maintainer   │
│ 2. Kontext-Chain-Eintrag lesen                              │
│ 3. current_agent + status bestimmen                         │
│ 4. Nächsten Agenten via message_agent triggern              │
│ 5. Kontext-Chain-Eintrag aktualisieren (current_agent, ts)  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
B: AGENTEN-CHAIN (jenova → lillith → shinon → governance-office → maintainer → hermes)
┌─────────────────────────────────────────────────────────────┐
│ jenova:  Entwurf validieren → implementieren → testen       │
│          → Ergebnis in Eintrag → message_agent(lillith)     │
│ lillith: QA/Validierung → Ergebnis in Eintrag → message_agent(shinon)│
│ shinon:  Integration → Ergebnis in Eintrag → message_agent(governance-office)│
│ governance-office: Vertrag prüfen → Ergebnis in Eintrag → message_agent(maintainer)│
│ maintainer: PR-Review → Merge/Close → Tag → Ergebnis in Eintrag → message_agent(hermes)│
│ hermes:  Status-Check → Loop-Vollständigkeit → Nutzer-Info → Eintrag: loop_abgeschlossen│
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
C: ZYKLUS-ABSCHLUSS & WIEDERHOLUNG
┌─────────────────────────────────────────────────────────────┐
│ 1. Eintrag: status = loop_abgeschlossen, cycle_id abgeschlossen│
│ 2. Cronjob startet neuen Zyklus (neue cycle_id)             │
│ 3. Bei stop.flag: Chain eingefroren bis Entfernung          │
└─────────────────────────────────────────────────────────────┘
```

## Invarianten (gültig für den gesamten autonomen Lauf)

- `stop.flag` wird vor **jedem** Schritt geprüft — bei Vorhandensein: sofortiger Stopp
- Der Kontext-Chain-Eintrag ist die einzige externe Wahrheit über den Chain-Zustand
- Kein Agent startet einen Schritt ohne vorherigen Handoff oder Cron-Trigger
- Jeder Schritt schreibt sein Ergebnis in den Kontext-Chain-Eintrag, bevor er den nächsten Agenten triggert
- Nach Kontext-Fenster-Kompaktierung setzt der Agent am Kontext-Chain-Eintrag an, nicht bei Schritt 1 neu
- Kein direkter Push auf `main` — immer über Branch + PR + Maintainer-Merge
- Der Cronjob ist der einzige automatische Trigger; manuelle Trigger sind möglich, aber nicht erforderlich
- Agent-Ausfall (keine Antwort, Fehler, Timeout) → Restart (gleiche Rolle, frischer Kontext) oder Turnover (anderer Agent übernimmt Rolle, Zustände werden übertragen über Kontext-Chain-Eintrag)

## Abgrenzung zu Task #1 (Loop-Hardening)

Task #1 entwarf das statische Design (Konzept, Logikkette, Visualisierung, Fragen) für die Loop-Härtung. Task #2 baut darauf auf und fügt die **mechanische Erzwingung** hinzu: Cron-Trigger, Autocompact-Resilienz und dauerhafte Ausführung über Stunden.
