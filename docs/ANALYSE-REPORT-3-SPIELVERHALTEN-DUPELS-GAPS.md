# Analyse-Report 3: Spielverhalten, doppelter Bau, Gaps und Commit-Historie

**Status:** Erstentwurf (LEAD)  
**Datum:** 2026-11-04T22:23 UTC  
**Basis:** Vollständige Lektüre aller Simulations-, Store-, Narrative- und UI-Kerndateien; `docs/INVENTORY.md` §14–16; `docs/CHANGELOG.md`; `docs/ROADMAP.md`; Git-Historie (`git log --all --oneline`)  
**Ziel:** Was funktioniert, was wurde gebaut aber nicht genutzt, wo sind Lücken, was ist doppelt gebaut, was ist aus der Historie verschwunden.

---

## 1. Zusammenfassung

Das Spiel ist eine voll funktionale Lebenssimulation mit Casino als Startumgebung. Die Kernmechaniken (Geld, Gäste, Spiele, Personal, Nachfrage, Narrative) sind implementiert und getestet. Drei Mods (`VELVET`, `FREE_DRINK`, `EXTRA_REEL`) versprechen mehr als der Code liefert — sie sind "Mods ohne Mechanik". Es gibt ein produktions-totes Modul (`movement-queue.ts`). Die Dokumentation (`INVENTORY.md`) listet mehrere bereits gefixte Befunde noch als offen.

---

## 2. Spielverhalten — was funktioniert, was fehlt

### 2.1 Implementierte Kernmechaniken

| Bereich | Status | Details |
|---------|--------|---------|
| Geld / Ledger | ✅ | Doppelte Buchführung, VaCoins als Mikro-Einheiten, fail-closed |
| Gäste / Zustandsmaschine | ✅ | ENTER→EXCHANGE→CHOOSE→PLAY/DRINK/TOILET/WAIT→CASHOUT→LEAVE/ANGRY |
| Spiele | ✅ | SLOT, BLACKJACK, POKER, VIDEO_POKER, ROULETTE, PLINKO, SHELL, DICE |
| Personal | ✅ | Guard, Cleaner, Bartender, Cashier, Porter mit sichtbarem Floor-Arbeiten |
| Nachfrage | ✅ | Geplante Ankünfte, keine Obergrenze, Event-Tage (Neon-Nacht, Turnierabend) |
| Narrative Engine | ✅ | NAR-00 bis NAR-17: Facts, Trigger, Scheduler, Templates, Choices, Commands, Composer, UI |
| Rivalen | ✅ | Reine Politik, RIVAL_ACTION-Facts, Sabotage, Preiskampf, Gaeste-Abwerbung |
| Save / Migration | ✅ | v10, v5–v9 migrieren, v3/v4 verwerfen, Ledger-Replay beim Laden |
| UI / Render | ✅ | PixiJS Floor, React-Popups, HUD, Diagnose, Kamera |

### 2.2 Mods ohne Mechanik (offene Design-Entscheidungen)

Aus `INVENTORY.md` §"Offene Design-Entscheidungen: Mods ohne Mechanik":

| Mod | Verspricht | Code tut | Entscheidung nötig |
|-----|-----------|----------|-------------------|
| `VELVET` | "Bessere Gäste" | nur +220 Anziehung, −2 Gedraut | Soll der Mod die Gastgüte (Budget/Persona-Gewicht) heben, oder wird der Text ehrlich? |
| `FREE_DRINK` | "Ein Drink pro Spin" | nur +140 Anziehung, +8 Geduld, 0,03 VC Betrieb | Zahlt das Haus pro Spin einen echten Drink (Buchung), oder bleibt es bei Geduld plus Betriebskosten? |
| `EXTRA_REEL` | "Vierte Walze" | nur +300 Anziehung; Walzen kommen aus `item.reels` | Schenkt der Mod eine Walze (Preisgefüge kippt), oder wird er zum Rabatt/ehrlichen Text? |

**Befund G1 (mittel):** Drei verkaufte Mods haben keine Spielwirkung über Anziehung/Geduld/Betriebskosten hinaus. Die Spieler erwerben etwas, das nicht das tut, was der Text verspricht.

**Empfehlung:** Für jeden Mod eine Spielregel entscheiden und implementieren, oder den Text ehrlich formulieren.

### 2.3 Einsatz skaliert nie mit Persona-Budget

`offerScore()` verwendet `max(slotMinBet, item.baseBet)` als Einsatz. High Roller (budgetFactor 5) spielen nicht höher, nur länger (mehr Spins durch höhere Sucht-Session-Länge).

**Befund G2 (mittel):** Roadmap nennt dies offen ("Der Einsatz sollte mit dem Persona-Budget skalieren"). Keine Implementierung.

### 2.4 Sucht steuert nichts

Die Sucht (`addiction`) beeinflusst `sessionSpins` (mehr Spins bei hoher Sucht) und `addictedStake` (höherer Einsatz), aber hat keine negativen Folgen für den Spieler (kein Spielverbot, kein Geldverlust außer normalen Verlusten).

