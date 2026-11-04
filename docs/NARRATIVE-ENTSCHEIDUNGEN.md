# Narrative-Entscheidungen

<!-- rbd-doc: v0.3.89 | 2026-11-04 02:06 UTC -->

Verbindliche Antworten auf die fünf offenen Punkte der Narrativ-Spezifikation.
Der Eigentuemer hat sie am 2026-11-04 entschieden. Dieses Dokument ist die
Referenz fuer die Umsetzung; es beschreibt **keinen bereits umgesetzten Code**.
Bis zur Umsetzung bleiben `AGENTS.md`, Schema und Code unveraendert.

| Nr. | Frage | Entscheidung |
| --- | --- | --- |
| D1 | Content-Batch pro Turn | Ja, mehrere Contributions pro Turn |
| D2 | Neue Kontexte | Ja, sieben Kontexte ergaenzen |
| D3 | `COUNTER_RIVAL` | Effekt + Chain-Template, kein zweiter Fact |
| D4 | E2-Reichweite | Nur Spielwahl (`offerScore`) |
| D5 | Service-/Sozialschwellen in `chooseActivity` | Nein, unveraendert lassen |

## D1: Mehrere Contributions pro Turn

**Entscheidung.** Ein abgeschlossener Turn darf mehrere Contributions
enthalten (1..n). Die bisherige Regel „genau ein Beitrag pro Turn“ wird zu
„mindestens ein Beitrag pro Turn“.

**Regeln fuer den Batch.**

- Jede Contribution bleibt eine eigene JSON-Datei mit eigener, eindeutiger
  `contributionId`; mehrere Contributions desselben Turns teilen sich dieselbe
  `turnId`.
- `content/narrative/turns/manifest.json` fuehrt je Contribution einen Eintrag
  (oder eine gleichwertige Liste). Doppelte IDs, verwaiste Contributions und
  ein Turn ohne Beitrag bleiben fail-closed.
- Der Registry-Hash umfasst weiterhin **alle** Fragmente des Batches. Ein Batch
  umgeht keine Schema-, Slot-, Kontext-, Persona- oder Makropruefung.
- Ein Turn bleibt eine PR-Einheit. Der Batch rechtfertigt keinen zweiten
  Content-Ordner, keinen zweiten Textpool und keine zweite Registry.

**Umsetzung.** Manifest-Schema anheben, `scripts/lib/narrative-content.mjs`
und Compiler auf mehrere Eintraege pro `turnId` erweitern, Tests mit zwei
Contributions in einem Turn. Die Formulierung in `AGENTS.md` wird im selben
Schritt auf „mindestens einen“ geaendert.

**Nicht entschieden.** Fragmente mehrerer Contributions werden nicht zu einer
Datei zusammengelegt, und eine Contribution gehoert weiterhin genau einem Turn.

## D2: Sieben neue Kontexte

**Entscheidung.** Das Kontext-Vokabular in
`content/narrative/vocabulary/classification.json` wird um sieben Eintraege
ergaenzt:

| Kontext | Bedeutung | Abgrenzung |
| --- | --- | --- |
| `rival` | Szene mit Rivale oder Wettbewerb zwischen Haus und Rivale | keine Rolle und kein Trigger, sondern die Lage |
| `welcome` | Ankunft, Begruessung, erster Kontakt | nicht `start`, das den Lauf beginnt |
| `ask` | Frage, Nachfragen, Informationssuche | keine Choice-Mechanik |
| `defuse` | Deeskalation, Spannung herausnehmen | Gegenstueck zu `escalate` |
| `escalate` | Zuspitzung, Spannung erhoehen | Gegenstueck zu `defuse` |
| `confront` | direkte Konfrontation als Handlung | `conflict` bleibt die Lage, `confront` ist der Akt |
| `watch` | beobachten, ohne einzugreifen | keine passive Beschreibung |

**Regeln.**

- Kontexte sind Autorenvokabular. Sie werden nicht aus Template-IDs,
  Trigger-IDs oder Choice-IDs abgeleitet; Fragmente tragen sie explizit.
