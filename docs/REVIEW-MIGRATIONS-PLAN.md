# Review-Report: Migrationsplan "Charakter-Steuerung mit Interaktionsradius"

**Repository:** Rigged by Design  
**Commit:** `4bb980f` (NAR-11: Lokaler Runtime Composer)  
**Branch:** `review-4bb980f`  
**Prüfdatum:** Tue Nov 03 2026  
**Prüfmodus:** Adversarialer Code-Reviewer — jede Behauptung zeilenweise gegen den echten Code verifiziert

---

## 1. Executive Summary

Der Migrationsplan enthält **mehrere erfundene oder falsche Referenzen**. Von den 21 Datei-Referenzen im Plan sind:

| Kategorie | Anzahl | Anteil |
|---|---|---|
| Korrekter Pfad, Datei existiert | 14 | ~67% |
| Falscher Pfad (behauptet `src/core/sim/`, wirklich `src/store/`) | 2 | ~10% |
| Korrekt als NEU markiert (Datei existiert nicht, muss erstellt werden) | 5 | ~24% |

Von den **behaupteten Typen, Konstanten und Funktionen** existieren nur `WorldState` und `world.player`. Alle anderen (`Mop`, `Stain`, `SmartphoneState`, `RadialAction`, `Character`, `CharacterArt`, `RadialMenu`, `interactionRadiusFor`, `isInRange`, `INTERACTION_RADII`, `world.stains`, `world.mops`, `world.smartphone`) **existieren nicht**.

Die Zeilenangabe `venue-commands.ts:104` für `cleanCmd` ist **zufällig korrekt**. Die Zeile `tick.ts:121` existiert (enthält `staffTick(...)`), aber der Plan belegt nicht, was dort stehen soll.

**Fazit:** Der Plan ist als Blaupause unbrauchbar. Er verwechselt `src/store/` mit `src/core/sim/`, erfindet Typen und Weltzustands-Felder, und geht von einer `interactionRadiusFor`-API aus, die es nicht gibt. Ein korrigierter Plan muss die NEU-Dateien wirklich erstellen und die existierenden Dateien an den echten Pfaden anpassen.

---

## 2. Detaillierte Validierungstabelle

Jede Zeile: Behauptung im Plan vs. Realität bei Commit `4bb980f`.

### 2.1 Datei-Referenzen

