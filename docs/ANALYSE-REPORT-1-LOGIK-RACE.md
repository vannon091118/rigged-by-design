# Analyse-Report 1: Logik-Ketten, Race-Condition-Schutz und unlogisches Verhalten

**Status:** Erstentwurf (LEAD)  
**Datum:** 2026-11-04T22:23 UTC  
**Basis:** Vollständige Lektüre von `src/core/sim/`, `src/core/economy/`, `src/core/games/`, `src/core/rng/`, `src/store/`, `src/core/sim/narrative/`, zentrale UI-Dateien  
**Ziel:** Kein fehlerhaftes Verhalten wird toleriert. Jede Logik-Kette wird auf Kausalität, Race-Condition-Schutz und Widersprüche geprüft.

---

## 1. Zusammenfassung

Die Simulation ist durchgängig **einfädig (single-threaded)**; es gibt keine echten Race Conditions durch Parallelität. Die Gefahr liegt stattdessen in **Reihenfolge-Abhängigkeiten (Ordering)**, **teilweisen Staatsänderungen ohne Rollback** und **Zustandsinkonsistenzen zwischen Save/Load und Laufzeit**. Das Geldsystem (Ledger) und die Narrative-Engine sind fail-closed gestaltet; die Gast-Zustandsmaschine hat einzelne Lücken bei Fehlerpfaden.

Befunde sind nach Schwere eingeordnet: **hoch** = Geld-/Zustandsinkonsistenz, **mittel** = spielbarer aber falscher Ablauf, **niedrig** = kosmetisch oder dokumentiert.

---

## 2. Logik-Ketten (tick-for-tick Ablauf)

### 2.1 `tickWorld()` — der zentrale Tick (`src/core/sim/tick.ts`)

Reihenfolge pro Tick (festgelegt, nicht konfigurierbar):

1. `world.tick += 1`
2. `exchangeQueue(world)` — Kassen-Schlange fortschreiten lassen
3. Alle Gäste: `guestTick()` — Zustandsmaschine ENTER→EXCHANGE→CHOOSE→PLAY/DRINK/TOILET/WAIT→CASHOUT→LEAVE/ANGRY
4. `maybeStartBrawl(world, prng)` — zwei wütende Gäste in Reichweite können Streit beginnen
5. `tickDisputes(world)` — bestehende Streitigkeiten eskalieren, beschädigen Geräte
6. `tickAgents(world, ledger, prng)` — Personal (Porter, Cashier, Guard, Cleaner, Bartender)
7. `decay(world)` — Geräte-Zustand, Dreck, Moebel-Verfall
8. `world.reputation = Math.round(reputation(world))`
9. `releaseOrphanSeats(world)`
10. `staffTick(world, ledger, prng)`
11. Fremde Floors ticken (`tickForeignFloor`)
12. `tickDemand(world, ledger, prng)` — Gast-Ankunft planen, Nachfrage-Events
13. `recoverPlayer(world.player.rpg, world.tick)` — RPG-Regeneration
14. `fightFx` Timeout auflösen
15. Spieler-Pfadschritte (`playerStepsPerTick`)
16. `tickRivalMinds(world)` — Rivalen handeln, emittieren RIVAL_ACTION-Facts
17. `processNarrativeRuntime(world, ledger)` — Facts→Trigger→Scheduler, einmal pro Tick

**Kritischer Beobachtungspunkt:** `tickRivalMinds` läuft **vor** `processNarrativeRuntime`. Rivalen-Facts werden im selben Tick verarbeitet. Das ist kausal korrekt (Fact entsteht im Tick, Runtime drainiert ihn im selben Tick), aber bedeutet: eine Rivalen-Aktion kann noch im selben Tick eine Szene auslösen.

**Keine Race Condition:** Alle Änderungen erfolgen sequenziell im selben Aufruf. `world.guests` wird mit Kopie `[...world.guests]` iteriert; `guestTick` kann Gäste aus der Liste entfernen (`payAndLeave` → `leave` → `filter`), die Prüfung `if (!world.guests.includes(guest)) continue;` fängt das ab.

### 2.2 Gast-Zustandsmaschine (`guestTick` in `tick.ts`, Untermodule in `guest-*.ts`)

