# LEAD-Plan: Zusammengeführter Sanierungs- und Aufbauplan

**Status:** LEAD-Entwurf (vor SUB-A-/SUB-B-Review)  
**Datum:** 2026-11-04T22:23 UTC  
**Basis:** Report 1 (Logik/Race), Report 2 (Security/Effizienz), Report 3 (Spielverhalten/Gaps)  
**Ziel:** Ein solides, langfristiges Fundament. Data-driven development. Ein Owner pro Zustand. Keine zwei Zustände in einer Maschine. Alles verbunden. Weg vom "LISTEN MENÜ".

---

## 1. Grundsätze (aus AGENTS.md / Architektur)

- Ein Owner pro State: `world-store` hält Welt/Ledger/PRNG; UI liest nur Snapshots
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganze Mikro-Einheiten
- RNG: Gameplay und Presentation teilen nie einen Strom
- Kein `Math.random`, `Date.now`, `new Date()` etc. in `src/` und `scripts/`
- Fail-Closed: Ledger-Integrität, Narrative-Schema, Trigger-Validator, Assets-Gate
- Jede Datei hat genau eine Zuständigkeit und ein LOC-Budget
- Keine Wegwerf-Dateien, keine `tmp-`/`temp-`/`scratch-`-Dateien
- Weg nach `main`: Arbeitsbranch → PR → Gate (`promote.yml`), kein Direktpush

---

## 2. Befund-Lage (aus den 3 Reports)

### Kritisch (muss vor neuem Feature)

| ID | Quelle | Schwere | Betroffener Code | Problem |
|----|--------|---------|------------------|---------|
| L2 | R1 | **hoch** | `src/core/sim/actions.ts:22-30` `settleGuests()` | Bei fehlgeschlagener Mittel-Buchung in der Schleife können bereits gebuchte Gäste doppelt ausgezahlt werden (Gäste bleiben im Array, `world.guests = []` kommt erst am Ende) |
| L1 | R1 | mittel | `src/core/sim/guest-service.ts:49-72` `payAndLeave()` | Zahlungsfehler lässt Gast dauerhaft in `CASHOUT` hängen (kein `leave()` im Fehlerpfad) |
| S1 | R2 | mittel | `src/core/sim/money.ts` `payOut`, `payOrBorrow` | `HAUS_SCHULDEN` hat keinen Tilgungspfad; Schulden können unbegrenzt wachsen |
| G6 | R3 | mittel | `docs/INVENTORY.md` §14 | Listet 5 bereits gefixte Befunde als offen (spinTest, Bar-Kapazität, Mojibake, Poker-Fix, Gästepfad) |

### Mittel (sollte im nächsten Slice)

| ID | Quelle | Betroffener Code | Problem |
|----|--------|------------------|---------|
| G1 | R3 | `src/core/sim/offers.ts` MODS | 3 Mods (VELVET, FREE_DRINK, EXTRA_REEL) ohne Spielwirkung über Anziehung/Geduld/Betrieb hinaus |
| G2 | R3 | `src/core/sim/offers.ts` `offerScore()` | Einsatz skaliert nie mit Persona-Budget (High Roller spielt nicht höher) |
| G5 | R3 | `src/core/sim/movement-queue.ts` | Produktiv-totes Modul ohne Importeur |
| G7 | R3 | `src/ui/` (fehlend) | Rivalen-Profilkarte im UI fehlt (Modell existiert unter `narrative/rival-context.ts`) |
| L5 | R1 | `src/core/sim/spawn.ts:52-53` | Ohne Exchange-Desk kommen keine Gäste (`spawnGuest` gibt `null`) |
| L6 | R1 | `src/core/sim/staff.ts:217` | Unreachable Dreck wird still gelöscht statt als blockiert gemeldet |
| L7 | R2 | `src/store/migrate.ts:106` | Archiv = Journal beim ersten Load (kein separates Archiv) |

### Niedrig / Dokumentation

| ID | Quelle | Problem |
|----|--------|---------|
| L3 | R1 | Kein Rollback für `emitFact(EVENT_RESOLVED)` (akzeptabel, `emitFact` kann nicht fehlschlagen) |
| L4 | R1 | Commit-Historie zeigt keine verlorenen Features |
| G3 | R3 | Sucht steuert nichts über interne Werte hinaus |
| G8 | R3 | `TRIGGER_DIALOG` nicht ausführbar (dokumentiert, auf Dialog-UI wartend) |
| G9 | R3 | Keine Playwright-Tests (Vitest/jsdom ist Architekturentscheidung) |
| G10 | R3 | Soak/RTP/Balance nur in CI (dokumentiert) |

---

## 3. Planungs-Loop (Data-Driven Development)

Der Plan wird in Phasen ausgefahren. Jede Phase hat messbare Exit-Kriterien.

### Phase 0: Dokumentation synchronisieren (sofort, keine Code-Änderung)