| # | Task im Plan | Behaupteter Dateipfad | Behauptete Zeile | Tatsächlicher Dateipfad | Tatsächliche Zeile | Funktion existiert? | Status |
|---|---|---|---|---|---|---|---|
| 1 | `cleanCmd` aufrufen/anpassen | `src/store/venue-commands.ts` | 104 (`cleanCmd`) | `src/store/venue-commands.ts` | 104: `export function cleanCmd(...)` | Ja | **OK** |
| 2 | Tick-Erweiterung (Dreck/Putz/Smartphone) | `src/core/sim/tick.ts` | 121 | `src/core/sim/tick.ts` | 138 Zeilen total; Zeile 121 = `staffTick(world, ledger, prng);` | Datei ja; Inhalt unklar | **TEILWEISE** (Zeile existiert, Belegung nicht verifizierbar) |
| 3 | Stain-Typ/Logik (NEU) | `src/core/sim/stain.ts` | (NEU) | — | — | Nein, Datei existiert nicht | **FEHLT** (muss neu erstellt werden) |
| 4 | Mop-Typ/Logik (NEU) | `src/core/sim/mop.ts` | (NEU) | — | — | Nein, Datei existiert nicht | **FEHLT** (muss neu erstellt werden) |
| 5 | Smartphone-State/Logik (NEU) | `src/core/sim/smartphone.ts` | (NEU) | — | — | Nein, Datei existiert nicht | **FEHLT** (muss neu erstellt werden) |
| 6 | Radial-Menü UI (NEU) | `src/render/radial-menu.ts` | (NEU) | — | — | Nein, Datei existiert nicht | **FEHLT** (muss neu erstellt werden) |
| 7 | Interaktions-Logik (NEU) | `src/core/sim/interaction.ts` | (NEU) | — | — | Nein, Datei existiert nicht | **FEHLT** (muss neu erstellt werden) |
| 8 | Store-Wiring, Commands registrieren | `src/store/world-store.ts` | (mehrere) | `src/store/world-store.ts` | 163 Zeilen; `clean()` Zeile 102, `moveTo()` Zeile 119, `moveStep()` Zeile 150 | Ja | **OK** |
| 9 | App-Wiring, UI-Einbindung | `src/App.tsx` | (mehrere) | `src/App.tsx` | existiert | Ja | **OK** |
| 10 | Floor-Rendering, Spieler-Marker | `src/render/floor-view.ts` | (mehrere) | `src/render/floor-view.ts` | 349 Zeilen; `#syncPlayer()` Zeile 211, `#player: GuestArt` Zeile 36 | Ja | **OK** |
| 11 | Touch/Gesten (Pan, Pinch, Wheel) | `src/render/floor-touch.ts` | (mehrere) | `src/render/floor-touch.ts` | 119 Zeilen | Ja | **OK** |
| 12 | Spieler-Figur rendern (behauptet `CharacterArt`) | `src/render/guest-art.ts` | (`CharacterArt`) | `src/render/guest-art.ts` | existiert; exports `GuestArt` + `createGuestArt` (Zeile 45) | `CharacterArt` **Nein**, `GuestArt` **Ja** | **FEHLT** (falscher Typenname; `GuestArt` existiert) |
| 13 | Bodenhinweise (Ring, Raster, Ping) | `src/render/floor-cues.ts` | (mehrere) | `src/render/floor-cues.ts` | 165 Zeilen | Ja | **OK** |
| 14 | Save-Migration v9 (neue Felder) | `src/store/migrate.ts` | (mehrere) | `src/store/migrate.ts` | `hydrateWorld()` Zeile 99, `SavedGame` Interface Zeile 31 | Ja | **OK** (Felder stains/mops/smartphone fehlen noch) |
| 15 | Save-Serialisierung (toSavedGame) | `src/store/save.ts` | (mehrere) | `src/store/save.ts` | `toSavedGame()` Zeile 22, `SAVE_VERSION = 9` Zeile 10 | Ja | **OK** (Felder stains/mops/smartphone fehlen noch) |
| 16 | Narrative Facts für Interaktion | `src/core/sim/narrative/facts.ts` | (mehrere) | `src/core/sim/narrative/facts.ts` | 40+ Zeilen; `emitFact()` Zeile 21 | Ja | **OK** |
| 17 | venue-commands (falscher Pfad im Plan) | `src/core/sim/venue-commands.ts` | — | `src/store/venue-commands.ts` | — | Datei existiert, aber am falschen Pfad | **FALSCH** (Pfad ist `src/store/`, nicht `src/core/sim/`) |
| 18 | service-commands | `src/store/service-commands.ts` | — | `src/store/service-commands.ts` | existiert; `takeDrinkCmd`, `serveDrinkCmd`, `moveToCmd`, `payCmd` | Ja | **OK** |
| 19 | deliveries | `src/core/sim/deliveries.ts` | — | `src/core/sim/deliveries.ts` | existiert | Ja | **OK** |
| 20 | actions | `src/core/sim/actions.ts` | — | `src/core/sim/actions.ts` | existiert | Ja | **OK** |
| 21 | foreign-floor-commands (falscher Pfad im Plan) | `src/core/sim/foreign-floor-commands.ts` | — | `src/store/foreign-floor-commands.ts` | — | Datei existiert, aber am falschen Pfad | **FALSCH** (Pfad ist `src/store/`, nicht `src/core/sim/`) |

### 2.2 Typen, Konstanten, Funktionen, Weltzustands-Felder

| # | Behaupteter Name | Behaupteter Ort | Tatsächlicher Status bei `4bb980f` | Status |
|---|---|---|---|---|
| A | `WorldState` | `src/core/sim/types.ts` | EXISTS: Interface `WorldState` Zeile 15 | **OK** |
| B | `world.player` | `WorldState` Feld | EXISTS: `player: Player` Zeile 21; `Player` in `types-model.ts:78` | **OK** |
| C | `world.stains` | `WorldState` Feld | **FEHLT**: Nicht in `WorldState` (types.ts:15–79) | **FEHLT** |
| D | `world.mops` | `WorldState` Feld | **FEHLT**: Nicht in `WorldState` | **FEHLT** |
| E | `world.smartphone` | `WorldState` Feld | **FEHLT**: Nicht in `WorldState` | **FEHLT** |
| F | `Mop` | Typ | **FEHLT**: Kein Treffer im Repo | **FEHLT** |
| G | `Stain` | Typ | **FEHLT**: Kein Treffer im Repo | **FEHLT** |
| H | `SmartphoneState` | Typ | **FEHLT**: Kein Treffer im Repo | **FEHLT** |
| I | `RadialAction` | Typ | **FEHLT**: Kein Treffer im Repo | **FEHLT** |
| J | `Character` | Typ | **FEHLT**: Kein Treffer im Repo | **FEHLT** |
| K | `CharacterArt` | Typ/Component | **FEHLT**: Existiert nicht; stattdessen `GuestArt` (`guest-art.ts:22`) | **FEHLT** |
| L | `RadialMenu` | Component | **FEHLT**: Kein Treffer im Repo; `radial-menu.ts` existiert nicht | **FEHLT** |
| M | `interactionRadiusFor` | Funktion | **FEHLT**: Kein Treffer (grep über ganz `src/`) | **FEHLT** |
| N | `isInRange` | Funktion | **FEHLT**: Kein Treffer | **FEHLT** |
| O | `INTERACTION_RADII` | Konstante | **FEHLT**: Kein Treffer | **FEHLT** |

