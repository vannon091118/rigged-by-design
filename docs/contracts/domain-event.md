# Contract: domain-event v1.0

**Contract-ID:** `domain-event`  
**Version:** 1.0  
**Owner:** Interaction-Contract-Owner  
**Lane:** `lane/contracts/domain-event-v3`  
**Basis-SHA:** `b95b96e`  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`

## Zweck

Eine unveränderliche Event-Hülle: was ist passiert, für wen, in welchem
Weltzustand, mit welcher Payload-Version. Sie trägt nur Referenzen und keine
zweite Zustandswahrheit; Welt, Ledger und RNG bleiben bei ihren Ownern.

## ID-Aufbau

`<eventType>:<tick>:<actorId>:<sequence>`

| Anteil | Herkunft | Bedeutung |
|--------|----------|-----------|
| `eventType` | Producer | fachlicher Ereignistyp, z. B. `VISITOR_SERVICE` |
| `tick` | world-time | Welt-Tick des Auftretens |
| `actorId` | actor-id | Handelnder, Präfix + Sequenz |
| `sequence` | Producer | laufende Nummer je `(eventType, tick, actorId)` |

### Entscheidung: Sequenz statt `eventType:tick:actorId`

Die alte Form `eventType:tick:actorId` ist nicht eindeutig. Zwei gleichartige
Ereignisse im selben Tick für denselben Akteur sind im Code normal: `tickWorld`
drainiert mehrere Facts je Tick, und `processNarrativeBoundary` verarbeitet
mehrere Kandidaten in einem Lauf. Beide hätten dieselbe ID getragen; damit wären
Persistenz, Idempotenz und Consumer-Cursor nicht unterscheidbar.

Belege für die Notwendigkeit eines vierten Anteils:

- Tick und Akteur sind beide gegeben und trotzdem identisch — sie tragen keine
  Unterscheidung bei.
- Eine Uhr oder `Math.random()` ist im Spielpfad verboten; Zeitstempel und
  Zufall scheiden als Diskriminator aus.
- Ein globaler Zähler wäre eine zweite Wahrheit neben dem Producer. Die Sequenz
  gehört dem Producer, der die Ereignisse erzeugt, und ist damit deterministisch
  und replay-fähig.

Die Sequenz ist eine **nicht-negative ganze Zahl** und wird vom Producer je
Scope monoton vergeben. Der Contract prüft die Gültigkeit, nicht die
Monotonie — die liegt beim Producer, weil nur er seinen Scope kennt.

## Invarianten

1. **Eindeutig:** `eventId` ist je Hülle eindeutig und wird aus den Feldern
   abgeleitet, nie frei gesetzt.
2. **Unveränderlich:** Die Hülle ist nach Erstellung eingefroren.
3. **Zerlegbar:** `actorId` enthält keinen Doppelpunkt (actor-id Contract),
   deshalb ist die ID ohne Escaping eindeutig lesbar.
4. **Konsistent:** `validateDomainEvent` lehnt jede Hülle ab, deren `eventId`
   nicht exakt der Ableitung aus `eventType`, `tick`, `actorId` und `sequence`
   entspricht (Manipulationsschutz).
5. **Zeit nur als Weltzeit:** `tick` und `day` kommen aus world-time; keine
   Wanduhr, kein `Date.now()`.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/domain-event-v3` | write |
| Leser | Relationship-, Factor-, Save- und Narrative-Lanes | read |

## Kompatibilitätsregel

Additiv innerhalb 1.x: neue Payload-Versionen und neue `eventType`-Werte sind
erlaubt. Breaking wäre ein geänderter ID-Aufbau oder ein anderer Typ von
`sequence`; das verlangt 2.0 mit Migration der gespeicherten IDs.

Unbekannte `payloadVersion` wird vom Consumer fail-closed abgewiesen, nicht
still als aktuelle Version gelesen.

## Abnahme

| Kriterium | Beleg |
|-----------|-------|
| Zwei gleichartige Events im selben Tick sind unterscheidbar | `src/core/contracts/__tests__/domain-event.test.ts`, Fall „trennt zwei gleichartige Events im selben Tick über die Sequenz“ |
| Manipulierte `eventId` wird abgewiesen | derselbe Test, Fall „lehnt eine eventId ab, die nicht aus den Feldern folgt“ |
| Ungültige Zeit-/Sequenzwerte scheitern sichtbar | dieselbe Datei, Fälle zu negativer Sequenz und nicht-ganzzahligem Tick |
