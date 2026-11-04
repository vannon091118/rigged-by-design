# LEAD-Plan (korrigiert nach SUB-A-Review)

**Status:** LEAD-Korrektur (nach SUB-A-Bericht)  
**Datum:** 2026-11-04T22:23 UTC  
**Basis:** `docs/PLAN-LEAD-MERGE.md` + `docs/REVIEW-SUB-A-ADVERSARIAL.md`  
**Ziel:** Korrigierter Plan, bereit für SUB-B-Review

---

## 1. Änderungen gegenüber dem ursprünglichen LEAD-Plan (per SUB-A-Kritik)

| Stelle | Ursprünglicher Plan | SUB-A-Kritik | Korrigierter Plan |
|--------|-------------------|--------------|-------------------|
| Phase 1.1 | `settleGuests` "transaktionell" mit Trockenlauf | Overthinking: zu komplex, schwer umzusetzen | **Pro-Gast-entfernen-nach-Erfolg**: nach jeder erfolgreichen Buchung den Gast aus `world.guests` entfernen; bei Abbruch bleiben restliche Gäste im Array für erneuten Versuch |
| Phase 1.3 | Schulden-Tilgung "im nächsten Slice implementieren" | Keine rein technische Entscheidung; Nutzer muss Spielregel entscheiden | **Blockierende Nutzerentscheidung**: erst Entscheidung (Tilgung bei Rückkehr? automatische Rückführung? Zinsen?), dann Implementierung |
| Phase 2.1 | Alle 3 Mods gleichzeitig mit Mechanik versehen | Spielregel-Entscheidung pro Mod nötig; sequenziell besser | **Ein Mod pro Entscheidung**: VELVET → Entscheidung → Implementierung → FREE_DRINK → … → EXTRA_REEL |
| Tests | Exit-Kriterien implizit | L1 und L2 Tests nicht explizit benannt | **Explizite Tests**: `settleGuests`-Doppelauszahlungstest, `payAndLeave`-CASHOUT-Exit-Test |
| Phase 3 UI | Kein LOC-Budget veranschlagt | `check:loc` kann rot werden | **LOC-Budget** für neue UI-Dateien (Rivalen-Profilkarte) |
| Phase 2.2 | Einsatz mit Persona-Budget | Balancierung (wie viel höher?) ist Spielregel | **Nutzerentscheidung** für Skalierungsfaktor vor Implementierung |

---

## 2. Korrigierter Plan (vollständig)

### Grundsätze (unverändert)

- Ein Owner pro State: `world-store` hält Welt/Ledger/PRNG; UI liest nur Snapshots
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganze Mikro-Einheiten
- RNG: Gameplay und Presentation teilen nie einen Strom
- Fail-Closed: Ledger-Integrität, Narrative-Schema, Trigger-Validator, Assets-Gate
- Jede Datei hat genau eine Zuständigkeit und ein LOC-Budget
- Keine Wegwerf-Dateien, keine `tmp-`/`temp-`/`scratch-`-Dateien
- Weg nach `main`: Arbeitsbranch → PR → Gate (`promote.yml`), kein Direktpush

---

### Phase 0: Dokumentation synchronisieren (sofort, keine Code-Änderung)