- Mehrere Kontexte pro Fragment bleiben erlaubt; der Composer filtert
  weiterhin exakt und fail-closed.
- `conflict` wird nicht ersetzt. `escalate`/`defuse` beschreiben die Absicht
  einer Choice, `watch` die Haltung, `confront` die Handlung.
- Vokabular und erste Fragmente landen im selben Batch (siehe D1), damit kein
  Kontext ohne mindestens ein Fragment im Pool steht.

**Umsetzung.** Nur `contexts` in der Klassifizierung ergaenzen; keine neuen
Slots, Funktionen, Trigger oder Choice-Effekte. Bestehende Fragmente bleiben
unangetastet, bis sie einen Kontext bewusst verwenden.

## D3: `COUNTER_RIVAL` und `RIVAL_COUNTERED`

**Entscheidung.** `COUNTER_RIVAL` wird ein typisierter Choice-Effekt, der
ausschliesslich das vorhandene `counteredUntilTick` setzt. `RIVAL_COUNTERED`
wird ein Template, das direkt an die aufgeloeste Choice gekettet wird — ohne
neuen Fact und ohne neuen Trigger, der auf einen Fact reagiert.

**Begruendung.**

- `counteredUntilTick` ist bereits die einzige Wahrheit fuer „der Rivale ist
  gegenmasznahmlich blockiert“; `decideRivalAction()` liest sie.
- Ein `RIVAL_COUNTERED`-Fact oder -Flag waere eine zweite Wahrheit. Ein Flag
  muesste zurueckgesetzt werden und liefe bei Save/Laden oder verpassten Ticks
  auseinander.
- Ein Fact-Trigger wuerde bei jeder Gegenmassnahme feuern und eine eigene
  Reset-Semantik brauchen. Die Choice-Kette ist deterministisch, genau einmal
  und bereits durch `chainEvent()` / `chainFromEventId` gedeckt.

**Mechanik.**

- Der Effekt zielt auf den Rivale-Teilnehmer der Choice und setzt
  `counteredUntilTick = max(bisher, tick + RIVAL_AI_LIMITS.counteredTicks)`.
  Es gibt keinen globalen Timeout-Strafmechanismus.
- Die Choice traegt `followUpEventId: 'RIVAL_COUNTERED'`. Der Runtime-Pfad
  liest den aufgeloesten `EVENT_RESOLVED`-Fact, baut daraus einen
  Chain-Kandidaten und ruft `chainEvent()` nur auf, wenn der Vorgaenger
  `RESOLVED` ist.
- Das Template `RIVAL_COUNTERED` lebt in `events/definitions/`, hat
  `scope: 'RIVAL'` und eine reservierte Chain-Kennung (z. B. `ENGINE_CHAIN`),
  die **nicht** in `EVENT_TRIGGER_DEFINITIONS` steht. Damit kann es nicht
  selbststaendig aus einem Fact entstehen.
- Der `PROBE`-Filter bleibt ein separates C/D-Thema. `COUNTER_RIVAL` aendert
  die Trigger-Bedingungen nicht.

**Tests.** Wirkung genau einmal, wiederholter Klick abgelehnt, Folge-Event
genau einmal und nur nach `RESOLVED`, kein Selbststart ohne Vorgaenger,
Save-Roundtrip des Gegenmassnahmen-Fensters.

**Nicht entschieden.** Kein neuer Fact `RIVAL_COUNTERED`, kein Flag, kein
zweiter Trigger und keine zweite Event-Historie. Entsteht spaeter eine weitere
Gegenmassnahmen-Quelle, nutzt sie denselben Chain-Helfer statt eines Facts.

## D4: Reichweite von E2

**Definition.** E1 ist die reine Ableitung der Disposition aus Persona,
Erinnerungen und Beziehung. E2 ist ihre Anwendung auf die Spielwahl.

**Entscheidung.** E2 wirkt ausschliesslich in `offerScore()` — also bei der
Frage, welches Spiel ein Gast als Naechstes waehlt.