| State | Übergang | Bedingung | Aktion |
|-------|----------|-----------|--------|
| ENTER | → EXCHANGE | Kassenpunkt erreicht | `sendGuestToQueue` |
| EXCHANGE | → CHOOSE | `deskServiceTicks` erreicht | `arriveAtDesk` (Fiat→Chips) |
| CHOOSE | → PLAY/DRINK/TOILET/WAIT | `chooseActivity()` | Sitz reservieren, Ziel setzen |
| PLAY/DRINK/TOILET/WAIT | → CHOOSE | `releaseAndChoose()` | Sitz freigeben, neue Wahl |
| CASHOUT | → LEAVE | Auszahlung abgeschlossen | `payAndLeave` → `leave` |
| ANGRY | → CASHOUT | >4 Ticks und Geld vorhanden | `payAndLeave` |
| ANGRY | → CHOOSE | Streit geschlichtet | `resolveDispute` (calmed=true) |
| LEAVE | → entfernt | Tür erreicht | `world.guests.filter` |

**Unlogisches Verhalten (Befund L1 — mittel):** In `guest-service.ts` `payAndLeave()`: Der `catch`-Block fängt Fehler von `payPending`/`exchangeFromVc`/`closeFiat` ab, setzt `guest.state = 'CASHOUT'` und `guest.stateTicks = 0`, ruft aber **nie `leave()`**. Wenn eine Zahlung fehlschlägt, bleibt der Gast auf unbestimmte Zeit im Zustand `CASHOUT` fest. Der Tick-Handler für `CASHOUT` ruft `payAndLeave` erneut auf; schlägt dieser erneut fehl, ist der Gast dauerhaft blockiert.

**Bewertung:** Die Einzelbuchungen (`payPending`, `exchangeFromVc`, `closeFiat`) prüfen Salden vor dem Transfer und werfen nur bei echter Unterdeckung. In der Praxis ist der `catch`-Pfad tot, aber die Logik-Lücke bleibt: es gibt keinen Ausweg aus `CASHOUT` außer einer erfolgreichen Zahlung.

**Empfehlung:** `payAndLeave` sollte im Fehlerfall entweder den Gast auf `LEAVE` setzen (mit Hinweis) oder wiederholte Fehlschläge nach N Versuchen aufgeben.

### 2.3 `settleGuests()` vor Umbau (`src/core/sim/actions.ts`)

Vor einem Umbau (`remodel`) werden alle Gastansprüche gebucht (`payPending`, `exchangeFromVc`, `closeFiat`), dann `world.guests = []`. Wenn eine Buchung fehlschlägt, wirft der Fehler und die Welt bleibt unverändert (Gäste sind noch da, Buchung nicht erfolgt). Das ist **kausal korrekt** — atomar vor dem Umbau.

**Befund L2 (niedrig):** `settleGuests` bucht für alle Gäste sequenziell. Scheitert Gast 3, sind Gäste 1-2 bereits ausgezahlt und aus der Liste entfernt (`world.guests = []` passiert erst am Ende). Der Umbau bricht ab, aber Gäste 1-2 sind bereits "weg" (aus dem Array entfernt, aber der Fehler wirft vor `world.guests = []`). Warte — schauen wir genauer hin:

```typescript
export function settleGuests(world, ledger): void {
  for (const guest of world.guests) {
    payPending(...); exchangeFromVc(...); closeFiat(...);
  }
  world.guests = [];
}
```

Die Schleife bucht für **alle** Gäste, bevor `world.guests = []` ausgeführt wird. Wenn Gast 3 wirft, sind Gäste 1-2 bereits gebucht (Geld bewegt), aber `world.guests` enthält noch alle Gäste. Beim nächsten Versuch werden Gäste 1-2 **erneut** ausgezahlt → Doppelauszahlung!

**Bewertung:** Dies ist ein **hochwichtiger Befund**. Eine fehlgeschlagene Buchung in der Mitte der Schleife lässt bereits gebuchte Gäste im Array, die bei Wiederholung doppelt ausgezahlt werden.