### 2.3 Bilanz

- **Datei-Referenzen korrekt (existiert am behaupteten Pfad oder korrekt als NEU markiert):** 19 von 21
- **Datei-Referenzen falsch (Pfadverwechslung `core/sim` vs `store`):** 2 von 21 (Items 17, 21)
- **Typen/Konstanten/Funktionen korrekt:** 2 von 15 (Items A, B)
- **Typen/Konstanten/Funktionen FEHLT/erfunden:** 13 von 15
- **Weltzustands-Felder korrekt:** 1 von 4 (`player`)
- **Weltzustands-Felder FEHLT:** 3 von 4 (`stains`, `mops`, `smartphone`)

---

## 3. Fehlende Dateien / Funktionen (müssen wirklich neu erstellt werden)

Die folgenden Dateien existieren bei `4bb980f` **nicht** und müssen für das Feature "Charakter-Steuerung mit Interaktionsradius" neu angelegt werden:

| Pfad | Grund | Hinweis |
|---|---|---|
| `src/core/sim/stain.ts` | NEU — Stain-Typ + Dreck-Logik | Weltzustand hat aktuell `Furniture.dirt` (types-model.ts:44), aber keinen separaten Stain-Typ |
| `src/core/sim/mop.ts` | NEU — Mop-Typ + Putz-Logik | Kein Mop-Typ im Repo |
| `src/core/sim/smartphone.ts` | NEU — Smartphone-State + Logik | Kein Smartphone im Repo |
| `src/core/sim/interaction.ts` | NEU — `interactionRadiusFor`, `isInRange`, `INTERACTION_RADII` | Diese APIs existieren nirgends |
| `src/render/radial-menu.ts` | NEU — `RadialMenu` UI-Komponente | Existiert nicht |

### Typen, die in `src/core/sim/types-model.ts` ergänzt werden müssen

| Typ | Wo | Warum |
|---|---|---|
| `Stain` | `types-model.ts` | Fehlt komplett |
| `Mop` | `types-model.ts` | Fehlt komplett |
| `SmartphoneState` | `types-model.ts` | Fehlt komplett |
| `RadialAction` | `types-model.ts` oder `interaction.ts` | Fehlt komplett |
| `Character` (ggf. als Alias auf `Player`) | `types-model.ts` | Fehlt; `Player` existiert bereits (Zeile 78) |

### Weltzustands-Felder, die in `WorldState` (`types.ts:15`) ergänzt werden müssen

| Feld | Typ | Wo |
|---|---|---|
| `stains` | `Stain[]` | `WorldState` (neu) |
| `mops` | `Mop[]` | `WorldState` (neu) |
| `smartphone` | `SmartphoneState` | `WorldState` (neu) |

### Save-Migration (`src/store/migrate.ts` + `src/store/save.ts`)

- `SavedGame`-Interface (`migrate.ts:31`): Felder `stains`, `mops`, `smartphone` fehlen
- `toSavedGame()` (`save.ts:22`): muss die neuen Felder serialisieren
- `hydrateWorld()` (`migrate.ts:99`): muss die neuen Felder hydrieren

---

## 4. Korrigierter Migrationsplan

Trennung: **Existiert bereits** (anpassen) vs. **Muss neu erstellt werden**. Pfade und Zeilen basieren auf dem echten Code bei `4bb980f`.

### Phase A: Typen & Weltzustand (existiert bereits — anpassen)

