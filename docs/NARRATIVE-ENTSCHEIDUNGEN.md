# Narrative-Entscheidungen

<!-- rbd-doc: v0.3.89 | 2026-11-04 02:06 UTC -->

Verbindliche Antworten auf die fünf offenen Punkte der Narrativ-Spezifikation.
Der Eigentuemer hat sie am 2026-11-04 entschieden. Dieses Dokument ist die
Referenz fuer die Umsetzung; es beschreibt **keinen bereits umgesetzten Code**.
Bis zur Umsetzung bleiben `AGENTS.md`, Schema und Code unveraendert.

**Korrektur vom 2026-11-04.** Die erste Fassung begrenzte E2 auf `offerScore()`
und schloss Service-/Sozialschwellen aus. Der Eigentuemer hat mit „E2E
vollstaendig“ korrigiert; D4 und D5 unten sind die gueltige Fassung.

| Nr. | Frage | Entscheidung |
| --- | --- | --- |
| D1 | Content-Batch pro Turn | Ja, mehrere Contributions pro Turn |
| D2 | Neue Kontexte | Ja, sieben Kontexte ergaenzen |
| D3 | `COUNTER_RIVAL` | Effekt + Chain-Template, kein zweiter Fact |
| D4 | E2E-Reichweite | Vollstaendig: Aktivitaet, Spielwahl, Rueckkehr |
| D5 | Service-/Sozialschwellen in `chooseActivity` | Ja, begrenzt; harte Regeln bleiben vorrangig |

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

## D4: E2E vollstaendig

**Definition.** E1 ist die reine Ableitung der Disposition aus Persona,
Erinnerungen und Beziehung. E2E ist ihre Anwendung ueber den gesamten
Gastpfad, nicht nur auf die Spielwahl.

**Entscheidung.** Die Disposition wirkt an allen drei bestehenden
Entscheidungspunkten:

1. **Aktivitaetswahl (`chooseActivity`)**: begrenzte Verschiebung der sozialen
   Schwellen fuer Drink und Sofa um hoechstens ±8 Punkte. Kritische
   Beduerfnisse (Toilette bei `need === 'toilet'` oder Geduld/Laune < 22), das
   Wallet-Veto und die Platzpruefung bleiben unveraendert und haben Vorrang.
2. **Spielwahl (`offerScore`)**: begrenzter Faktor ±20 %, ganzzahlig gerundet,
   nie null oder negativ. Das Veto bleibt `offerScore() === 0` aus Preis,
   Zustand oder fehlendem Platz.
3. **Rueckkehr (`returnChance`)**: begrenzter Beziehungszuschlag von hoechstens
   ±10 Prozentpunkten zusaetzlich zum vorhandenen `memoryEffect`; das Ergebnis
   bleibt geklemmt.

**Eine Ableitung.** Alle drei Projektionen kommen aus derselben reinen Funktion
und denselben Quellen: Persona-Geschmack (`getPersona`), gerichtete Beziehung
`visitor -> player` bzw. `player -> visitor` (`trust`, `sympathy`, `conflict`)
und die vorhandenen Besuchererinnerungen. Kein neuer persistenter Zustand,
kein RNG, keine Uhr, keine Mutation.

**Vorrangregeln.** Die Disposition verschiebt nur vorhandene Entscheidungen;
sie erzeugt keine neuen Pflichten und keine neuen Verbote. Kritische
Beduerfnisse, fehlendes Geld, fehlender Platz und ein defektes Geraet bleiben
harte Regeln.

**Nicht in E2E.** Preise, Auszahlungen, Servicegeschwindigkeit, Ledger,
Event-Planung, Spawn-Wahrscheinlichkeit und Texte. Die Disposition aendert
keine Geldwirkung.

**Nachweis.** Ein Ende-zu-Ende-Test fuehrt einen Gast mit hoher und niedriger
Disposition durch Aktivitaet, Spielwahl und Rueckkehr und prueft: gleiche
harte Regeln, deterministische Abweichung, keine Grenzverletzung. Dazu die
bestehenden Angebots- und Rueckkehr-Tests. Ohne Messung keine
Balance-Aussage.

## D5: Service-/Sozialschwellen: ja, begrenzt

**Entscheidung.** Die sozialen Schwellen in `chooseActivity()` werden
einbezogen, aber nur als begrenzte Verschiebung. Die kritischen Pfade bleiben
unangetastet.

- **Toilette:** `need === 'toilet'` oder `patience < 22`/`mood < 22` bleibt
  absolut; die Disposition kann das WC nicht verhindern.
- **Drink:** die sozialen Ausloeser (`mood < 44`, `patience < 38`,
  `sociability > 68 && mood < 55`) verschieben sich um hoechstens ±8 Punkte.
- **Sofa:** `sociability > 72 && mood < 50 && addiction < 20` verschiebt sich
  im selben Fenster.
- **Unveraendert:** Wallet-Veto, Mindesteinsatz, freie Plaetze, defekte
  Geraete, Preise, Servicegeschwindigkeit und die Reihenfolge der Pruefungen.

**Begruendung.** E2E vollstaendig heisst: Die Beziehung zum Haus ist auf dem
ganzen Gastpfad sichtbar, nicht nur an der Spielauswahl. Die Verschiebung ist
begrenzt und deterministisch, damit sie testbar bleibt; die harten Regeln
bleiben Eigentum der Simulation.

**Folge.** Ein Gast mit schlechter Beziehung trinkt oder setzt sich frueher
oder spaeter, geht aber bei kritischem Beduerfnis weiter zur Toilette und
zahlt weiter Preise. Die Schwelle ist eine Zahl im bestehenden Tick, kein
neuer Zustand und kein neues Event.

**Nicht.** Keine neuen Aktivitaeten, keine neuen Beduerfnisse, keine
Beschleunigung der Bedienung, keine Aenderung an Ledger oder RNG.

## Umsetzungsreihenfolge

1. Phase 1: strikte Dateiinventur, Validator vor dem `node_modules`-Skip,
   `test:affected` fuer Narrative-JSON.
2. D2 plus erster Content-Batch (D1) mit den neuen Kontexten.
3. Composer-Kontext und Slot-Zweck; `PROBE`-Filter, Follow-up-Ketten und
   typisierte Domain-Effekte inklusive D3.
4. E2E-Disposition in `chooseActivity()`, `offerScore()` und `returnChance()`;
   harte Regeln und die D5-Grenzen bleiben vorrangig.
5. Vertragsdoku (`NARRATIVE-ENGINE.md`, `AGENTS.md`, `ARCHITECTURE.md`)
   nachziehen, sobald der Code die Entscheidungen traegt.

## Offene Punkte

- Die genauen Verschiebungen (±8 Punkte Aktivitaet, ±20 % Angebot, ±10
  Punkte Rueckkehr) brauchen eine Messung; sie sind Grenzen, keine
  balancierten Werte.
- Das Template `RIVAL_COUNTERED` braucht Autorentexte fuer seine Slots; bis
  dahin greift der ehrliche Fallback des Composer.
- Die Chain-Kennung wird erst mit der Umsetzung als Konstante eingefuehrt; sie
  ist kein Trigger und darf nie in `EVENT_TRIGGER_DEFINITIONS` erscheinen.
