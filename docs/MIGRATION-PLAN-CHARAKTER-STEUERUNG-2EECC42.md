# Migrationsplan: Charakter-Steuerung mit Interaktionsradius (Stand `2eecc42`)

**Repository:** Rigged by Design (Vite + React 19 + TypeScript + PixiJS 8 Casino-Sim)  
**Branch:** `main`  
**Commit:** `2eecc42` (nach Pull von `origin/main`)  
**AGENTS.md:** v0.3.87 | 2026-11-03 03:17 UTC  
**NAR-Status:** NAR-00–13 erledigt, **NAR-14 bis NAR-17 offen** (UI, Rivalen, Soak)

---

## Zielsetzung

Der Spieler steuert **ausschlässlich seinen eigenen Charakter**. Alle Aktionen sind nur verfügbar, wenn die Spielfigur physisch im Interaktionsradius des Zielobjekts ist. Der Charakter ist das zentrale User-Input-Reaktions-Objekt. Das **Context-Radius-Menü (RadialMenu)** wird der Standard-Weg für alle Interaktionen. Das **Smartphone** ist zentraler Zugangspunkt für Bauen, Kaufen und Casino-Wechsel.

Kein Hardcoding von spezifischen Floors/Toiletten — das System muss generisch funktionieren (Floors werden bald überarbeitet).

---

## Übersicht der Phasen (A–E)

| Phase | Inhalt | Nutzen |
|-------|--------|--------|
| **A** | **Grundlage: Charakter-Entität & Interaktionsradius** | Spieler hat steuerbare Spielfigur; alle Aktionen prüfen `isInRange()` vor Ausführung |
| **B** | **Werkzeuge & Objekte: Wischer, Flecke, Smartphone** | Putzen-Workflow, Getränke-Abholen, Bauen/Kaufen über Smartphone |
| **C** | **UI: Context-Radius-Menü (RadialMenu) als Standard** | Ein interaktionsfähiger Menüweg für alle Objekte; ersetzt BuildPanel, GuestPopup, MachinePopup |
| **D** | **Workflows: Putzen, Getränke, Kasse unter Stress** | Drei konkrete Spieler-Szenarien funktionieren end-to-end |
| **E** | **Casino-Wechsel & Save-Migration** | "Raus gehen" über Smartphone; Save v9 um neue Felder ergänzt |

---

## Phase A — Grundlage: Charakter-Entität & Interaktionsradius

### Ziel
Der Spielercharakter existiert als steuerbare Entität mit Position. Alle Interaktionen prüfen den Interaktionsradius vor Ausführung.

### Dateien (bei `2eecc42`)
- **NEU:** `src/core/sim/character.ts` — Charakter-Entität, Position, Bewegung, `isInRange()` Prüfung
- **NEU:** `src/core/sim/interaction.ts` — `INTERACTION_RADII`, `interactionRadiusFor()`, `isInRange()`
- **ÄNDERN:** `src/core/sim/types.ts` / `types-model.ts` — `WorldState.player` (bereits existiert als `Player` mit `position`, `carrying`, `rpg`, `job`, `path`), Ergänzung um `characterAction`
- **ÄNDERN:** `src/core/sim/tick.ts` — `tickWorld()` ruft bereits `processNarrativeRuntime` am Tick-Ende (NAR-12); Charakter-Bewegung hier einhaken
- **ÄNDERN:** `src/store/world-store.ts` — Commands für Charakter-Bewegung und Aktion

### Konformität AGENTS.md v0.3.87
- `src/core/sim/` headless (keine PixiJS/React/DOM-Importe)
- `world-store` bleibt einziger Owner von Welt/State
- Kein `Math.random`/`Date.now`/`new Date()` in `src/`

---

## Phase B — Werkzeuge & Objekte: Wischer, Flecke, Smartphone

### Ziel
Flecke haben individuelle Verschmutzungswerte. Wischer ist Werkzeug mit begrenzter Nutzung. Smartphone ist zentraler Zugangspunkt.

### Dateien (bei `2eecc42`)
- **NEU:** `src/core/sim/stain.ts` — `Stain` Typ, `removeStain()`, Verschmutzungswerte (Einfluss, Reichweite, Entfernungsdauer)
- **NEU:** `src/core/sim/mop.ts` — `Mop` Typ, `pickupMop()`, `dropMop()`, `consumeMopUse()` (5 Reinigungen pro Wischer)
- **NEU:** `src/core/sim/smartphone.ts` — `SmartphoneState`, Apps `BUILD`, `BUY`, `TRAVEL`, `CLEAN`, `SERVE`
- **ÄNDERN:** `src/core/sim/demand.ts` — bereits durch NAR-13 geändert; `demandBreakdown()` leitet aus Engine ab (nicht mehr anfassen)
- **ÄNDERN:** `src/store/world-store.ts` — Commands für Wischer-Aufheben, Fleck-Entfernen, Smartphone-App-Auswahl