**Empfehlung:** `settleGuests` muss entweder transaktionell arbeiten (alle Buchungen prüfen vor Ausführung) oder `world.guests` muss nach jeder erfolgreichen Buchung gekürzt werden.

---

## 3. Race-Condition-Schutz

### 3.1 Ledger-Integrität (`src/core/economy/ledger.ts`, `ledger-integrity.ts`)

- `transfer()` prüft: Konto existiert nicht → erstellt; Quelle = Ziel → Fehler; Betrag ≤ 0 → Fehler; nicht-Minting/Nicht-Liability ohne Deckung → `InsufficientFundsError`
- `verifyIncremental()`: Tickpfad, nur getrübte Konten, Checkpoint-Replay
- `verifyLedgerIntegrity()`: Voller Replay gegen alle Konten, Bilanz muss Null sein
- `openLiability(DEBT_ACCOUNT)`: Erlaubt negatives Guthaben (Schulden statt Kappung)
- `MINTING_ACCOUNT` (`EXTERNAL_WORLD`): Einzige Quelle, die ohne Deckung buchen darf

**Schutz bewertet: Grün.** Jeder Geldweg ist eine Ledger-Buchung mit fail-closed Prüfung. Kein `addVC` außerhalb der Buchungslogik.

### 3.2 RNG-Namespaces (`src/core/rng/prng.ts`, `streams.ts`)

- `Prng` trägt Rolle `gameplay` oder `presentation`
- `assertGameplayRng(prng)` wirft bei `presentation`-Strom in `tickWorld`/`playRound`
- `entropySeed()`: Einmaliger Krypto-Zufall beim Laufstart; danach alles geseedet
- Save speichert nur `prngState` (gameplay); `presentation`-Strom wird nie gespeichert

**Schutz bewertet: Grün.** Zwei getrennte Ströme, kein `Math.random()` im Spielpfad, ESLint blockt Umwege.

### 3.3 Narrative-Engine — keine Rekursion

`src/core/sim/narrative/runtime.ts`:
- `processNarrativeRuntime()` drainiert Facts **einmal** pro Lauf
- Neue Facts (z. B. `EVENT_RESOLVED` aus einer Choice) warten auf den nächsten Lauf
- `followUpCandidate()` löst Ketten zentral auf, ohne Rekursion
- `scheduleCandidates()` begrenzt auf 3 neue Instanzen pro Tick

**Schutz bewertet: Grün.** Fact→Event→Choice→Command→Fact-Kreis ist geschlossen, aber nicht rekursiv.

### 3.4 Ausführung von Choices (`execute.ts`)

- `structuredClone(world.narrative)` als Snapshot für Rollback
- Preflight prüft alles vor dem Schreiben
- Ledger-Kosten werden nach den Commands gebucht; bei Fehlschlag Rollback
- Bei `transitionEvent` zu RESOLVED-Fehlschlag: Kosten zurückbuchen, Rollback

**Befund L3 (mittel):** Der Rollback stellt `world.narrative` wieder her, aber der Ledger-Transfer (Kosten) wird nur zurückgebucht, wenn `transitionEvent` zu RESOLVED fehlschlägt. Wenn die Choice erfolgreich aufgelöst wird (`RESOLVED`), ist der Kosten-Transfer endgültig. Das ist korrektes Verhalten, aber es gibt keinen Rollback für den Fall, dass `emitFact(EVENT_RESOLVED)` nach dem RESOLVED-Übergang fehlschlägt (würde den Fact-Kreis unterbrechen).

**Empfehlung:** `emitFact` kann nicht fehlschlagen (es pusht nur in eine Queue), daher ist das akzeptabel.

---

## 4. Unlogisches Verhalten und Inkonsistenzen

### 4.1 INVENTORY.md vs. Code — nicht eingestandene Fixes

Der `INVENTORY.md` §14 listet Befunde als offen, die im Code bereits behoben sind:

| Befund | INVENTORY sagt | Code zeigt |
|--------|---------------|------------|
| 1: `spinTest()` doppelter Aufruf | offen | `spinTestCmd` ruft `testSpin` **einmal** auf (`game-commands.ts:13`) |
| 33: Bar-Kapazität falsch in 3 UI-Dateien | offen | Alle 3 Dateien (`hud.tsx`, `machine-popup.tsx`, `diagnostics-popup.tsx`) importieren und nutzen `barCapacityForLevel` korrekt |
| 34: `Â·`-Mojibake in `table-launcher.tsx:56` | offen | Zeile 56 nutzt korrektes `·` (Middle Dot) |

