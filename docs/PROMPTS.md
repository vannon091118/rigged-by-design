# Prompt-Register

<!-- rbd-doc: managed -->

**Zweck:** Jeder Prompt, der das Verhalten von Maintainern oder Agenten regelt, steht hier mit Pfad, Schweregrad und Board-Issue. Die Regel selbst steht in [`GOVERNANCE.md`](GOVERNANCE.md#prompt-register); diese Datei ist ihre Belegliste und wird maschinell gelesen.

## Register

Die Tabelle ist die einzige Quelle für die Zuordnung Prompt → Issue. `pnpm run verify:docs` liest die Spalten `Prompt`, `Pfad`, `Art`, `Sev` und `Issue` und schlägt fehl, wenn ein Eintrag, sein Schweregrad oder sein Issue fehlt oder eine `.cron/*.md` unregistriert bleibt. `pnpm run board:sync -- --at <ISO>` übernimmt die Einträge als `promptIssues` in [`.lane-claims/board-state.json`](../.lane-claims/board-state.json).

| Prompt | Pfad | Art | Sev | Issue |
| --- | --- | --- | --- | --- |
| Maintainer-Cron-Prompt | `.cron/maintainer-prompt.md` | datei | sev-1 | #892 |
| Cron-Security-Regeln | `.cron/SECURITY.md` | datei | sev-2 | #890 |
| System-Reminder (MAIN PROMPT) | `scheduled/main-prompt` | external | sev-1 | #893 |
| Kurzvertrag | `AGENTS.md` | datei | sev-2 | #891 |
| Kanonische Regeln | `docs/GOVERNANCE.md` | datei | sev-1 | #889 |

## Pflege

- Ein neuer Prompt braucht zuerst ein Issue auf dem Board mit `incident-sev-*`, `incident-open` und `causal-chain`, dann eine Zeile hier.
- Ein geänderter Prompt nennt seine Issue-Nummer im Commit; das Issue bleibt offen, bis der Maintainer es schließt.
- `Art = datei` verlangt einen existierenden Pfad im Repo; `Art = external` heißt: der Prompt liegt außerhalb des Repos (etwa der System-Reminder der geplanten Ausführung) und hat trotzdem dieselbe Issue-Pflicht. Sein kanonischer Inhalt verweist auf die Repo-Dateien, statt Regeln zu wiederholen.
- Abgedeckt sein müssen `AGENTS.md`, `docs/GOVERNANCE.md` und jede `.cron/*.md`; ein fehlender Eintrag ist ein roter Gate-Befund, kein Hinweis.