- `docs/INVENTORY.md` §14 auf aktuellen Code-Stand bringen (Befunde 1, 33, 34, 37 als "gelöst" markieren)
- `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `AGENTS.md` mit `rbd-doc`-Marker synchronisieren (`pnpm run docs:sync`)
- Exit: `verify:docs` grün, `INVENTORY.md` widerspricht nicht dem Code

### Phase 1: Geld- und Zustandskorrektur (kritisch)

**1.1 `settleGuests` transaktionell machen** (`actions.ts`)
- Vor der Schleife: alle Buchungen prüfen (Trockenlauf), dann ausführen
- Oder: nach jeder erfolgreichen Buchung den Gast aus `world.guests` entfernen, damit bei Wiederholung keine Doppelauszahlung entsteht
- Exit-Kriterium: Test belegt, dass bei fehlgeschlagener Mittel-Buchung keine Gast doppelt ausgezahlt wird

**1.2 `payAndLeave` Fehlerpfad beheben** (`guest-service.ts`)
- Im `catch`: Gast nicht ewig in `CASHOUT` lassen, sondern entweder auf `LEAVE` setzen oder wiederholte Fehlschläge nach N Versuchen aufgeben
- Exit-Kriterium: Gast kann nicht dauerhaft in `CASHOUT` hängen bleiben

**1.3 Schulden-Tilgungspfad definieren** (`money.ts`)
- Roadmap-Entscheidung: Wann und wie werden `HAUS_SCHULDEN` getilgt?
- Mindestimplementierung: automatische Teilrückführung bei Haus-Gewinn, oder Spieler kann über UI tilgen
- Exit-Kriterium: Schulden können abgebaut werden, nicht nur wachsen

### Phase 2: Spielmechanik-Vervollständigung (Mittel)

**2.1 Mods mit Mechanik versehen** (`offers.ts`, `actions.ts`, `guest-*.ts`)
- `VELVET`: Gastgüte beeinflussen (Budget/Persona-Gewicht) oder Text ehrlichstellen
- `FREE_DRINK`: Echten Drink pro Spin buchen oder Text ehrlichstellen
- `EXTRA_REEL`: Echte vierte Walze oder Text ehrlichstellen
- Exit: Jeder Mod hat entweder dokumentierte Spielwirkung oder ehrlichen Text

**2.2 Einsatz mit Persona-Budget skalieren** (`offers.ts` `offerScore`)
- High Roller (budgetFactor > 1) setzt höher als Mindesteinsatz
- Exit: Einsatz orientiert sich an Persona-Budget

**2.3 `movement-queue.ts` entscheiden** (entfernen oder integrieren)
- Exit: Modul ist entweder produktiv genutzt oder entfernt

### Phase 3: UI und UX-Lücken

**3.1 Rivalen-Profilkarte** (`src/ui/`, `narrative/rival-context.ts`)
- Profilkarte mit Haltung, Indizien, Historie, Gegenmaßnahmen-Fenster
- Exit: `NarrativeView.rivals` wird im UI angezeigt

**3.2 Ohne Exchange-Desk keine Gäste klären** (`spawn.ts`)
- Entscheidung: Ist Exchange-Desk unverrückbar? Oder gibt es Fallback?
- Exit: Klare Regel, kein stiller Gast-Stopp

**3.3 Unreachable Dreck als blockiert melden** (`staff.ts`)
- Statt `world.dirty.delete(first)`: als blockiert markieren, UI zeigt Hinweis
- Exit: Dreck wird nicht still gelöscht

---

## 4. Architektur-Zustand: Ein Owner, keine zwei Zustände

| Zustand | Owner | Wo lebt er | Keine Kopie in |
|---------|-------|------------|----------------|
| Welt / Ledger / PRNG / Save | `world-store.ts` | `src/store/world-store.ts` | UI, Render |
| Spielzustand im UI | — | nur `GameView`-Snapshot | — |
| Geld | Ledger | `src/core/economy/ledger.ts` | keine Zähler außerhalb |
| Narrative Facts | `narrative/facts.ts` | `WorldState.narrative.pending` | Journal (separat) |
| Beziehungen | `narrative/relationships.ts` | `WorldState.narrative.relationships` | keine zweite Kanten-Liste |
| Rivalen | `rival-ai/` | `WorldState.rivals` | keine zweite Rivalen-Liste |
| Journal | `sim/journal.ts` | `WorldState.journal` + `archive` | keine zweite Log-Wahrheit |

**Regel:** Jeder schreibende Pfad läuft serialisiert über den Store. Engines bleiben reine Funktionen. UI sendet nur Commands.

---

## 5. Weg vom "LISTEN MENÜ"

Der Auftrag sagt: "weg vom 'LISTEN MENÜ'". Das bedeutet: keine passiven Menüs, die nur anzeigen, sondern verbundene, handelbare Oberflächen.

- Jeder UI-Button löst einen Store-Command aus (nicht nur Anzeige)
- Jede Anzeige ist abgeleitet vom Snapshot (kein eigener UI-Zustand)
- Narrative-UI zeigt Szenen und Profile als reines Anzeigemodell (`GameView.narrative`)
- Keine zwei Zustände: UI hält keinen eigenen Spielzustand

---

## 6. Exit-Kriterien für den Gesamtplan

Bevor der Implementierungs-Loop startet:

- [ ] `verify:quick` grün (alle 10 Gates)
- [ ] `INVENTORY.md` widerspricht nicht dem Code
- [ ] L2 (Doppelauszahlung) behoben + Test
- [ ] L1 (CASHOUT-Hänger) behoben + Test
- [ ] S1 (Schulden-Tilgung) definiert + implementiert
- [ ] G6 (INVENTORY-Disparitäten) behoben
- [ ] LEAD, SUB A, SUB B haben den Plan freigegeben

---

## 7. Nächster Schritt

Der Plan geht in den adversarial Review-Loop:
1. SUB A prüft den Plan kausal gegen die Daten (Konflikte, Overthinking vermeiden)
2. LEAD korrigiert den Plan
3. SUB B prüft den aktualisierten Plan unabhängig
4. LEAD sendet SUB-B-Bericht unverändert an SUB A
5. SUB A prüft den korrigierten Plan NOCHMAL gegen die Daten
6. LOOP bis ALLE 3 Freigabe sagen

Dann: Implementierungs-Loop → Review-Loop → PR + Merge.

---

*Ende LEAD-Plan. SUB A: Bitte adversarial Review des Plans gegen die Daten.*