**Bewertung:** Dokumentationslücke. `INVENTORY.md` spiegelt nicht den aktuellen Code-Stand wider. Das ist selbst ein "unlogisches Verhalten" der Dokumentation.

### 4.2 `spawnGuest()` ohne Exchange-Desk (`src/core/sim/spawn.ts`)

Wenn kein `EXCHANGE`-Möbelstück existiert, gibt `exchangePoint(world)` `null` zurück und `spawnGuest` gibt `null` — der Gast wird **nicht erstellt**. Wenn der Spieler den Exchange-Desk entfernt, kommen keine neuen Gäste mehr.

**Bewertung:** Designentscheidung oder Lücke? Die Doku sagt "Sitzplätze sind keine Obergrenze", sagt aber nicht, dass der Exchange-Desk Pflicht ist. Wenn er entfernt werden kann, ist das ein Spielstopp.

### 4.3 `barCapacityForLevel` — konsistent, aber nur an einer Stelle definiert

`deliveries.ts:13`: `barCapacityForLevel = 12 + 8 * max(1, level)`. Alle drei UI-Dateien nutzen diese Funktion korrekt. Kein Doppelbau mehr.

### 4.4 `demand.ts` — keine Gast-Obergrenze

`tickDemand` spawnt beliebig viele Gäste basierend auf `perDay`-Rate. Keine Obergrenze. Dokumentiert als Absicht ("Keine Gaesteobergrenze"), aber bei sehr hoher Attraktivität und langer Spielzeit kann die Gastzahl die Performance belasten.

### 4.5 `cleanerTick()` — unreachable Dreck wird still gelöscht (`src/core/sim/staff.ts:217`)

Wenn der Reiniger keinen Pfad zum ersten dreckigen Tile findet, wird `world.dirty.delete(first)` ausgeführt — der Dreck verschwindet ohne Reinigung. Das versteckt ein Problem (unreachable Bereich) statt es anzuzeigen.

### 4.6 `migrate.ts` — Archive-Duplikat beim ersten Load (`migrate.ts:106`)

```typescript
world.archive = (saved.archive ?? world.journal).map(...)
```

Wenn kein `archive` im Save existiert, wird `world.journal` (ebenfalls gerade aus `saved.journal` gesetzt) als Archiv verwendet. Das dupliziert den Journal als Archiv beim ersten Laden. Der Archiv-Zweck (dauerhafte Historie jenseits des 240er-Puffers) ist damit beim ersten Load nicht erfüllt — Archiv = aktueller Journal.

### 4.7 `plinko-sandbox.ts` — Sucht steigt bei jedem echten Wurf (`spinPlinkoSandbox:138`)

`state.addictionScore = Math.min(100, state.addictionScore + 0.6)` — steigt bei **jedem** echten Plinko-Wurf, auch bei Verlust. Testwürfe (`playPlinkoTest`) erhöhen sie nicht. Das ist konsistent (Sucht entsteht nur am Spiel), aber die Sucht steigt auch bei Verlust, nicht nur bei Gewinn.

### 4.8 `foreign-play.ts` `dealCardOutcome` — Einsatz auch bei Abbruch gebucht

Der Einsatz wird beim Austeilen gebucht (`foreignBet`), auch wenn der Spieler das Fenster vor der Abrechnung schließt. Dokumentiert ("auch bei Abbruch vor der Abrechnung"), aber aus Spielersicht potenziell unfair.

---

## 5. Commit-Historie — was einmal funktionierte und weg ist

Letzte 20 Commits auf `fix/test-suite-optimization`:

