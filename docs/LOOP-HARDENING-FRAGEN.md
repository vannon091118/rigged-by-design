# Entscheidungen zur Implementierung (jenova)

<!-- rbd-doc: managed -->

## Fragen zum Kontext-Chain-Eintrag

1. **Speicherort:** Soll der Kontext-Chain-Eintrag als Markdown-Datei unter `docs/loop-hardening/` abgelegt werden, oder reicht ein Eintrag in einer zentralen JSON/Registry-Datei?
2. **Namenskonvention:** Gibt es ein Präfix oder Schema für Kontext-Chain-Einträge (z. B. `loop-hardening-<datum>-<agent>.md`)?
3. **Status-Felder:** Welche Felder muss der Eintrag zwingend enthalten (owner, next_agent, status, sha, offene_fragen, blocker)?

## Fragen zur Implementierung der Loop-Härtung

4. **stop.flag-Prüfung:** Sollen wir ein zentrales Skript (`scripts/lib/stop-flag.mjs`) erstellen, das vor jedem agent-schritt die Existenz einer `stop.flag` prüft und bei Vorhandensein abbricht?
5. **Kontext-Chain-Automatisierung:** Soll `message_agent(target="jenova")` automatisch einen Kontext-Chain-Eintrag erstellen, oder geschieht das manuell durch game-designer?
6. **Parallele Worker (lillith/shinon):** Wird jenova die Implementierung allein durchführen, oder sollen lillith/shinon für spezifische Teilaufgaben (z. B. Tests, Dokumentation) hinzugezogen werden?
7. **Verifikation:** Welche Gates sollen nach der Implementierung laufen — `verify:light`, `verify:fast`, oder ein subset davon?
8. **Fehlerbehandlung bei Blocker:** Wenn ein Schritt blockiert (z. B. stop.flag gesetzt, Test fehlgeschlagen), soll automatisch ein Issue erstellt werden oder erfolgt die Eskalation nur über hermes → maintainer?

## Fragen zur Visualisierung

9. Soll die ASCII-Visualisierung zusätzlich als SVG gerendert werden (für die Doku), oder reicht die Textform?
10. Gibt es einen bevorzugten Ort für Visualisierungsartefakte (z. B. `docs/visual-rework/` oder `artifacts/`)?

## Nicht-blockierende Hinweise

- Der aktuelle Repo-Zustand hat keine `stop.flag` — der Loop läuft.
- Es gibt noch kein bestehendes Kontext-Chain-System im Repo; dieses Entwurf schafft die Grundlage.
- Alle 10 Fragen wurden von jenova beantwortet (siehe `docs/LOOP-HARDENING-KONTEXT.md`, Sektion "Beantwortung der offenen Fragen"). Das Design kann auf Basis der Entscheidungen fortgesetzt werden.
