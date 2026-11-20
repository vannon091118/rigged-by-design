# Offene Fragen an die Implementierung (jenova) — Task #2

<!-- rbd-doc: managed -->

## Fragen zur Cron-Konfiguration

1. **Cron-Ort:** Soll der Cronjob im `.hermes/cron/` (Hermes-intern) oder im `.cron/` des Repos (versioniert) eingerichtet werden? Oder beides mit getrennten Verantwortlichkeiten?
2. **Cron-Intervalle:** Welche Intervalle sind sinnvoll — alle 2-7 Minuten für kurze Prüfung, alle 60 Minuten für vollen Durchlauf? Oder andere Intervalle?
3. **Cron-Trigger-Mechanismus:** Wie wird der Cronjob den nächsten Agenten triggern? Über `message_agent`, über einen Shell-Befehl, oder über eine andere Schnittstelle?
4. **Token-Sicherheit:** Der Maintainer-Cronjob benötigt `GITHUB_TOKEN` als Umgebungsvariable (siehe `.cron/SECURITY.md`). Wie wird sichergestellt, dass Worker-Prozesse diesen Token nicht erhalten?

## Fragen zur Autocompact-Integration

5. **Eintrag-Speicherort:** Soll der Kontext-Chain-Eintrag unter `docs/loop-hardening/` abgelegt werden, oder an einer zentralen Stelle, die auch nach Kontext-Kompaktierung erreichbar bleibt?
6. **Resume-Detektion:** Wie erkennt ein Agent nach Kontext-Kompaktierung, dass er mitten in einer Chain-Aktion ist? Über `current_agent == Selbst` im Eintrag?
7. **Idempotenz:** Wie wird sichergestellt, dass ein Schritt nicht doppelt ausgeführt wird, wenn ein Agent nach Kompaktierung neu startet und den Eintrag liest? Über `cycle_id` + `status`?
8. **Zeitstempel:** Wer setzt `last_activity_ts` im Kontext-Chain-Eintrag — der Cronjob oder jeder Agent selbst?

## Fragen zu stop.flag und Zeitouts

9. **stop.flag-Prüfung im Cron:** Soll der Cronjob `stop.flag` vor jedem Durchlauf prüfen, oder nur jeder Agent vor seinem Schritt?
10. **Timeout-Schwelle:** Ist 60 Minuten ohne Aktivität die richtige Schwelle für Blocker-Erkennung, oder soll sie konfigurierbar sein?
11. **Timeout-Aktion:** Bei Timeout — soll der Cronjob automatisch den nächsten Agenten triggern, oder nur einen Blocker an maintainer melden?

## Fragen zur Visualisierung und Dokumentation

12. **ASCII vs SVG:** Soll die Visualisierung zusätzlich als SVG gerendert werden, oder reicht die Textform (ASCII)?
13. **Dokumenten-Ort:** Sollen die Task-#2-Dokumente unter `docs/loop-autonomy/` oder direkt unter `docs/` abgelegt werden?

## Nicht-blockierende Hinweise

- Der aktuelle Repo-Zustand hat keine `stop.flag` — der Loop läuft.
- Es gibt bereits eine Cron-Infrastruktur (`.cron/maintainer-prompt.md` v2.0, läuft alle 10 Minuten) und Hermes-eigenes Cron (`.hermes/cron/` mit `executions.db`, `ticker_heartbeat`).
- Alle 13 Fragen wurden von jenova beantwortet (siehe `docs/LOOP-AUTONOMY-KONTEXT.md`, Sektion "Beantwortung der offenen Fragen"). Das Design kann auf Basis der Entscheidungen fortgesetzt werden.