### Konformität AGENTS.md v0.3.87
- Alle Geldbewegungen über `ledger.transfer` mit `TX_REASON` (kein `addVC` außerhalb von Booking)
- Geld = Integer Mikro-Einheiten (VaCoinMicro), keine Floats

---

## Phase C — UI: Context-Radius-Menü (RadialMenu) als Standard

### Ziel
Ein RadialMenu erscheint im Interaktionsradius um den Charakter/Objekt. Es ist der Standard-Weg für alle Interaktionen.

### Dateien (bei `2eecc42`)
- **NEU:** `src/render/radial-menu.ts` — PixiJS Container, `show()`, `hide()`, `onSelect()`
- **ÄNDERN:** `src/render/floor-view.ts` — `CharacterArt` rendern (statt nur `GuestArt`), `RadialMenu` Instanz, Interaktionsradius-Ring um Charakter
- **ÄNDERN:** `src/render/floor-cues.ts` — `setInteractionRadius(tiles)` zeichnet Ring um Charakterfüße (grün = in Reichweite, rot = außer Reichweite)
- **ÄNDERN:** `src/render/floor-touch.ts` — Rechtsklick/Langklick öffnet RadialMenu; Linksklick auf leere Fläche = `moveTo`
- **ÄNDERN:** `src/App.tsx` — `BuildPanel` Buttons werden durch Smartphone-App "BUILD" ersetzt; `radialMenuOpen` State

### Konformität AGENTS.md v0.3.87
- `src/render/` importiert aus `src/store` nur `import type { GameView }` (readonly, kein Laufzeitbezug)
- Renderer liest ausschließlich GameView-Snapshots

---

## Phase D — Workflows: Putzen, Getränke, Kasse unter Stress

### Ziel
Drei konkrete Spieler-Szenarien funktionieren end-to-end über Charakter + Interaktionsradius + RadialMenu.

### Workflow 1: Putzen
1. Charakter läuft zur Toilette (Radius 2 Tiles)
2. Wischer holen (RadialMenu bei Toilette: "Wischer holen")
3. Charakter trägt Wischer (`world.player.mopId` gesetzt)
4. Läuft zu Fleck 1 (Radius 1 Tile)
5. RadialMenu bei Fleck: "Reinigen" → `removeStain()`, `consumeMopUse()`
6. Wiederholt für Fleck 2, Fleck 3 (jeder Fleck mit eigenem Verschmutzungswert)

**Dateien:** `src/core/sim/stain.ts`, `src/core/sim/mop.ts`, `src/store/world-store.ts`, `src/render/radial-menu.ts`

### Workflow 2: Getränke aus dem Lager
1. User klickt sichtbares Getränk im Lager an
2. RadialMenu erscheint (Radius 3 Tiles): "Abholen", "Abbrechen"
3. User wählt "Abholen" → Charakter läuft zum Getränk
4. `takeDrinkCmd()` über `world-store` (Radius-Check vor Ausführung)

**Dateien:** `src/store/service-commands.ts` (`takeDrinkCmd` bereits vorhanden, Radius-Check ergänzen), `src/render/radial-menu.ts`

### Workflow 3: Kasse unter Stress
1. Charakter läuft zur Kasse (Radius 4 Tiles)
2. RadialMenu erscheint: "Schlichten", "Rauswerfen", "Konfrontation gewaltsam lösen", "Abbrechen"
3. User wählt Aktion → ausgeführt (`calmCmd`, Gast auf `LEAVE`, `fightBrawlCmd`)
4. `RadialMenu.hide()`, Narrative Fact `VISITOR_CONFLICT` oder `VISITOR_SERVICE` über `emitFact`

**Dateien:** `src/store/venue-commands.ts` (`calmCmd` Zeile 55–58, `fightBrawlCmd` Zeile 65–67), `src/core/sim/narrative/facts.ts`, `src/render/radial-menu.ts`

### Konformität AGENTS.md v0.3.87
- Texte sind Darstellung, nie Spielregel (RadialMenu-Labels nur UI)
- Zwei RNG-Namespaces: Gameplay für Charakter-Bewegung, Narrativ-RNG für Facts

---

## Phase E — Casino-Wechsel & Save-Migration

### Ziel
"Raus gehen" über Smartphone; andere Casinos besuchen. Save v9 um neue Felder ergänzt.

### Dateien (bei `2eecc42`)
- **NEU:** `src/core/sim/foreign-floor-commands.ts` (korrekter Pfad: `src/store/`) — `leaveOwnCasino()`, Casino-Auswahl
- **ÄNDERN:** `src/store/world-store.ts` — `leaveCasino()` Command
- **ÄNDERN:** `src/App.tsx` — Smartphone-App "TRAVEL": "Casino verlassen", fremde Casinos betreten
- **ÄNDERN:** `src/store/migrate.ts` — v9 Schema: `stains`, `mops`, `smartphone`, `characterAction` hinzufügen; v8→v9 Migration mit Default-Werten
- **ÄNDERN:** `src/store/save.ts` — Save-Format v9 mit neuen Feldern serialisieren