```
2ca5d78 Fix: CI-Pipeline für Soak und Narrative-Longrun
a3e5994 Merge branch 'main' into fix/test-suite-optimization
92e9a78 Testsuite-Optimierung: Soak, Narrative-Longrun und Card-Tables CI-only
63824e5 Merge pull request #121 from vannon091118/fix/floor-input-player-movement
a7347a9 Turn: 12 Dateien aktualisiert
7d8904f # Warmer Content-Batch
d867101 # Phase 5: Rivalen-Integration und Nachweise
1ae884f # F: Warme Rückkehr als zweite Stufe
0f18608 # E2: Besucherdisposition über den Gastpfad
c0b66c0 # D3: Fristablauf ohne Strafe
4591fc6 D2: Domänenwirkung COUNTER_RIVAL (#115)
```

Beobachtungen:
- Die Historie zeigt einen stetigen Ausbau der Narrative-Engine (D1, C1, C2, B4, Phase 5, Warmer Content-Batch)
- `a7347a9 "Turn: 12 Dateien aktualisiert"` — Turn-basierte Commits, automatisiert
- `f0646f8 Chunk-Splitting: Spiele-Paket lazy, React als Vendor-Chunk` — Build-Optimierung, kein Logik-Änderung
- Keine offensichtlich zurückgebauten Features in den letzten 20 Commits

**Befund L4 (info):** Die Commit-Historie zeigt keine verlorenen Features. Die Narrative-Engine wurde schrittweise von NAR-00 bis NAR-17 aufgebaut, alle Commits sind fortlaufend.

---

## 6. Doppelter Bau (Redundanz)

Bereits vom Redundanz-Gate (`verify:redundancy`) geprüft: keine byte-identischen Quelldateien, keine doppelten Fehlercodes. Bewusste Alias-Paare (`test`/`test:ci`, `verify`/`verify:quick`) sind dokumentiert.

**Ein potentieller Doppelbau:** `movement-queue.ts` (`src/core/sim/movement-queue.ts`) hat außerhalb seiner eigenen Testdatei **keinen Importeur** (Befund 21 in INVENTORY). Das Modul ist produktions-tot. Entweder entfernen oder ins Produkt holen.

---

## 7. Offene Befunde (Report 1)

| ID | Schwere | Befund | Datei | Empfehlung |
|----|---------|--------|-------|------------|
| L1 | mittel | Gast bleibt bei Zahlungsfehler dauerhaft in `CASHOUT` | `guest-service.ts:49-72` | Ausweg aus CASHOUT bei wiederholtem Fehler |
| L2 | **hoch** | `settleGuests` kann Gäste doppelt auszahlen bei fehlgeschlagener Mittel-Buchung | `actions.ts:22-30` | Transaktionelle Abarbeitung oder pro-Gast-Entfernung |
| L3 | mittel | Kein Rollback für `emitFact(EVENT_RESOLVED)` nach RESOLVED-Übergang | `execute.ts:121-124` | Akzeptabel (emitFact kann nicht fehlschlagen) |
| L4 | info | INVENTORY.md listet bereits gefixte Befunde als offen | `docs/INVENTORY.md` | INVENTORY auf aktuellen Code-Stand bringen |
| L5 | niedrig | Keine Gäste ohne Exchange-Desk | `spawn.ts:52-53` | Klären: ist Exchange-Desk unverrückbar? |
| L6 | niedrig | Unreachable Dreck wird still gelöscht | `staff.ts:217` | Statt löschen: als blockiert melden |
| L7 | niedrig | Archiv = Journal beim ersten Load | `migrate.ts:106` | Archiv separat initialisieren |
| L8 | info | `movement-queue.ts` produktions-tot | `movement-queue.ts` | Entfernen oder ins Produkt holen |

---

## 8. Fazit Report 1

Die Logik-Ketten sind weitgehend kausal korrekt und fail-closed. Der kritischste Befund ist **L2** (mögliche Doppelauszahlung in `settleGuests`), gefolgt von **L1** (Gast im CASHOUT-Zustand fest). Die Dokumentation (`INVENTORY.md`) hinkt dem Code hinter sich (mehrere Befunde als offen gelistet, die bereits gefixt sind).

Race Conditions gibt es nicht (einfädig), aber Reihenfolge-Abhängigkeiten sind dokumentiert und beherrscht.

---

*Ende Report 1. Nächster Schritt: Report 2 (Security & Effizienz) und Report 3 (Spielverhalten, Duplikate, Gaps).*