| Schritt | Datei | Zeile (aktuell) | Änderung | Basis |
|---|---|---|---|---|
| A1 | `src/core/sim/types-model.ts` | 78 (`Player`) | `Stain`, `Mop`, `SmartphoneState`, `RadialAction` Interfaces hinzufügen | `Player` existiert (Zeile 78) |
| A2 | `src/core/sim/types.ts` | 15–79 (`WorldState`) | Felder `stains: Stain[]`, `mops: Mop[]`, `smartphone: SmartphoneState` hinzufügen | `WorldState` existiert (Zeile 15) |
| A3 | `src/store/migrate.ts` | 31 (`SavedGame`) | `stains?`, `mops?`, `smartphone?` zu `SavedGame` hinzufügen | `SavedGame` existiert (Zeile 31) |
| A4 | `src/store/migrate.ts` | 99 (`hydrateWorld`) | Hydration der neuen Felder ergänzen | `hydrateWorld` existiert (Zeile 99) |
| A5 | `src/store/save.ts` | 22 (`toSavedGame`) | Serialisierung der neuen Felder ergänzen | `toSavedGame` existiert (Zeile 22) |

### Phase B: Neue Sim-Dateien (müssen erstellt werden)

| Schritt | Datei | Inhalt | Status |
|---|---|---|---|
| B1 | `src/core/sim/stain.ts` | `Stain`-Typ, Stain-Erzeugung, Dreck-Verbreitung | **NEU erstellen** |
| B2 | `src/core/sim/mop.ts` | `Mop`-Typ, Putz-Action, Stain-Entfernung | **NEU erstellen** |
| B3 | `src/core/sim/smartphone.ts` | `SmartphoneState`, Smartphone-Logik | **NEU erstellen** |
| B4 | `src/core/sim/interaction.ts` | `interactionRadiusFor(role)`, `isInRange(posA, posB, radius)`, `INTERACTION_RADII` | **NEU erstellen** |
| B5 | `src/core/sim/tick.ts` | 138 (gesamt) | Stain/Mop/Smartphone-Tick in `tickWorld()` integrieren (nach Zeile 121 `staffTick`, vor Zeile 123 `tickForeignFloor`) | **Anpassen** |

### Phase C: Commands & Store (existiert bereits — anpassen)

| Schritt | Datei | Zeile (aktuell) | Änderung | Basis |
|---|---|---|---|---|
| C1 | `src/store/venue-commands.ts` | 104 (`cleanCmd`) | `cleanCmd` um Mop/Stain-Logik erweitern | `cleanCmd` existiert (Zeile 104) |
| C2 | `src/store/service-commands.ts` | — (`moveToCmd` etc.) | Interaktionsradius-Prüfung bei `moveToCmd`/`serveDrinkCmd`/`payCmd` | Datei existiert |
| C3 | `src/store/world-store.ts` | 102 (`clean()`), 119 (`moveTo()`), 150 (`moveStep()`) | Neue Commands für Smartphone/Mop registrieren | `world-store.ts` existiert (163 Zeilen) |

### Phase D: Render (existiert bereits / neu)

| Schritt | Datei | Zeile (aktuell) | Änderung | Basis |
|---|---|---|---|---|
| D1 | `src/render/floor-view.ts` | 36 (`#player: GuestArt`), 211 (`#syncPlayer`) | Spieler-Marker / Interaktionsradius-Anzeige | `GuestArt` existiert (Zeile 22 export in `guest-art.ts`) |
| D2 | `src/render/floor-touch.ts` | — | Tap im Interaktionsradius → Command | `FloorTouch` existiert (Zeile 6) |
| D3 | `src/render/floor-cues.ts` | — | Radius-Ring um Spieler anzeigen | `FloorCues` existiert (Zeile 15) |
| D4 | `src/render/radial-menu.ts` | (NEU) | `RadialMenu` Component | **NEU erstellen** |
| D5 | `src/render/guest-art.ts` | 22 (`GuestArt`) | Hinweis: `CharacterArt` existiert nicht — `GuestArt` verwenden | `GuestArt` existiert |

### Phase E: App & Narrative

| Schritt | Datei | Änderung | Basis |
|---|---|---|---|
| E1 | `src/App.tsx` | Radial-Menu / Smartphone-UI einbinden | `App.tsx` existiert |
| E2 | `src/core/sim/narrative/facts.ts` | Facts für Mop/Stain/Smartphone-Interaktionen | `emitFact()` existiert (Zeile 21) |