### Konformität AGENTS.md v0.3.87
- Save v9 aktiv, v5–v8 migrieren, v3/v4 verworfen
- Fail-Closed bei korrupten Saves
- PRNG-Zustand wird fortgeführt (kein Re-Seed)

---

## Abhängigkeiten & Migrationsreihenfolge (kritisch)

```
Phase A (Charakter + Radius)  →  Phase B (Wischer/Flecke/Smartphone)
         ↓                              ↓
Phase C (RadialMenu UI)       →  Phase D (Workflows)
         ↓                              ↓
Phase E (Casino-Wechsel + Save)
```

**Nicht vor Phase A beginnen:** Alle späteren Phasen hängen von `character.ts` und `interaction.ts` ab.

**Nicht `demand.ts` anfragen:** NAR-13 ist erledigt; `demandBreakdown()` leitet bereits aus der gemeinsamen Engine ab. `demand.ts` bleibt bis NAR-13 das bestehende Nachfragesystem (jetzt erledigt, nicht mehr anfassen).

---

## Risiken & Abhilfe

| Risiko | Betroffene Dateien | Abhilfe |
|--------|-------------------|---------|
| Bestehende Commands umgehen Radius-Check | `src/store/venue-commands.ts`, `src/store/service-commands.ts` | Jeder Command vor Ausführung `isInRange()` prüfen |
| Save v9 Inkompatibilität | `src/store/migrate.ts`, `src/store/save.ts` | Neue Felder mit Default-Werten für v8→v9 |
| Radial-Menü blockiert Floor-Input | `src/render/floor-view.ts`, `src/render/radial-menu.ts` | Menü-State in `App.tsx`; während Menü offen kein `moveTo` |
| Charakter-Sprite kollidiert mit Gäste-Rendering | `src/render/floor-view.ts`, `src/render/guest-art.ts` | `CharacterArt` als eigene Instanz |
| Zwei RNG-Namespaces vermischt | `src/core/rng/streams.ts`, `src/core/sim/narrative/runtime.ts` | Gameplay-RNG für Charakter, Narrativ-RNG für Facts |
| `Math.random`/`Date.now` in neuem Code | Alle neuen Dateien unter `src/` | ESLint-Regeln in `eslint.config.mjs` durchsetzen |
| Toter Import `./events/definitions` in `runtime.ts:5` | `src/core/sim/narrative/runtime.ts` | Prüfen und entfernen oder korrigieren |

---

## AGENTS.md v0.3.87 Konformitätsprüfung

| Konvention | Umsetzung |
|------------|-----------|
| `src/core/` headless | Alle neuen Dateien (`character.ts`, `interaction.ts`, `stain.ts`, `mop.ts`, `smartphone.ts`) reines TypeScript ohne PixiJS/React/DOM |
| world-store einziger Owner | Alle Mutationen über `world-store.ts` Commands; neue Module liefern reine Funktionen |
| Geld = Integer Mikro-Einheiten | Alle Kosten über `VaCoinMicro`, keine Floats |
| Zwei RNG-Namespaces | Gameplay-RNG für Charakter/Aktionen, Narrativ-RNG für Facts; nie vermischt |
| Kein `Math.random`/`Date.now`/`new Date()` in `src/` | Neue Dateien nutzen nur `world.tick`; ESLint blockt direkte Zugriffe |
| Save v9 | Neue Felder in `migrate.ts` mit Default-Werten |
| Kein `addVC` außerhalb von Booking | Alle Geldbewegungen über `ledger.transfer` mit `TX_REASON` |
| Keine Wegwerf-Skripte | Keine `tmp-`/`temp-`/`scratch-` Dateien |
| LOC Guard | Neue Dateien unter Budget (`character.ts` ~80, `interaction.ts` ~60, `stain.ts` ~70, `mop.ts` ~70, `smartphone.ts` ~50 Zeilen) |
| `@test-target` und `@error-code` | Neue Testdateien unter `src/core/sim/__tests__/` und `src/store/__tests__/` mit Headern |

---

## NAR-14 bis NAR-17 (noch offen)

| NAR | Status | Relevanz für diesen Plan |
|-----|--------|-------------------------|
| NAR-14 | Offen | UI-Anschluss für Narrative (Choice-Popups) — RadialMenu kann später erweitert werden |
| NAR-15 | Offen | Autonome Rivalen — Charakter-Steuerung ist Basis |
| NAR-16 | Offen | Soak — nicht betroffen |
| NAR-17 | Offen | Orchestrierung — nicht betroffen |

**Fazit:** Dieser Plan baut auf `2eecc42` auf. NAR-12 und NAR-13 sind bereits erledigt und dürfen nicht dupliziert werden. Der Fokus liegt auf Charakter-Entität, Interaktionsradius, RadialMenu, Smartphone und den drei Workflows (Putzen, Getränke, Kasse).