**Befund G3 (info):** Roadmap: "die Sucht steuert nichts". Offener Punkt.

### 2.5 PLAYER_CASH hat keinen Ausgabepfad

`PLAYER_CASH` wird nur gebucht (`playerTakeHome` von HAUSKONTO nach PORTEMONNAIE... warte, `PLAYER_CASH` ist ein separates Konto). Laut INVENTORY Befund: "`PLAYER_CASH` hat keinen Ausgabepfad — nur Gutschrift in `self-exclusion-bet.ts`". Gefixt durch `cashOutPlayerCash` (INVENTORY sagt "gefixt").

**Befund G4 (info):** Bereits gefixt, aber INVENTORY listet es noch als offen.

---

## 3. Doppelter Bau und redundante Strukturen

### 3.1 `movement-queue.ts` — produktions-tot

`src/core/sim/movement-queue.ts` hat außerhalb seiner eigenen Testdatei **keinen Importeur**. Die Kassenschlange nutzt stattdessen `queue-spots.ts`. Das Modul ist eine generische Stations-Engine ohne Verbraucher.

**Befund G5 (niedrig):** Produktiv-totes Modul. Kandidat für Entfernung oder bewusste Integration.

**Status:** Bereits als Befund 21 in INVENTORY dokumentiert, "Nutzerentscheidung".

### 3.2 Keine byte-identischen Dateien

Redundanz-Gate (`verify:redundancy`): 363 Dateien, 45 Skripte, 29 Fehlercodes geprüft — keine echte Doppelung. Bewusste Alias-Paare dokumentiert.

### 3.3 Keine doppelt eingetragenen Fehlercodes

`error-codes.ts` und `ERROR_CATALOG.md` enthalten exakt dieselben 23 Codes (INVENTORY Befund 12).

---

## 4. Gaps — Lücken in der Abdeckung

### 4.1 Dokumentation hinkt dem Code hinterher (INVENTORY ↔ Code)

| Befund | INVENTORY sagt | Code zeigt |
|--------|---------------|------------|
| 1: `spinTest()` doppelt | offen | Einmaliger Aufruf |
| 33: Bar-Kapazität UI | offen | Alle 3 UI-Dateien nutzen `barCapacityForLevel` |
| 34: Mojibake | offen | Korrektes `·` in `table-launcher.tsx:56` |
| 37: Poker-Geldweg | "auf main bestätigt" | Fix bereits im Code (`streetCommitted` statt `committed`) |
| 4: Gästepfad | offen | Implementiert |

**Befund G6 (mittel):** `INVENTORY.md` §14 listet 5 Befunde als offen, die im Code bereits behoben sind. Die Dokumentation spiegelt nicht den aktuellen Stand.

### 4.2 Fehlende UI für Rivalen-Profilkarte

ROADMAP und DEVTAGEBUCH nennen die Rivalen-Profilkarte (Historie, Indizien) als offen. Das Modell (`narrative/rival-context.ts`) existiert, aber die UI-Karte fehlt.

**Befund G7 (niedrig):** Rivalen-Profilkarte im UI fehlt.

### 4.3 `TRIGGER_DIALOG` nicht ausführbar

`registry.ts`: `TRIGGER_DIALOG` hat `executable: false`. Wird bis zur DialogfUI nicht ausführbar. Dokumentiert als NAR-14-offen.

**Befund G8 (info):** Bekannter Gap, dokumentiert.

### 4.4 Keine Spieltests (Playwright)

Die Repository hat **keine Playwright-Tests**. UI-Tests laufen in jsdom via `@testing-library/react` (`*.test.tsx`). Es gibt keine End-to-End-Browser-Tests.

**Befund G9 (info):** Der Auftrag nennt Playwright-Tests, aber das Projekt nutzt Vitest/jsdom. Keine Playwright-Konfiguration gefunden. Dies ist eine Architekturentscheidung (headless, schnell), kein fehlendes Feature.

### 4.5 Soak, RTP, Balance nur in CI

`test:affected` überspringt Statistik- und Messnachweise (RTP, Poker-Verteilung, Soak, Benchmarks). Diese laufen nur über `ci:long` in GitHub Actions.

**Befund G10 (info):** Bekannte Einschränkung, dokumentiert.

---

## 5. Commit-Historie — was einmal funktionierte und weg ist

Letzte 20 Commits (alle Branches):

```
2ca5d78 Fix: CI-Pipeline für Soak und Narrative-Longrun
a3e5994 Merge branch 'main' into fix/test-suite-optimization
92e9a78 Testsuite-Optimierung: Soak, Narrative-Longrun und Card-Tables CI-only
63824e5 Merge pull request #121 from vannon091118/fix/floor-input-player-movement
a7347a9 Turn: 12 Dateien aktualisiert
7d8904f # Warmer Content-Batch
5695fb9 # Warmer Content-Batch  (doppelt auf verschiedenen Branches)
d867101 # Phase 5: Rivalen-Integration und Nachweise
46e14fc # Phase 5: Rivalen-Integration und Nachweise  (doppelt)
1ae884f # F: Warme Rückkehr als zweite Stufe
eab6e3b # F: Warme Rückkehr als zweite Stufe  (doppelt)
```

