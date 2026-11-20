# Cron-Konfiguration: Autonome Agenten-Chain (Task #2, P0)

Dieses Dokument definiert die Cron-Intervalle und Trigger-Mechanismen für die
mechanisch erzwungene, stundenlange autonome Ausführung der Agenten-Chain.

## Cron-Intervalle

| Intervall | Zweck | Ausführung |
|-----------|-------|------------|
| Alle 10 Minuten | Kurze Prüfung: stop.flag, Chain-aktiv, nächster Schritt fällig | `.cron/agent-chain-prompt.md` (kurze Prüfung) |
| Alle 60 Minuten | Voller Chain-Durchlauf bei nicht blockierten Schritten | `.cron/agent-chain-prompt.md` (voller Durchlauf) |
| Event-gesteuert | Handoff zwischen Agenten löst sofortigen nächsten Schritt aus | `message_agent(target=<next_agent>)` |

## Trigger-Mechanismus

Der Cronjob liest den Kontext-Chain-Eintrag (`docs/loop-autonomy/loop-autonomy-001.md`)
und triggert den aktuellen Agenten über `message_agent(target=<current_agent>)`
mit dem Kontext-Chain-Pfad.

## Token-Sicherheit

- `GITHUB_TOKEN` wird **ausschließlich als Umgebungsvariable** bereitgestellt.
- Der Token wird **niemals** im Cronjob-Prompt, in Kommentaren oder in irgendeiner
  Datei im Repository hardcoded.
- Worker-Prozesse (jenova, lillith, shinon) erhalten den Token nicht.
- Der Token bleibt ausschließlich im isolierten Maintainer-Kontext.

## Autocompact-Integration

Der Kontext-Chain-Eintrag ist die einzige externe Wahrheit über den Chain-Zustand.
Er überlebt Kontext-Fenster-Kompaktierung. Nach Kompaktierung setzt ein Agent
beim gespeicherten `status` fort (nicht bei Schritt 1 neu).

## Timeout-Erkennung

- Schwelle: 60 Minuten ohne Aktivität (`last_activity_ts`)
- Konfigurierbar über Umgebungsvariable `RBD_CHAIN_TIMEOUT_MIN` (Default: 60)
- Bei Timeout: Blocker an maintainer melden, Eintrag als `blockiert` markieren

## stop.flag als Master-Kill-Switch

- Vor jedem Schritt wird `stop.flag` geprüft (Cronjob UND jeder Agent)
- Bei Vorhandensein: sofortiger Stopp, Meldung an maintainer, Chain friert ein
- Erst nach manueller Entfernung von `stop.flag` durch maintainer läuft die Chain weiter
