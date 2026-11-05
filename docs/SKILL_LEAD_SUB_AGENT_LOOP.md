# Skill: Lead–Sub-Agent-Prüfschleife (`lead-sub-agent-loop`)

## Zweck

Ein generischer DSH-Skill für die Qualitätssicherung von Änderungen vor einem Pull Request. Jede Code-Änderung geht durch einen doppelten adversarial Review (zwei unabhängige Sub-Agenten) und eine abschließende kausale Prüfung durch den Lead, bevor sie in einen Arbeitsbranch committet wird.

Der Skill läuft **reihum (sequenziell), nicht parallel**. Jeder Schritt hat eine klare, begrenzte Ausgabe (Plan, Review-Bericht oder Freigabe-Entscheidung), sodass immer ersichtlich ist, wer als Nächstes handelt und worüber entschieden wird.

## Wann aktivieren

Am Anfang einer Änderungsaufgabe, **bevor** der Lead irgendeine Datei liest oder editet. Nicht für reine Fragen, Analyse-only-Arbeit oder rein sprachliche/anzeigende Arbeit.

## Rollen

- **LEAD** (der aktuelle Agent / Team Lead): Plant den Auftrag gegen den Code, spawnet Teammitglieder, korrigiert den Plan, entscheidet über Freigabe, committet.
- **SUB A** (erstes Teammitglied): Adversarial Review des Plans; prüft den korrigierten Plan kausal gegen die Daten (Konflikte, Overthinking vermeiden).
- **SUB B** (zweites Teammitglied): Unabhängiges adversarial Review des aktualisierten Plans.

## Aktivierungsablauf (reihum, nicht parallel)

### Schritt 0: Issue-Check (Lead)
Der Lead prüft als Erstes GitHub Issues mit dem Label `gate-failure`. Ein offenes `gate-failure`-Issue hat höchste Priorität und muss **vollständig** gelöst werden, bevor neue Arbeit beginnt.

### Schritt 1: Lead prüft aktive Sub-Agent-Slots
Der Lead ruft `list_agents()` auf und prüft, welche Sub-Agent-Slots aktiv sind.

### Schritt 2: Lead liest Pflichtdokumente
Der Lead liest **VOR jedem Edit** alle sechs Pflichtdokumente vollständig:
`docs/INVENTORY.md`, `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `AGENTS.md`.

### Schritt 3: Lead spawnet zwei Sub-Agents
Der Lead spawnet **genau zwei** Sub-Agents mit **eindeutigen, kleingeschriebenen, kebab-case-Namen** (z. B. `sub-review-a-1`, `sub-review-b-1`; nicht zufällig, nicht doppelt vergeben).
Erste Nachricht an jeden Sub-Agenten: **NUR die Rolle bestätigen** — keine Inhalte, keine weiteren Anweisungen.

### Schritt 4: Lead bestätigt eigene Rolle
Der Lead teilt beiden Sub-Agenten mit, welche Rolle er übernimmt und wie er für den Rest des Skills arbeiten wird.

### Schritt 5: Beide Sub-Agents lesen Pflichtdokumente (erste Aufgabe)
An beide Sub-Agenten: Lies alle sechs Pflichtdokumente vollständig.

### Schritt 6: Beide Sub-Agents betätigen die Regeln
Nach dem Lesen bestätigen beide Sub-Agenten explizit, dass sie die Regeln betätigen.

### Schritt 7: Lead–A–B–Lead-Loop beginnt
Erst wenn alle Rollen bestätigt, alle Pflichtdokumente gelesen und alle Regeln betätigt sind, beginnt der Loop:

```
LEAD plant den User-Auftrag gegen den Code
      │
      ▼
 SUB A: adversarial Review des Plans → Bericht an LEAD
      │
      ▼
 LEAD korrigiert den Plan → sendet korrigierten Plan an SUB B
      │
      ▼
 SUB B: unabhängiges adversarial Review des aktualisierten Plans → Bericht an LEAD
      │
      ▼
 LEAD sendet den Bericht unverändert an SUB A
      │
      ▼
 SUB A prüft den korrigierten Plan NOCHMAL gegen die Daten
      (kausale Konflikte, Overthinking vermeiden)
      │
      ▼
LOOP bis LEAD, SUB A und SUB B alle Freigabe sagen
```

## Regeln (fail-closed)

1. Jede Datei muss **VOR dem Edit vollständig gelesen** werden.
2. Die Gate-Grundidee darf nicht verwässert werden (fail-closed; alle 12 Gates in `verify:all`).
3. Der Weg nach `main` geht immer über: Arbeitsbranch → PR gegen `main` → Gate (`promote.yml`). Ein Direktpush auf `main` ist gesperrt (`ERR-4023`).
4. PR-Body (aus dem Commit-Body gebaut) trägt die drei Pflichtsektionen: `### Changes (Was ist neu)`, `### Technische Basis & Kausalität`, `### Ausblick (Nächste Schritte)`.
5. Keine Wegwerf-Skripte, keine `tmp-`/`temp-`/`scratch-`/`*.bak`-Dateien (Tree-Gate `ERR-4019`).
6. `verify:quick` muss vor dem Commit grün sein; `turn:finish` läuft ihn automatisch und pusht danach nur den Arbeitsbranch.
7. Doku mit `rbd-doc`-Marker halten (`pnpm run docs:sync`); Änderungen an den sechs Pflichtdokumenten im selben Commit.
8. Tests laufen ausschließlich am Ende eines Turns (keine Zwischenläufe von `pnpm run test` / `verify:all` während der Arbeit).

## Erwartete Ausgaben (begrenzt)

Nach jeder Aktivierung liefert der Skill genau:

1. Einen korrigierten, von LEAD, SUB A und SUB B freigegebenen Plan.
2. Die Review-Berichte von SUB A und SUB B (unverändert weitergereicht).
3. Eine Freigabe-Entscheidung: **Freigabe** / **Nachbesserung** / **Abbruch**.

## DSH-Werkzeuge (Lead)

- `list_agents()` — Teammitglieder auflisten und Status prüfen.
- `spawn_teammate(name, description, prompt)` — nur der Lead spawnet; `name` muss einzigartig und lower-kebab-case sein.
- `send_message(target, message)` — Rolle bestätigen, Pläne und Berichte reihum senden.
- `team_task_create` / `team_task_get` / `team_task_list` / `team_task_update` — gemeinsame Aufgaben mit `write_scopes` koordinieren.

## Laden und Verwendung

Die Skill-Definition liegt unter `docs/SKILL_LEAD_SUB_AGENT_LOOP.md`. Sie wird zu Session-Beginn als Kontext geladen (z. B. über `read` oder als `skill_content`-Block in die Session gebracht) und dann schrittweise befolgt. Aktive DSH-Skills werden zur Session geladen; dieser Skill dokumentiert die Projektkonvention für das Agent-Team in diesem Repository.
