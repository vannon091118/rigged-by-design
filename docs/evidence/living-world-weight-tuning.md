# Living World: Mehrseed-Lauf und Tie-Break-Gewichtung

**Stand:** 2026-11-13 · **Pfad:** `tickWorld` → `tickCityLife` → `chooseCityIntent`

## Ziel

Die Stadt soll **deterministisch**, aber nicht vorhersagbar sein: Der Seed darf
Near-Ties unterschiedlich auflösen, jede Entscheidung muss aber aus Faktoren,
Alternativen und Counterfactuals nachvollziehbar bleiben. Erwartungen an einen
bestimmten Verlauf dürfen brechen; Erwartungen an Nachvollziehbarkeit nicht.

## Methode

- 6 Seeds: `424242`, `1`, `7`, `99`, `2026`, `31337`
- 8 Sim-Tage, voller `tickWorld`-Pfad, keine Abkürzung
- zwei Populationen: 3 (Start) und 12 (Straße)
- gemessen: Entscheidungen, geplante Abweichungen, Intent-Verteilung,
  Counterfactual-Familien, `findCausalChain`, Bewegung
- Sonde: `src/core/sim/__tests__/longrun-probe.test.ts` (temporär, nach der
  Messung entfernt; die dauerhafte Abnahme steht im Longturn-Test)

## Baseline (vor der Änderung)

| Population | Entscheidungen | Abweichungen | Intent-Top | Kette | Signaturen über 6 Seeds |
| --- | --- | --- | --- | --- | --- |
| 3 | 579 | 241 | SLEEP 169, EAT_HOME 156, WORK 115, VISIT_FRIEND 91 | `mira: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` | 1 |
| 12 | 2316 | 660 | SLEEP 892, EAT_HOME 615, WORK 522, VISIT_FRIEND 111 | `boris: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` | 1 |

**Befund:** Alle sechs Seeds waren bitgleich. Ursache war nicht der Score,
sondern der Zustand: `createWorld` legte `cityLife` mit Seed `0` an, und der
echte Spielstart reichte seinen Seed nie an die Stadt weiter. `seedTilt` lief
damit immer mit `seed === 0` und war ein toter Pfad.

## Änderung

1. `createNewGame` zieht **einen** Seed und verwendet ihn für `Prng` **und**
   `cityLife`; derselbe Spielstand bleibt reproduzierbar, neue Partien nicht
   identisch.
2. `seedTilt` von ±0,35 auf ±3,00 angehoben. Das bricht nur Near-Ties; der
   Faktor bleibt kleiner als Routine (60), Bedürfnisse und Beziehungen und
   steht weiterhin als eigener Trace-Faktor im Entscheidungsprotokoll.
3. Der Longturn setzt den Stadt-Seed wie der echte Start und prüft zusätzlich
   drei Seeds auf Kettenvielfalt sowie einen Seed doppelt auf Exaktheit.

## Nach der Änderung

| Population | Entscheidungen | Abweichungen | Ketten über 3 Seeds | Signaturen über 6 Seeds |
| --- | --- | --- | --- | --- |
| 3 | 579 | 241 | immer `mira: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` | 2 (nur Counterfactual-Details) |
| 12 | 2316 | 619–734 | `boris: EAT_OUT → PUB → VISIT_FRIEND` (2 Seeds) und `… → VISIT_FRIEND → VISIT_FRIEND` (4 Seeds) | 6 |

Beispiele nach der Änderung:

| Seed | Abweichungen | Intent-Top | Kette |
| --- | --- | --- | --- |
| 424242 | 635 | SLEEP 898, EAT_HOME 568, WORK 533, VISIT_FRIEND 131 | `boris: EAT_OUT → PUB → VISIT_FRIEND` |
| 1 | 702 | SLEEP 849, EAT_HOME 656, WORK 521, VISIT_FRIEND 111 | `boris: EAT_OUT → PUB → VISIT_FRIEND` |
| 7 | 697 | SLEEP 879, EAT_HOME 618, WORK 504, VISIT_FRIEND 141 | `boris: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` |
| 99 | 724 | SLEEP 846, EAT_HOME 686, WORK 510, VISIT_FRIEND 104 | `boris: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` |
| 2026 | 734 | SLEEP 845, EAT_HOME 684, WORK 511, VISIT_FRIEND 116 | `boris: EAT_OUT → VISIT_FRIEND → VISIT_FRIEND` |
| 31337 | 619 | SLEEP 905, EAT_HOME 578, WORK 531, VISIT_FRIEND 106 | `boris: EAT_OUT → PUB → VISIT_FRIEND` |

## Einordnung gebrochener Erwartungen

**Gut:** Die Annahme „ein Seed reicht, um alle Partien gleich zu spielen“ ist
gebrochen. Bei 12 Bewohnern entstehen unterschiedliche Tagespläne,
Abweichungsraten und Erinnerungspfade, obwohl jeder Lauf denselben Regeln folgt.

**Gut:** Die Annahme „die konkrete Kette ist über Seeds stabil“ ist gebrochen.
Das ist erwünschte Emergenz, kein Fehler: Der Speicherpfad wechselt zwischen
`PUB` und `VISIT_FRIEND`, bleibt aber als Mahlzeit → Erinnerung → Verhalten
ablesbar.

**Nicht gebrochen:** Jeder geprüfte Lauf besitzt mindestens eine vollständige
Kette; `findCausalChain` liefert in allen sechs Seeds ein Ergebnis. Die
Counterfactual-Familien bleiben erhalten (u. a. `memory`, `relationship`,
`routine`).

**Grenze:** Bei drei Bewohnern bleibt der sichtbare Verlauf gleich (Intent,
Abweichungen, Kette); nur Counterfactual-Details unterscheiden sich. Die
Routine dominiert dort jeden Near-Tie; das ist für den Start stabil, aber keine
Emergenz. Eine weitere Absenkung des Routine-Bonus wäre der nächste Hebel —
bewusst nicht in diesem Slice, weil sie den Eröffnungsabend verändern würde.

## Determinismus-Beleg

Der Mehrseed-Test führt Seed `424242` zweimal aus und vergleicht
`Entscheidungen/Abweichungen`; beide Läufe sind identisch. Seed `1` weicht
nachweislich ab. Der Test liegt in
`src/core/sim/__tests__/living-world-multiseed.test.ts`
(`erzeugt ueber Seeds verschiedene, aber reproduzierbare Ketten`), der Lauf
selbst in `src/core/sim/living-world-multiseed.ts`.