---

## 5. AGENTS.md-Konformitätsprüfung

| Konvention (AGENTS.md) | Status | Beleg / Bemerkung |
|---|---|---|
| `src/core/` headless (keine Browser-Deps) | **OK** | Neue Sim-Dateien (`stain.ts`, `mop.ts`, `smartphone.ts`, `interaction.ts`) gehören nach `src/core/sim/`, keine Pixi-Imports |
| Geld nur über Ledger/Booking, kein `addVC` außerhalb | **OK** zu beachten | Neue Commands müssen über Ledger buchen |
| RNG: `gameplay` vs `presentation` getrennt, kein `Math.random()`/`Date.now()` in `src/` | **OK** zu beachten | `performance.now()` nur erlaubt in `floor-view.ts`, `floor-props.ts`, `music.ts`; `interaction.ts` darf keinen RNG aus der Uhr ziehen |
| Ein Owner pro State: `world-store` hält Welt/Ledger/PRNG | **OK** | `world-store.ts` ist der einzige Store |
| Save-Format v9; v5–v8 migrieren | **OK** | `migrate.ts` hydriert v5–v8, `save.ts` schreibt v9 (`SAVE_VERSION = 9`) |
| Keine Wegwerf-Skripte / keine `tmp-` Dateien | **OK** | Review erzeugt keine Ad-hoc-Dateien (außer diesem Bericht, der im Repo-Root als Review-Artefakt abgelegt werden kann) |
| Tree-Gate: Tests nur in `__tests__` | **OK** | Keine neuen Testdateien im Plan, aber ggf. nötig unter `src/core/sim/__tests__/` |
| Core ohne Browser-Importe und ohne Importe nach außen | **OK** | `src/core/sim/` darf nicht nach `src/render/` importieren |
| LOC Guard: kein `// @loc-exception:` für neue Dateien | **OK** zu beachten | Neue Dateien müssen unter dem Budget bleiben |
| `error-codes.ts` für neue Fehlercodes | **OK** zu beachten | Neue Fehlercodes in `src/core/governance/error-codes.ts` |
| Doku: sechs Pflichtdokumente mit `rbd-doc`-Marker aktualisieren | **OFFEN** | Nach jeder Änderung: `docs/INVENTORY.md`, `CHANGELOG.md`, `DEVTAGEBUCH.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md` via `docs:sync` |

**Konformitäts-Fazit:** Der Plan verstößt nicht gegen AGENTS.md, solange die neuen Dateien an den korrekten Pfaden (`src/core/sim/` für Sim-Logik, `src/store/` für Commands/Store, `src/render/` für UI) angelegt werden und die oben genannten Konventionen (headless Core, Ledger-only Geld, getrennte RNG-Namespaces, Save v9) eingehalten werden. Die Pfadverwechslungen im ursprünglichen Plan (`src/core/sim/venue-commands.ts` statt `src/store/venue-commands.ts`) wären dagegen ein Tree-Gate-Fehler (`verify:tree`).

---

## 6. Verifizierungsbefehle (zur Nachprüfung)

Alle Befehle im Repo-Root bei Commit `4bb980f`:

```bash
# Dateien existieren?
ls src/store/venue-commands.ts src/store/foreign-floor-commands.ts src/store/service-commands.ts
ls src/core/sim/tick.ts src/core/sim/player.ts src/core/sim/types.ts src/core/sim/types-model.ts
ls src/render/floor-view.ts src/render/floor-touch.ts src/render/floor-cues.ts src/render/guest-art.ts src/App.tsx

# Fehlende Dateien bestätigen (sollte nichts finden):
ls src/core/sim/stain.ts src/core/sim/mop.ts src/core/sim/smartphone.ts src/core/sim/interaction.ts src/render/radial-menu.ts  # existiert nicht

# cleanCmd Zeile 104:
rg "export function cleanCmd" src/store/venue-commands.ts

# WorldState Felder:
rg "stains|mops|smartphone" src/core/sim/types.ts  # keine Treffer

# interactionRadiusFor etc. (sollte keine Treffer liefern):
rg "interactionRadiusFor|isInRange|INTERACTION_RADII|RadialMenu|CharacterArt" src/  # keine Treffer
```

> Alle obigen Aussagen basieren ausschließlich auf dem Dateiinhalt bei Commit `4bb980f` (Branch `review-4bb980f`). Keine Annahmen über nicht existierenden Code wurden getroffen.
