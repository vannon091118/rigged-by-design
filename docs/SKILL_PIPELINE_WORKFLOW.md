# Pipeline-Workflow-Skill: Lead-A-B-Lead-Loop

## Zweck

Ein generischer Skill zur Qualitätssicherung von Code-Änderungen vor einem PR. Der Skill stellt sicher, dass jede Änderung durch einen doppelten adversarial Review (zwei unabhängige Teammitglieder) und eine abschließende kausale Prüfung geht, bevor sie in einen Arbeitsbranch committet wird.

## Rollen

- **LEAD** (der aktuelle Agent / Team Lead): Plant den Auftrag, spawnet Teammitglieder, korrigiert den Plan, entscheidet über Freigabe.
- **SUB A** (erstes Teammitglied): Erstellt ein adversarial Review des Plans, prüft den korrigierten Plan gegen die Daten (kausale Konflikte, Overthinking).
- **SUB B** (zweites Teammitglied): Erstellt ein unabhängiges adversarial Review des aktualisierten Plans.

## Loop (nach jeder Aktivierung)

```
LEAD plant User-Auftrag gegen den Code
      │
      ▼
   SUB A: adversarial Review des Plans → zurück an LEAD
      │
      ▼
   LEAD korrigiert den Plan → sendet den korrigierten Plan an SUB B
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
LOOP bis ALLE 3 (LEAD, SUB A, SUB B) Freigabe sagen
```

## Aktivierung (erster Durchlauf)

Bei Aktivierung des Skills:

1. **Lead** spawnet zwei Teammitglieder mit **zufälligen Namen**.
2. **Erste Nachricht an jedes Teammitglied**: NUR die Rolle bestätigen (keine weitere Anweisung, keine Inhalte).
3. **Lead bestätigt ebenfalls eine Rolle** und erklärt, wie er für den Rest des Skills arbeiten wird.
4. Danach beginnt der Loop wie oben beschrieben.

## Regeln

- Jede Datei muss VOR dem Edit vollständig gelesen werden.
- Die Gate-Grundidee darf nicht verwässert werden (fail-closed, alle 12 Gates in CI).
- Der Weg nach `main` geht immer über: Arbeitsbranch → PR gegen `main` → Gate.
- Keine Wegwerf-Skripte, keine `tmp-`/`temp-`/`scratch-`-Dateien.
- Issue-Check vor Arbeitsbeginn: offene `gate-failure`-Issues haben höchste Priorität.

## Aktivierung jetzt

Lead spawnet zwei Teammitglieder mit zufälligen Namen und sendet die erste Rolle-Bestätigungsnachricht.