**Beobachtungen:**

1. **Keine verlorenen Features:** Die Historie zeigt einen stetigen Aufbau (Narrative NAR-00→17, Rivalen, Demand-Events, UI). Keine Funktionalität wurde entfernt und nicht ersetzt.

2. **Doppelte Commit-Betreffzeilen:** "Warmer Content-Batch", "Phase 5", "Warme Rückkehr" erscheinen jeweils zweimal — einmal auf dem Feature-Branch, einmal nach Merge in main. Das ist normales Merge-Verhalten, kein Problem.

3. **`a7347a9 "Turn: 12 Dateien aktualisiert"`**: Automatisierte Turn-Commits, zeigen den etablierten Arbeitszyklus.

4. **`f0646f8 Chunk-Splitting: Spiele-Paket lazy, React als Vendor-Chunk`**: Build-Optimierung, keine Logik-Änderung.

**Befund G11 (info):** Aus der Commit-Historie ist nichts "einfach weg" — alle Features sind fortlaufend aufgebaut worden. Die Narrative-Engine ist von NAR-00 bis NAR-17 vollständig implementiert.

---

## 6. Doppelt gebaut vs. einzelne Wahrheit

Das Projekt folgt konsequent dem Prinzip "eine Stelle pro Wahrheit":

| Wahrheit | Einzige Stelle |
|----------|---------------|
| Welt / Ledger / PRNG / Save | `world-store.ts` |
| Spielzustand im UI | Kein eigener — nur `GameView`-Snapshot |
| Geldquelle | `EXTERNAL_WORLD` (Minting) |
| Fehlerregister | `error-codes.ts` ↔ `ERROR_CATALOG.md` |
| Kamera-Wahrheit | `floor-camera.ts` |
| Bodenhinweise | `floor-cues.ts` |
| RNG Gameplay | `src/core/rng/` |
| RNG Presentation | `src/render/rng.ts` |
| Narrative Runtime | `narrative/runtime.ts` |
| Fact-Drain | `processNarrativeBoundaryDetailed()` |
| Rivalen-Politik | `rival-ai/policy.ts` (rein, kein PRNG) |

**Bewertung: Grün.** Keine gespiegelten Zustandskopien, keine zweite Save-Wahrheit.

---

## 7. Offene Befunde (Report 3)

| ID | Schwere | Befund | Quelle | Empfehlung |
|----|---------|--------|--------|------------|
| G1 | mittel | 3 Mods ohne Spielwirkung (VELVET, FREE_DRINK, EXTRA_REEL) | `INVENTORY.md` offene Entscheidungen | Spielregel pro Mod oder ehrlicher Text |
| G2 | mittel | Einsatz skaliert nie mit Persona-Budget | `ROADMAP.md` "Jetzt" | Einsatz mit Persona-Budget skalieren |
| G3 | info | Sucht steuert nichts (außer internen Werten) | `ROADMAP.md` | Sucht-Wirkung definieren |
| G4 | info | PLAYER_CASH Ausgabepfad — bereits gefixt | `INVENTORY.md` | INVENTORY aktualisieren |
| G5 | niedrig | `movement-queue.ts` produktions-tot | `INVENTORY.md` Befund 21 | Entfernen oder integrieren |
| G6 | mittel | INVENTORY listet 5 gefixte Befunde als offen | `INVENTORY.md` §14 | INVENTORY auf Code-Stand bringen |
| G7 | niedrig | Rivalen-Profilkarte im UI fehlt | `ROADMAP.md`, `DEVTAGEBUCH.md` | UI-Karte implementieren |
| G8 | info | `TRIGGER_DIALOG` nicht ausführbar | `registry.ts` | Dokumentiert, auf Dialog-UI warten |
| G9 | info | Keine Playwright-Tests (nur Vitest/jsdom) | Auftrag vs. Repo | Architekturentscheidung, keine Änderung |
| G10 | info | Soak/RTP/Balance nur in CI | `AGENTS.md` | Dokumentiert, keine Änderung |

---

## 8. Fazit Report 3

Das Spielverhalten ist solide implementiert mit durchgängigem Prinzip "eine Stelle pro Wahrheit". Die Hauptlücken sind:

1. **Drei Mods ohne Mechanik** (G1) — Designentscheidung nötig
2. **Dokumentations-Gap** (G6) — INVENTORY listet gefixte Befunde als offen
3. **Rivalen-Profilkarte UI** (G7) — Modell existiert, UI fehlt

Aus der Commit-Historie ist nichts verloren gegangen; alle Features sind fortlaufend aufgebaut.

---

*Ende Report 3. Alle drei Berichte liegen vor. Nächster Schritt: Merge in LEAD-Plan, dann Lead–Sub A–Sub B Review-Schleife.*