- `docs/INVENTORY.md` §14 auf aktuellen Code-Stand bringen (Befunde 1, 33, 34, 37 als "gelöst" markieren)
- `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `AGENTS.md` mit `rbd-doc`-Marker synchronisieren (`pnpm run docs:sync`)
- Exit: `verify:docs` grün, `INVENTORY.md` widerspricht nicht dem Code

---

### Phase 1: Geld- und Zustandskorrektur (kritisch)

**1.1 `settleGuests` idempotent machen** (`src/core/sim/actions.ts:22-30`)
- Nach jeder erfolgreichen Gast-Buchung (`payPending`, `exchangeFromVc`, `closeFiat`) den Gast aus `world.guests` entfernen
- Bei Abbruch (Fehler bei Gast N) sind Gäste 1..N-1 bereits entfernt und gebucht; Gäste N..Ende bleiben für erneuten Versuch
- Kein doppelter Trockenlauf nötig; idempotent durch Entfernung nach Erfolg
- Exit-Kriterium: Test belegt, dass bei fehlgeschlagener Mittel-Buchung keine Gast doppelt ausgezahlt wird (L2-Test)

**1.2 `payAndLeave` Fehlerpfad beheben** (`src/core/sim/guest-service.ts:49-72`)
- Im `catch`: Gast nicht ewig in `CASHOUT` lassen; stattdessen auf `LEAVE` setzen (Gast verlässt den Floor ohne weitere Auszahlungsversuche) ODER wiederholte Fehlschläge nach N Versuchen aufgeben
- Exit-Kriterium: Gast kann nicht dauerhaft in `CASHOUT` hängen bleiben (L1-Test)

**1.3 Schulden-Tilgungspfad** (`src/core/sim/money.ts` `payOut`, `payOrBorrow`)
- **BLOCKIEREND**: Nutzerentscheidung nötig, bevor Code geschrieben wird
- Offene Fragen: Tilgen Gäste Schulden bei Rückkehr? Automatische Teilrückführung bei Haus-Gewinn? Zinsen/Mahnstufen?
- Exit: Dokumentierte Entscheidung im `docs/DEVTAGEBUCH.md`, dann Implementierung

---

### Phase 2: Spielmechanik-Vervollständigung (Mittel)

**2.1 Mods mit Mechanik** (`src/core/sim/offers.ts` MODS + zugehörige Sim-Dateien)
- **Sequenziell, ein Mod pro Nutzerentscheidung:**
  1. `VELVET`: Gastgüte beeinflussen (Budget/Persona-Gewicht) oder Text ehrlichstellen → Entscheidung → Implementierung
  2. `FREE_DRINK`: Echten Drink pro Spin buchen oder Text ehrlichstellen → Entscheidung → Implementierung
  3. `EXTRA_REEL`: Echte vierte Walze oder Text ehrlichstellen → Entscheidung → Implementierung
- Exit: Jeder Mod hat entweder dokumentierte Spielwirkung oder ehrlichen Text

**2.2 Einsatz mit Persona-Budget skalieren** (`src/core/sim/offers.ts` `offerScore`)
- `budgetFactor` aus `personas.ts` in `offerScore` einbeziehen
- **BLOCKIEREND**: Nutzerentscheidung für Skalierungsfaktor (wie viel höher bei High Roller?)
- Exit: Einsatz orientiert sich an Persona-Budget

**2.3 `movement-queue.ts` entscheiden**
- Entfernen (produktiv tot) oder dokumentiert ins Produkt holen
- Exit: Modul ist entweder genutzt oder entfernt

---

### Phase 3: UI und UX-Lücken

**3.1 Rivalen-Profilkarte** (`src/ui/`, `narrative/rival-context.ts`)
- Profilkarte mit Haltung, Indizien, Historie, Gegenmaßnahmen-Fenster
- **LOC-Budget veranschlagen** vor Implementierung (`check:loc` muss grün bleiben)
- Exit: `NarrativeView.rivals` wird im UI angezeigt

**3.2 Ohne Exchange-Desk keine Gäste klären** (`src/core/sim/spawn.ts`)
- Entscheidung: Ist Exchange-Desk unverrückbar? Oder gibt es Fallback?
- Exit: Klare Regel, kein stiller Gast-Stopp

**3.3 Unreachable Dreck als blockiert melden** (`src/core/sim/staff.ts:217`)
- Statt `world.dirty.delete(first)`: als blockiert markieren, UI zeigt Hinweis
- Exit: Dreck wird nicht still gelöscht

---

### Phase 4: Architektur-Zustand (laufendes Prinzip)

| Zustand | Owner | Wo lebt er | Keine Kopie in |
|---------|-------|------------|----------------|
| Welt / Ledger / PRNG / Save | `world-store.ts` | `src/store/world-store.ts` | UI, Render |
| Spielzustand im UI | — | nur `GameView`-Snapshot | — |
| Geld | Ledger | `src/core/economy/ledger.ts` | keine Zähler außerhalb |
| Narrative Facts | `narrative/facts.ts` | `WorldState.narrative.pending` | Journal (separat) |
| Beziehungen | `narrative/relationships.ts` | `WorldState.narrative.relationships` | keine zweite Kanten-Liste |
| Rivalen | `rival-ai/` | `WorldState.rivals` | keine zweite Rivalen-Liste |
| Journal | `sim/journal.ts` | `WorldState.journal` + `archive` | keine zweite Log-Wahrheit |

---

## 3. Exit-Kriterien für den Gesamtplan

Bevor der Implementierungs-Loop startet:

- [ ] `verify:quick` grün (alle 10 Gates)
- [ ] `INVENTORY.md` widerspricht nicht dem Code (Phase 0)
- [ ] L2-Test: `settleGuests` Doppelauszahlung verhindert (Phase 1.1)
- [ ] L1-Test: `payAndLeave` CASHOUT-Exit funktioniert (Phase 1.2)
- [ ] S1: Schulden-Tilgungsentscheidung dokumentiert (Phase 1.3)
- [ ] G6: INVENTORY-Disparitäten behoben (Phase 0)
- [ ] LEAD, SUB A, SUB B haben den Plan freigegeben

---

## 4. Nächster Schritt

Der korrigierte Plan geht an SUB B zum unabhängigen adversarial Review.

---

*SUB B: Bitte unabhängiges adversarial Review dieses korrigierten Plans gegen die Daten. Bericht an LEAD.*