- Die Disposition ist ein begrenzter Faktor (Richtwert ±20 %), ganzzahlig
  gerundet, nie null oder negativ. Sie kann ein Angebot abschwaechen, aber
  nicht verbieten; das Veto bleibt `offerScore() === 0` aus Preis, Zustand
  oder fehlendem Platz.
- Quellen sind vorhandene Daten: Persona-Geschmack (`getPersona`),
  gerichtete Beziehung `visitor -> player` bzw. `player -> visitor`
  (`trust`, `sympathy`, `conflict`) und die vorhandenen
  Besuchererinnerungen. Kein neuer persistenter Zustand.
- Die Ableitung ist rein und deterministisch: kein RNG, kein Netzwerk, keine
  Uhr, keine Mutation. Sie darf den Gameplay-RNG nicht ziehen.
- `returnChance()` bleibt unveraendert; dort wirkt bereits `memoryEffect()`.
  E2 dupliziert diese Wirkung nicht.

**Nicht in E2.** Preise, Auszahlungen, Servicegeschwindigkeit,
Beduerfnis-Schwellen, Event-Planung und Texte. Die Disposition aendert keine
Spielregel und keine Geldwirkung.

**Nachweis.** Bestehende Angebots-Tests um Determinismus, Grenzen und
Nicht-Veto erweitern. Ohne Messung wird keine Balance-Aussage behauptet.

## D5: Keine Service-/Sozialschwellen in `chooseActivity`

**Entscheidung.** Nein. Die Schwellen in `chooseActivity()` bleiben
unveraendert: Toilette bei Beduerfnis oder niedriger Geduld/Laune, Drink bei
Beduerfnis, Laune, Geduld oder Sociability, Sofa bei hoher Sociability und
mittlerer Laune.

**Begruendung.**

- Diese Schwellen sind Service- und Ueberlebensregeln. Sie gehoeren zu
  Beduerfnissen, Geld und Geduld, nicht zur Narrativ-Disposition.
- Eine Disposition, die entscheidet, ob jemand zur Toilette geht oder trinkt,
  waere ein verstecktes Gameplay-Gate aus Text und Beziehungswerten. Das
  verletzt „keine Gameplay-Wirkung aus Text“ und waere im Tick schwer
  isolierbar zu testen.
- Eine Regel, zwei Besitzer: `chooseActivity()` und `offerScore()` duerfen
  nicht dieselbe Praeferenz unterschiedlich interpretieren.

**Folge.** Ein Gast mit schlechter Beziehung zum Haus bekommt weiterhin
Service; er waehlt nur anders zwischen Spielen (D4). Soll sich das spaeter
aendern, braucht es eine eigene Entscheidung mit Messung und einem benannten
Andockpunkt — keine stillen Schwellen.

## Umsetzungsreihenfolge

1. Phase 1: strikte Dateiinventur, Validator vor dem `node_modules`-Skip,
   `test:affected` fuer Narrative-JSON.
2. D2 plus erster Content-Batch (D1) mit den neuen Kontexten.
3. Composer-Kontext und Slot-Zweck; `PROBE`-Filter, Follow-up-Ketten und
   typisierte Domain-Effekte inklusive D3.
4. E1/E2-Disposition in `offerScore()`; D5 bleibt unveraendert.
5. Vertragsdoku (`NARRATIVE-ENGINE.md`, `AGENTS.md`, `ARCHITECTURE.md`)
   nachziehen, sobald der Code die Entscheidungen traegt.

## Offene Punkte

- Die genauen Gewichte des Dispositions-Faktors brauchen eine Messung; der
  Richtwert ±20 % ist eine Grenze, kein balancierter Wert.
- Das Template `RIVAL_COUNTERED` braucht Autorentexte fuer seine Slots; bis
  dahin greift der ehrliche Fallback des Composer.
- Die Chain-Kennung wird erst mit der Umsetzung als Konstante eingefuehrt; sie
  ist kein Trigger und darf nie in `EVENT_TRIGGER_DEFINITIONS` erscheinen.
