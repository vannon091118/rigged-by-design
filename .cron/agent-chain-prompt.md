# Agenten-Chain-Cron-Prompt (Version 1.0)

Dieser Prompt steuert den automatischen Trigger der autonomen Agenten-Chain
(game-designer → jenova → lillith → shinon → governance-office → maintainer → hermes)
in definierten Intervallen via Cronjob. Er liegt versioniert unter
`.cron/agent-chain-prompt.md` und ist Gegenstand von Code Review.

## Voraussetzung

- Kein `GITHUB_TOKEN` erforderlich für Worker-Prozesse. Der Cronjob triggert
  ausschließlich über `message_agent` und liest den Kontext-Chain-Eintrag.
- Der Token wird **nicht** in diesem Prompt hardcoded.

## Auftrag

Der Cronjob ist der automatische Trigger der Chain. Er läuft in zwei Intervallen:

### Kurze Prüfung (alle 10 Minuten)
1. `stop.flag` prüfen → vorhanden → Stopp, Meldung an maintainer, Cron-Ende
2. Kontext-Chain-Eintrag lesen (current_agent, next_agent, status, cycle_id)
3. `last_activity_ts` prüfen: Wenn >60 Minuten ohne Aktivität und `status != loop_abgeschlossen`
   → Blocker an maintainer melden, Eintrag als `blockiert` markieren
4. Wenn `current_agent == game-designer` und `status == bereit_für_implementation`:
   → `message_agent(target="jenova")` mit Kontext-Chain-Pfad
   → Eintrag aktualisieren: `current_agent=jenova`, `last_activity_ts=jetzt`
5. Wenn `current_agent == jenova` und `status == ergebnis_bereit`:
   → `message_agent(target="lillith")` mit Kontext-Chain-Pfad
   → Eintrag aktualisieren: `current_agent=lillith`
6. ... analog für shinon, governance-office, maintainer, hermes
7. Wenn `status == loop_abgeschlossen`: Chain für dieses Zyklus beendet.

### Voller Durchlauf (alle 60 Minuten)
- Gleiche Logik wie kurze Prüfung, aber mit expliziter Prüfung aller Agenten-Status.
- Falls ein Agent überfällig ist (kein Handoff seit >60 Min): Blocker an maintainer.

## Zustandsdatei (Kontext-Chain-Eintrag)

Der Kontext-Chain-Eintrag (unter `docs/loop-autonomy/`) ist die einzige externe
Wahrheit über den Chain-Zustand. Er enthält:
- `entry_id` — eindeutige ID
- `current_agent` — welcher Bot gerade aktiv ist
- `next_agent` — welcher Bot als Nächstes dran ist
- `status` — z. B. `bereit_für_implementation`, `implementierung_gestartet`, `ergebnis_bereit`, `loop_abgeschlossen`, `blockiert`
- `last_activity_ts` — Zeitstempel der letzten Aktivität (für Timeout-Erkennung)
- `cycle_id` — ID des aktuellen Chain-Zyklus
- `stop.flag_geprüft` — boolean

## Idempotenz

Ein Schritt wird nur ausgeführt, wenn `current_agent == Ziel-Agent` und der
erwartete `status` passt. Doppelte Ausführung wird durch `cycle_id` + `status`
verhindert.

## Autocompact-Resilienz

Nach Kontext-Fenster-Kompaktierung startet der Agent neu:
1. Liest Kontext-Chain-Eintrag
2. Wenn `current_agent == Selbst` und `status != loop_abgeschlossen`:
   → Setzt fort beim gespeicherten status (kein Neustart von Schritt 1)
3. Wenn `current_agent != Selbst`: Wartet auf Handoff (nichts tun)

## Grenzen

- Kein Direktpush auf `main`, kein Force-Push, keine History-Umschreibung.
- Der Cronjob triggert nur über `message_agent`; er führt keine Agenten-Schritte selbst aus.
- Bei Unsicherheit (fehlender Eintrag, unklarer Status): Schritt stoppt und meldet an maintainer (fail-closed).
