# Render- und Living-World-Rework — Task-Phasen

**Zweck:** Dieser Plan ist die ausführbare Todo hinter der Render- und
Living-World-Roadmap. Er beschreibt Reihenfolge, Abhängigkeiten, Dateien, Tests
und Abnahmekriterien. Die Produktplanung bleibt in [`ROADMAP.md`](ROADMAP.md);
die Architekturgrenzen stehen in [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Stand:** 2026-11-12 · Baum `0.3.242` · Audit-Basis `0.3.231`

**Status:** Umsetzung begonnen (Lane `lane/render/r1-r12-rework`). Die Kästchen
werden nur mit Beleg abgehakt; ein grüner Teilcheck ist kein grüner
Phasenabschluss. Die Meilensteine M0–M4 (Abschnitt 6) und die Sichtabnahme
(Abschnitt 8) sind verbindlich.

### Umsetzungsstand 2026-11-12

Belegt sind die deterministischen Verträge und die lokalen Gates; **nicht**
belegt ist die Pixi-Sichtabnahme. Der Cloud-Browser hängt in dieser VM auch
mit dem unveränderten Basisstand `fccc787` (kein Screenshot, keine
Accessibility-Abfrage); das ist eine Umgebungsgrenze, kein grüner Bildbeleg.

Der headless Gegenbeleg ist dagegen reproduzierbar: [`living-world-longturn-424242-4d.json`](evidence/living-world-longturn-424242-4d.json)
hält Seed `424242`, 4 Sim-Tage, 2400 Ticks und 288 Entscheidungen fest, samt
Vorher/Nachher-Werten für Hunger, Durst, Routinen, Traits, Attribute und
Fähigkeiten sowie fünf aufeinanderfolgenden Ereignisketten (GEBEN → Traits →
`CITY_ENCOUNTER_ARC` → Echo, Dreck → Laune, Hunger → Ruf → Mahlzeit, Mahlzeit →
Erinnerung → anderes Verhalten, Stadt-Routine über vier Tage). Der Lauf ist kein Sichtbeleg und ersetzt die
Pixi-Abnahme nicht:

```bash
RBD_LIVING_WORLD_EVIDENCE_OUT=docs/evidence/living-world-longturn-424242-4d.json \
  npx pnpm exec vitest run src/core/sim/__tests__/living-world-longturn.test.ts
```

| Phase | Beleg | Stand |
| --- | --- | --- |
| R1 | `src/render/visual/scene-frame.ts` + `scene-frame.test.ts`: vier Szenen, drei byte-identische Läufe, Hashänderung bei echter Bildänderung | Teilbeleg; Browser-Screenshot fehlt |
| R2 | `decor-roles.ts` + `decor-roles.test.ts`: stabile Rollen, exakte Labels, unaufgelöste Fläche statt Regex/`0x2dd4a0` | Code-/Testbeleg |
| R3 | `actor-silhouette.ts` + Test: 12×16-Silhouette, fünf Personafamilien; Pin-Skalierung gegen die Kamera entfernt | Code-/Testbeleg |
| R4 | sechs echte Boden-SVGs im Manifest, `floorTextureKey` testet Vorhandensein; `CarpetOverlay` entfernt, Teppichwahl tintet das Material | Code-/Testbeleg |
| R5 | `light-pool.ts` + Test: 16 Slots, eine Radialtextur, BlendMode am Lichtkind; `drawLightSpill`-Ellipsenschleife entfernt | Code-/Testbeleg |
| R6 | `floor-camera-bounds.test.ts`: 60×60 vs. 30×10, Fit/Fill getrennt, LOD-Hysterese; zwei Parallax-Ebenen in `stage-backdrop.ts` | Code-/Testbeleg; Q2-Projektion noch nicht sichtbar geprüft |
| R10 | `src/core/sim/__tests__/apartment-render.test.ts`: fünf Bereiche, neun Rollen, warme Texturen, Haustürvertrag | Vertragstest **und** Browserbild `24-r10-wohnung.png`; S2-09–S2-11 bleiben offen |
| R11 | `locomotion.ts` + Test und `floor-animate.ts`: vier Frames, zwei Richtungen, Stillstand; Richtung spiegelt nur die Figur | Code-/Testbeleg |
| R7–R9 | `city-exterior`/`city-scene` bleiben die eine Stadtwahrheit; S2-12 ist weiterhin die offene Roadmap-Aufgabe | **R7 teilweise belegt** (Exterieur im Produktionspfad **und** Browserbild `21-r7-stadt.png`); **R8 FAIL** (Welt-/Skalierungs-/Rechtefelder fehlen), **R9 teilweise** (Bewohner haben jetzt Kachel, Weg und Ankunft; der Renderer `city-actors.ts` fehlt noch); keine zweite Stadt erfunden |
| R12 | `ambient-plan.ts`/`ambient-layer.ts`: Helligkeit, Sichtradius und Schatten je Tageszeit und Szene, mit 24-Tick-Übergang an den Drittelgrenzen; Wetter fehlt | Teilbeleg; Tageszeit-Ambient, Straßenband, reduced-motion und Übergang im Browser gemessen; Wetter offen |

Lokale Gates auf diesem Stand: `verify:light` PASS, `ci:local` PASS,
`verify:assets` PASS, `verify:tree` PASS, `verify:dead-code` PASS,
`verify:test-quality` PASS, `verify:test-placement` PASS. Die Checkboxen in
R1–R12 bleiben unverändert offen, bis Screenshot, Konsole und Probe nach
Abschnitt 8 vorliegen.

### Stadtleben-Slice 2026-11-12 (R9-Teilbeleg)

Die vorhandenen headless Bedürfnisse und Tagespläne haben jetzt einen
Produktionsleser. `tickWorld` ruft `tickCityLife` auf; Rita, Boris und Mira
bewegen sich stündlich zwischen Wohnung, Kiez und Markt, und Hunger, Durst,
Müdigkeit, Sozialbedarf und Laune werden über Tagesgrenzen sowie Save/Load
getragen. `cityView` liefert die Bewohner mit Standort, Intent, Stats und
Traits an das Stadtfenster; `normalizeCityLife` migriert alte Saves ohne
Stadtleben. Die Traits/Beziehungen kommen weiter aus dem bestehenden
Begegnungsloop, nicht aus einem zweiten Modell.

| Beleg | Datei/Test |
| --- | --- |
| Tagesroutine und sichtbare Stats | `city-life.ts`, `city-popup.tsx`, `city-life.test.ts`: Schichten 16–24 (Rita), 7–20 (Boris), 9–17 (Mira); 09:00 WORK/MARKT, 19:00 PUB/KIEZ bei Mira, 23:00 SLEEP/HOME bei Boris; alle Werte 0..100 |
| Durst als echter Bedürfnis-Override | `npc-needs.ts` (`thirst`, `THIRST_THRESHOLD_URGENT`), `npc-schedule.test.ts`, `city-life.test.ts` |
| Persistenz | `save.ts`/`migrate.ts`, `city-life.test.ts` mit Save/Load-Roundtrip |
| Ereigniskette | `living-world-longturn.test.ts`: GEBEN -> Traits -> `CITY_ENCOUNTER_ARC` -> Warm-Echo nach 24 Ticks |
| Umgebung | derselbe Long-Turn: Gast verliert auf Dreck Laune und gewinnt auf sauberem Boden |
| Alle sieben Spielerstufen | derselbe Long-Turn: Speed, Charisma, Brawl, Wahrnehmung, Technik, Ausdauer, Glück mit ihren vorhandenen Lesern |
| Fähigkeiten/Erfahrung | derselbe Long-Turn: `JOB_CLEANER`-XP erhöht Speed, Wahrnehmung und Ausdauer |
| Glück | `player-jobs.test.ts`: Stufe 10 halbiert das Mechaniker-Unfallrisiko |

Grenzen: Das Stadtleben modelliert die drei benannten NPCs; der Spieler
läuft seit dem folgenden Slice im selben Tick mit. Die 2:1-Isometrie und der
Browser-Screenshot bleiben die bereits dokumentierten offenen Punkte; der
Long-Turn ist ein deterministischer Headless-Beleg, kein Sichtbeleg.

### Kausalitäts-Slice 2026-11-12 (Living-World-Beleg)

Der Stadtleben-Slice ist jetzt kausal belegt, nicht nur beschrieben. Ein
headless Langlauf startet `createWorld('SMALL')`, setzt den Stadt-Seed und
lässt `tickWorld` über fünf Sim-Tage laufen. Pro Entscheidung vergleicht
`city-life-decision.ts` zwölf Gegenfakt-Proben mit demselben Score: eine Probe
neutralisiert genau eine Familie; `changed: true` steht nur dann im Trace,
wenn dadurch ein anderer Intent gewinnt. Der Lauf ist der Vitest-Test
`living-world-causal-trace.test.ts`; das Artefakt ist
`artifacts/living-world/trace-424242-5d.json`.

**Abschlussstatus:** `DONE` · PR #486 · Kopf `801e39f9d7a99bdae24e8e795c9f9df53cb25e89` · Merge-Commit `e33e5ef65c0657090d2185774d40b895ec7166ca`.

#### Beweisstand

| Beleg | Ergebnis |
| --- | --- |
| Lauf | Seed `424242`, 5 Sim-Tage, 363 Entscheidungen, drei NPCs |
| Artefakt | `artifacts/living-world/trace-424242-5d.json` (363 Entscheidungen, Familien-Zähler, Kette) |
| Familien mit gekippter Entscheidung | Hunger 28, Durst 1, Müdigkeit 54, Routine 237, Traits 43, Attribute 19, Fähigkeiten 63, Emotion 2, Beziehung 44, Erinnerung 34, Sozialbedarf 3, Umgebung 69 |
| Kette | Rita: `EAT_OUT` 1/12 (Geld −800, Hunger runter, Laune +5) → soziale Erinnerung 13 am 1/22 → `VISIT_FRIEND` 2/16; ohne Erinnerung würde sie `WORK` wählen |
| Plan vs. Abweichung | `COMMUTE` und `EAT_OUT` liegen im Trace; `scheduledIntent !== intent` belegt Abweichungen vom Tagesplan |
| Determinismus | derselbe Seed erzeugt dieselbe 2-Tage-Sequenz; Seed `424243` erzeugt eine andere Sequenz |
| Persistenz | Save/Load nach einem Tag erhält Attribute, Fähigkeiten, Beziehungen und Erinnerungen |

Der Test schreibt den Trace nur mit `RBD_LIVING_WORLD_OUT`:

```bash
RBD_LIVING_WORLD_OUT=artifacts/living-world/trace-424242-5d.json \
  npx pnpm exec vitest run src/core/sim/__tests__/living-world-causal-trace.test.ts
```

#### Bewusst offen / dünn belegt

Durst (1), Sozialbedarf (3) und Emotion/Laune (2) kippen nur wenige
Entscheidungen; sie sind belegt, aber dünn. Das Modell hat keine separaten
Emotionszustände, sondern Laune plus Sozialbedarf. Die Gegenfakt-Proben
neutralisieren je Familie einen Input; sie beweisen keinen vollständigen
Mechanismus, sondern den konkreten Einfluss im Lauf. Das Stadtfenster zeigt
weiterhin nur die vorhandenen Stats; der Trace ist der Nachweis, kein neuer
UI-Pfad. Die Baseline-Gates auf `main` (`ci-gates.test.ts`: fünf statt drei
Workflow-Dateien; `workflow-hardening.test.ts`: vier unpinned Actions)
bleiben unverändert und wurden nicht repariert.

### Spielerbedürfnisse-Slice 2026-11-12

Hunger und Durst sind jetzt echter Spielzustand, kein Anzeigefeld. Der
kanonische Tick hebt beide Werte langsam; Mahlzeit und Getränk an Kochnische,
Kühlschrank oder im Kiez senken sie wieder. Derselbe Zustand liest der
Stadtruf und die Job-Schicht: hungrige Spieler bekommen weniger Ruf, weniger
Job-XP und ein höheres Unfallrisiko. Alte Saves ohne `player.needs` werden
normalisiert, neue Saves tragen den Wert über Tagesgrenzen.

| Beleg | Datei/Test |
| --- | --- |
| Tick und Schwellen | `player-needs.ts`, `player-needs-tick.ts`, `tick.ts`; `player-needs.test.ts`: 18/22 -> 54/70 nach zwei Tagen, 90/100 nach vier Tagen |
| Essen/Trinken | `player-needs.ts`, `city-actions.ts`, `floor-actions.ts`; `player-needs.test.ts`: Heim-Mahlzeit 82/78 -> 37/68, Getränk -> 32/13; Kiez-Mahlzeit und -Getränk senken beide Werte |
| Save/Load | `migrate.ts`, `save.ts`; `player-needs.test.ts` mit Roundtrip nach vier Tagen |
| Verhaltenswirkung Stadt | `city-actions.ts`; `player-needs.test.ts`: derselbe Kiez-Besuch gibt 0.4 Ruf satt, 0.2 Ruf mit Hunger/Durst |
| Verhaltenswirkung Job | `player-jobs.ts`; `player-needs.test.ts`: hungrige Mechaniker-Schicht 12 XP und Verletzung, satte Schicht 20 XP ohne Verletzung bei demselben PRNG-Wert 0.12 |
| Ereigniskette | `living-world-longturn.test.ts`: vier Tage, Rita-Trait-Änderung, `CITY_ENCOUNTER_ARC`, Gast-Laune auf Dreck, Spielerstufen, dann Hunger/Durst -> Stadtruf 0.2 -> Mahlzeit/Getränk -> 0.4 |
| Attribute/Fähigkeiten | `player-rpg.ts`: `HOME_MEAL`, `HOME_DRINK`, `KIEZ_MEAL`, `KIEZ_DRINK` trainieren Ausdauer, Wahrnehmung und Charisma; derselbe Long-Turn prüft alle sieben Stufen und `JOB_CLEANER`-XP |

**Accepted, nicht erledigt:** Die 2:1-Isometrie bleibt top-down mit
`WORLD_FLATTEN`; die Stadt-Wandrolle bleibt die gemeinsame
Occlusion-Rolle der Innenräume, ohne zweiten Wand- oder Kollisionspfad. Beide
Punkte sind bewusst zurückgestellt und keine Voraussetzung für diesen Slice.

### Fremd-Floor-Parität 2026-11-12 (P0-Slice)

Der fremde Floor war ein Menü: Layout, Möbel und Spielerstand lagen bereits
im `ForeignFloorState`, aber Navigation, Bewegung, Tick, Kamera und Touch
lasen weiter den eigenen Casino-Stand. Der Slice beendet diese Sonderwelt.
Eigentumsrechte bleiben Aktionsrechte; sie sind keine Bewegungsrechte.

| Beleg | Datei/Test |
| --- | --- |
| Ein Spielerstand je Szene | `active-player.ts`, `world.ts`, `player.ts`, `interaction.ts`, `tick.ts`; `foreign-walkable.test.ts` bewegt den foreign Spieler, während `world.player.position` unverändert bleibt |
| Kollision und Navigation | `worldNav` liest `foreign.layout` und `foreign.furniture`; `visitForeignCmd` normalisiert den Startpunkt auf eine begehbare Kachel |
| Maus/Touch | `floor-scenes.ts`: FOREIGN erlaubt Boden-Taps; `MOVE_HERE` läuft über `action-queue-run.ts` und `foreign-walkable.test.ts` bis zum Ziel |
| Tastatur und Kamera | `use-stage-keys.ts`, `stage-controls.tsx`, `floor-view.ts`: WASD, Zoom, FIT und Kamera-Knöpfe sind auf FOREIGN freigegeben; `input-parity.test.tsx` prüft beide Wege |
| Snapshot | `snapshot.ts` nimmt die foreign-eigene Layoutgröße und den foreign Spielerpfad; `foreign-walkable.test.ts` prüft Größe, Position und `pathIndex` |
| Save/Load | `foreign-walkable.test.ts`: Szene, Floor-ID und Position überleben den Roundtrip |
| Szenenwechsel | `use-floor-selection-lifecycle.ts`: ein Szenenwechsel räumt den alten Fokus, bevor der neue Floor ihn erben kann |

**Accepted, nicht erledigt:** Fremde Möbel und Gäste bleiben vorerst
nicht-interaktiv; `floorTapAllowed('FOREIGN', …)` öffnet nur den Boden, und E
bleibt auf diesem Floor still. Das ist Absicht, solange die fremden
Maschinen-, Gast- und Job-Commands noch auf eigenen Casino-Objekten arbeiten
würden. Der nächste Slice muss diese Commands auf den foreign Floor zeigen,
bevor deren Tap-Ziele freigegeben werden. Die foreign Floor-Gäste sind
derzeit leer; NPC-Kollision und soziale Blockadereaktion bleiben eigene P0-
Slices.

### Ambient-Slice 2026-11-12 (R5/R6/R12-Teilbeleg)

Der Slice ergänzt die bestehende Tageszeit um eine reine Darstellungsableitung.
Der Spielzustand wächst nicht: kein neues Save-Feld, kein zweiter Ticker, kein
RNG und keine Uhr in den neuen Pfaden.

| Baustein | Beleg | Grenze |
| --- | --- | --- |
| Ambient-Plan | `src/render/ambient-plan.ts` + `ambient-plan.test.ts`: Helligkeit, Sichtradius, Sonnenrichtung und Schatten aus `dayPhase` und `SceneKind`; eingefroren, gecacht | Kein Wetter |
| Ambient-Schicht | `src/render/ambient-layer.ts`: ein weltverankerter Schleier, drei gebackene Strahlen, ein Sichtradius an der Figur nur nachts; Innenraum und Abend ohne Radius; spät geladene Lichttextur wird nachgezogen (`ambient-late-texture.test.ts`) | Pixi-App im Cloud-Browser blockiert vor dem ersten Frame; echte Pixelprobe statt App-Screenshot |
| Schattenwurf | `city-exterior-layer.ts`: weiche Fußschatten aus der vorhandenen Radialtextur, richtungsabhängig je Phase, ohne Rebuild; fehlende Textur wird nachgeladen (`city-shadow-late-texture.test.ts`) | Keine harten Schattenkanten |
| Kamera | `floor-camera.ts`: toter Winkel 0.82, Snap auf das Gerätepixelraster; der Zoom bleibt der einzige Fahrweg | 2:1-Isometrie bleibt offen |
| Performance | `city-plan.ts`/`snapshot.ts`: Renderplan und Exterieur-Ansicht je Identität genau einmal; `CityExteriorLayer` rebuildet nur bei echter Änderung | — |
| Simulation | `city-exterior.ts`: Grundrisskanten als Wände, genau eine offene Tür je Gebäude; Requisiten belegen ihren Footprint im Nav (Bank 2×1); `city-exterior-walls.test.ts` und `city-props-solid.test.ts` belegen Kollision, Schwelle und Requisiten | — |

#### Browser-Nachweis 2026-11-12

Die Pixi-App bleibt im Cloud-Browser auf `RIGGED BY DESIGN — STARTET…` stehen:
Snapshot, Screenshot und `evaluate` laufen in den Timeout, die Konsole zeigt
keinen JS-Fehler, und auch der Produktionsbuild verhält sich gleich. Der
Fallback ist deshalb eine deterministische, temporäre Plan-Probe: Sie zeichnete
dieselbe Stadtgeometrie und dieselben Formeln aus
`ambient-plan.ts`/`ambient-layer.ts` auf Canvas und protokollierte Luminanz und
Planwerte. Die neue Pixelprobe rendert dagegen die echten Klassen über einen
Pixi-CanvasRenderer und liest die Pixel aus dem Canvas: Nacht zeigt den
Sichtradius (7,5 Tiles, 183,64 vs. 154,15), Morgen und Abend zeigen Strahlen
und Schatten ohne Radius; die Konsole bleibt fehlerfrei.

Dabei fielen zwei echte Spätlade-Fehler auf, die den Sichtradius und die
Stadtschatten im normalen Start dauerhaft unsichtbar ließen: `light-pool.svg`
liegt nicht im Atlas und wird erst nach dem ersten Frame geladen. `AmbientLayer`
cachte den Plan vor dem Texturladen und kehrte bei jedem weiteren Snapshot
früh zurück; `CityExteriorLayer` baute Schatten nur beim ersten Plan und
versuchte sie bei fehlender Radialtextur nie erneut. Beide Pfade ziehen die
Darstellung jetzt nach; die Regressionstests belegen den zweiten Versuch.

Die isometrische 2:1-Projektion aus Abschnitt 2.3 ist **nicht** umgesetzt: Sie
verlangt eine eigene Projektion für Boden, Figuren, Treffer und Tiefe und damit
einen eigenen Slice auf R6/R7. Die Kamera bleibt top-down mit
`WORLD_FLATTEN`; ein nachträgliches Kippen ohne diese Projektion würde Treffer
und Simulation auseinanderziehen.

### Browser-Sichtabnahme 2026-11-12 (lokal, Agent)

**Umgebung:** lokaler Vite-Dev-Server (`http://localhost:3000`), lokaler
Chromium des Desktops, Viewport 1024×768, frischer Spielstand (localStorage
geleert, Eröffnung → Wohnung → Straße → Casino), `window.__rbdProbe` aktiv.
Kein Cloud-Runner, kein Screenshot-Gate.

**Korrektur der Cloud-Diagnose:** Der frühere Befund „Pixi hängt vor dem ersten
Frame“ ist eine **Sichtbarkeitsgrenze**, kein Renderfehler. Im verdeckten Tab
meldet der Browser `document.visibilityState: hidden`; damit ruht
`requestAnimationFrame`, `onFirstFrame` feuert nie und der Loader bleibt bei
`STARTET…`. Im sichtbaren Tab rendert dieselbe Seite mit 60,24 fps
(`getRenderInfo`), inklusive Kamera, Licht, Ambient und Figuren. Der Beleg ist
damit lokal reproduzierbar; die Cloud-Aussage bleibt als Umgebungsgrenze
stehen.

| Phase | Ergebnis | Beleg | Befund |
| --- | --- | --- | --- |
| R2 | PASS | `28-r2-platzhalter.png`, `29-r2-platzhalter-detail.png` | Unbekanntes `DECOR` („Röntgengerät") im Spielstand bleibt sichtbar unaufgelöst: Warnrahmen, Schraffur, Fragezeichen, Label — keine geratene Textur. Der Spielstand nimmt das Möbel an; die frühere Annahme „nicht erzeugbar" war falsch |
| R3 | PASS (Teil) | `18-r4-materialien.png` (Casino, Gäste mit Sprechblasen), `20-r6-kamera.png` (FIT, kleine Figuren) | Figuren sind als Person erkennbar, kein 6×6-Pin im Bild; ein erzwungener LOD-Wechsel fehlt (FIT ist die kleinste Stufe) |
| R4 | PASS | `18-r4-materialien.png` | Sechs Materialien unterscheidbar (Teppich, Holz, Fliese, Stein, Linoleum, Beton); genau ein Bodenknoten je Chunk |
| R5 | PASS (Teil) | `18-r4-materialien.png` | Weiche Lichtfläche über dem Automaten und sichtbare Leuchten, keine Ellipsenschleife im Bild; die 16 Quellen sind nur im Test belegt |
| R6 | PASS (Teil) | `20-r6-kamera.png` | Weltkante und Parallaxe sichtbar; FIT ist die kleinste Stufe, ein LOD-Wechsel an der Schwelle wurde nicht erzwungen |
| R7 | PASS (Teil) | `21-r7-stadt.png` | Straßenraum, vier Fassaden und Türen sichtbar; Eintritt über die Wohnungstür, kein Teleport. Der Klick auf die Casino-Tür wurde im Browser nicht durchgeführt (nur Testbeleg) |
| R8 | FAIL | `asset-semantics.json` (539 Einträge) | Alle Assets tragen `role`, aber keins `world`, `displayScale` oder `license`; `src/render/city/city-assets.ts` fehlt. Der Test prüft einen anderen Pflichtfeldsatz als der Plan |
| R9 | teilweise | `30-r9-stadtbewohner.png` | Rita, Boris und Mira leben im echten Tick, haben jetzt Kachel, A*-Weg, Ankunftszeit und Zwischenstand (`city-life-movement.ts`); `city-actors.ts` fehlt noch, also zeichnet sie niemand auf der Straße |
| R10 | PASS (Teil) | `24-r10-wohnung.png` | Vier Bereiche (Schlafen, Kochen, Bad, Wohnen) mit warmer Palette, ohne Neon und Automat; S2-09–S2-11 bleiben als Roadmap-Zeilen offen |
| R11 | PASS (Teil) | `18-r4-materialien.png` | Figuren bewegen sich sichtbar (Sprechblasen und Positionen ändern sich); ein Richtungswechsel ist im Standbild nicht belegbar, der Frame kommt aus Tick und Phase |
| R12 | PASS (Teil) | `21-r7-stadt.png` (Tag), `25-r12-strassenlicht.png` (Tag), `26-r12-nacht.png`, `31-r12-abend-stadt.png`, `32-r12-nacht-uebergang.png` | Tageszeit-Ambient wirkt; Strahlen nur über dem Straßenband (`getLocalBounds` 950×338). Der Wechsel Tag→Nacht→Tag ist im laufenden Spiel gemessen (409 Proben, Ticks 1528–1842): Schleier 0.20 → 0.42 → aus, Strahlen 0.10 → leer → 0.16, Radius aus → 390×332 `@0.22` → aus. Der Wechsel war damals ein Schnitt am Tagesdrittel und ist seit dem 13.11. ein 24-Tick-Übergang (`ambientPlanAt`, Browser-Messung im Abschnitt „Übergang statt Drittel-Sprung"). `prefers-reduced-motion` umgesetzt. Wetter fehlt |

**Konsole:** keine JS-Fehler, keine fehlgeschlagenen Requests. Wiederholt
meldet PixiJS `[Assets] Asset id … was not found in the Cache` für die
Boden- und Lichttexturen, bevor das Lazy-Paket sie nachlädt (danach 200). Das
ist Rauschen, kein Fehler, und bleibt offen.

**In dieser Abnahme behoben**

1. **Chunk-Überlauf der Raumdarstellung.** Zonen-Overlays, Weltkante und
   Musterfugen wurden ungeschnitten in die 30×30-Chunk-Caches gezeichnet; in der
   60×60-Stadt wuchs die Textur des ersten Chunks auf 1568 px (Chunk: 780 px)
   und wurde verschoben gerendert. `room-art.ts`, `room-dressing.ts`,
   `floor-surface.ts` und `floor-material.ts` schneiden jetzt auf den Chunk;
   `room-chunk-clip.test.ts` misst die gezeichneten Rechtecke. Im Browser
   betragen alle vier Chunks danach exakt 780×782 px.
2. **Kein Rückweg aus dem eigenen Casino.** Die eigene Haustür trägt die ID
   `door-<zone>`; `cityDoorEffect` kannte sie nicht, und die Szenenleiste
   verschwindet nach dem Onboarding. Der Spieler saß im eigenen Haus fest.
   `SceneCommands.enterStreetDoor` führt die eigene Tür jetzt auf die Straße und
   setzt den Austritt an die Grand-Schwelle (22,23) statt an den
   Wohnungseingang; `own-door-to-city.test.ts` belegt beide Wege.

**Nachtfall (R12), Messung im Browser:** Tick 2250 (Tagesabschnitt 450 von 600
→ Nacht), Szene `CITY`, Spieler bei (8,13). Gemessen an den drei Graphics des
Ambient-Layers: Strahlen `visible:false` mit leerer Geometrie, Schleier
`visible:true` über 1560×1560 Weltpixeln, Sichtradius `visible:true` mit echter
256×256-Textur am Spieler (statt der 1×1-Platzhalterkante). Das Bild zeigt die
abgedunkelte Straße ohne Strahlen und den Lichtkreis um die Figur.

**Aufbau des Nachtfalls:** Der Tick steckt im Spielstand (`vcoin.casino.v11`).
Ein Testfixture setzt ihn auf `floor(tick/600)*600 + 450` und lädt neu; die
Ticks sind im verdeckten Tab pausiert (`visibilityState: hidden`), deshalb
bleibt die Nacht für die Aufnahme stehen. Kein Cheat im Spielcode, keine
Wartezeit von vier Minuten, kein Eingriff in die Simulation.

**Nachgezogen (R12):** `streetBand(zones, bounds, tile)` leitet das Straßenband als
Bounding-Box der Außen-Zonen ab und fällt ohne Zonen auf die Weltkante zurück;
`AmbientLayer` zeichnet die drei Strahlen nur noch darin. `motion-preference.ts`
liest `prefers-reduced-motion` (lazy, mit `change`-Listener); bei reduzierter
Bewegung bleiben die Lampen steady (`lampPulse`) und die Parallaxe steht still.
Tests: `ambient-plan.test.ts` (Band, Klemmen, Fallback, Flackern),
`motion-preference.test.ts` (Fallback ohne `matchMedia`).

**Übergang Tag→Nacht im laufenden Spiel (2026-11-12, ohne Neuladen):** Ein
`setInterval` (400 ms) hat den Ambient-Layer über 409 Proben und 314 Ticks
begleitet (`1528` → `1842`) und je Probe die echten Füllwerte aus den
Graphics-Instruktionen gelesen. Die Szene wechselte an den Tagesdritteln
(`TICKS_PER_DAY / 3 = 200`) exakt um, ohne Sprung im Trace und ohne Reload:

| Probe | Tick | Phase | Schleier | Strahlen | Sichtradius |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 1528 | `evening` | 0.20 | 0.05 / 0.065 / 0.08 (Plan 0.10) | aus |
| 37 205 ms | 1600 | `night` | 0.42 | Grafik leer, `visible:false` | 390×332 `@0.22` an der Figur |
| 141 266 ms | 1800 | `morning` | aus (Plan 0) | 0.08 / 0.104 / 0.128 (Plan 0.16) | aus |

Reihenfolge im Umschaltframe: `AmbientLayer.update` zeichnet Schleier, Strahlen,
Sichtradius in dieser Reihenfolge (Kinder `0:Graphics` Schleier,
`1:Graphics` Strahlen, `2:Sprite` Radius, additiv). Der Nachtwechsel fällt
damit zusammen: Schleier 0.20 → 0.42, Strahlen werden geleert (`fill: []`),
Radius geht an — die Straßenlaternen und der Radius sind in der Nacht die
einzige Lichtquelle, die Strahlen können den Radius nicht überdecken. Der
Rückweg um 1800 nimmt alle drei im selben Frame zurück (Schleier aus, Strahlen
0.16, Radius aus), also keine Einbahnstraße und kein hängender Zustand.
Bilder: `31-r12-abend-stadt.png` (Abend, Strahlen an), `32-r12-nacht-uebergang.png`
(Nacht, Strahlen aus, Lichtkreis an). Der harte Phasenwechsel je Drittel ist
inzwischen durch einen kurzen Übergang ersetzt (nächster Abschnitt).

### Übergang statt Drittel-Sprung (2026-11-13)

Der Ambient-Plan war pro Phase eingefroren und wurde per Identitätsvergleich
umgeschaltet: an `TICKS_PER_DAY / 3` sprang der Schleier in einem Tick von 0
auf 0.2 bzw. 0.2 auf 0.42, die Strahlen von 0.16 auf 0.1 auf 0, der Sichtradius
von aus auf 390×332. Jetzt blendet `ambientPlanAt(tick, scene)` zwischen den
Nachbarphasen.

**Regeln**

- Fenster: `AMBIENT_TRANSITION_TICKS = 24` Ticks (knapp eine Stunde), je zur
  Hälfte vor und nach der Grenze (`PHASE_TICKS = 200`, `PHASE_BOUNDARIES` aus
  `day-phase.ts`). Außerhalb des Fensters ist das Ergebnis **identisch** zum
  eingefrorenen Phasenplan (gleiches Objekt, kein Neuzeichnen).
- Innerhalb wird linear gemischt: Schleier, Strahlen, Sonnenrichtung, Schatten,
  Sichtradius und dessen Deckkraft. Farbe und Umgebung kommen von der Zielphase;
  die Tints sind in allen Phasen gleich.
- Rein aus Tick und Szene: keine Uhr, kein Zufall. Derselbe Tick ergibt dasselbe
  Bild, auch nach einem Reload. Fehlt der Tick (Fixture, kaputter Save), gilt die
  gemeldete Phase (`ambientPlanForView`) — kein NaN-Licht.
- Gelesen wird der Plan an beiden Stellen: `AmbientLayer.update` (Schleier,
  Strahlen, Radius) und `city.setAmbient` (Objektschatten der Straße).

**Tests** — `src/render/__tests__/ambient-plan.test.ts`

| Fall | Zusicherung |
| --- | --- |
| Plateaus | außerhalb des Fensters genau der eingefrorene Plan (Identität) |
| Enden | `Grenze ± 12` trifft die Nachbarphase exakt |
| Stetigkeit | kein Tick springt mehr als 1/24 des Phasenabstands (Schleier < 0.02, Strahlen < 0.08) |
| Nachtradius | wächst von 0 über die halbe Distanz auf 7.5 Tiles, statt zu schalten |
| Determinismus | gleicher Tick, gleiche Werte; auch im Innenraum stetig |

**Messung im Browser (2026-11-13, laufendes Spiel, Szene `CITY`)** — der
Ambient-Layer wurde über 3145 Proben (100 ms, 605 Ticks ≈ ein Spieltag)
begleitet; größter Schritt zwischen zwei Ticks im ganzen Lauf: Schleier
0.0175 (= 0.42 / 24), Strahlen 0.0034. Ausschnitt um die Grenze bei Tick 200
(Morgen → Abend):

| Tick | Schleier | Strahlen | Sichtradius |
| --- | --- | --- | --- |
| 188 | 0 | 0.08 / 0.104 / 0.128 | aus |
| 189 | 0.0083 | 0.0788 / 0.1024 / 0.126 | aus |
| 200 | 0.1 | 0.065 / 0.0845 / 0.104 | aus |
| 205 | 0.1417 | 0.0575 / 0.0748 / 0.092 | aus |
| 211 | 0.1917 | 0.0513 / 0.0666 / 0.082 | aus |
| 212 | 0.2 | 0.05 / 0.065 / 0.08 | aus |

Jeder Schritt ist 1/24 des Wegs (Schleier 0.0083, Strahlen 0.0012); es gibt
keinen Tick mit dem alten Sprung.

Dieselbe Messung an der Grenze bei Tick 600 (Nacht → Morgen), diesmal mit dem
Sichtradius, der zuerst schrumpft und dann ausgeht:

| Tick | Schleier | Strahlen | Sichtradius |
| --- | --- | --- | --- |
| 588 | 0.42 | aus | 390 `@0.22` |
| 594 | 0.315 | 0.02 / 0.026 / 0.032 | 293 `@0.165` |
| 600 | 0.21 | 0.04 / 0.052 / 0.064 | 195 `@0.11` |
| 606 | 0.105 | 0.06 / 0.078 / 0.096 | 98 `@0.055` |
| 612 | 0 | 0.08 / 0.104 / 0.128 | aus |

Alle 25 Ticks des Fensters liegen lückenlos vor (keine fehlende Probe), und
jeder Schritt ist derselbe 1/24-Anteil: 0.0175 Schleier, 0.0034 Strahlen,
0.0025 Radiusdeckkraft, 16 px Radius. Der Radius verschwindet damit als
Schrumpfen statt als Schnitt.

Bilder: `33-r12-nacht-nach-uebergang.png` (Nachtplateau mit Lichtkreis),
`34-r12-uebergang-beginn.png` (Straße kurz nach Beginn des Abendübergangs,
Strahlen noch sichtbar), `35-r12-uebergang-mitte.png` (Mitte des
Nacht→Morgen-Übergangs: halber Schleier, erste Strahlen, kleiner Radius),
`36-r12-uebergang-ende.png` (Morgenplateau ohne Schleier und Radius).

**Weiter offen:** Wetter, Stadt-NPCs als laufende Figuren (R9),
Weltasset-Metadaten (R8).

### Prüfung der offenen Punkte 2026-11-12

**R2 ist abgenommen (PASS).** Die Annahme „ein unbekanntes Möbel ist im
Spielstand nicht erzeugbar" war falsch: `migrate.ts` reicht Möbel
unverändert durch (`{ ...raw }`), es prüft nur die Geräteidentität. Ein
Testfixture hängt ein `DECOR` mit unbekanntem Label („Röntgengerät") in den
Spielstand; `resolveFurnitureRole` liefert `null`, `furniture-atlas.ts` zeichnet
`drawUnresolved` (Warnrahmen, Schraffur, Fragezeichen) statt einer geratenen
Textur. Beleg: `28-r2-platzhalter.png` (Übersicht) und
`29-r2-platzhalter-detail.png` (Zoom). Der Platzhalter ist kein Spielpfad,
sondern die ehrliche Antwort auf Daten, die keine Rolle haben.

**R8 ist nicht umgesetzt (FAIL).** Von den 539 Einträgen in
`src/render/assets/asset-semantics.json` tragen alle `role`, aber **kein
einziger** `world`, `displayScale` oder `license`. Der Test prüft die im JSON
selbst hinterlegten `commonRequired`-Felder (`category`, `type`, `bounds`,
`depth`, `occlusion`, `lod`, `interactive`, `usedBy`, `evidence`) — also einen
anderen Vertrag als den im Plan geforderten. `src/render/city/city-assets.ts`
fehlt. Damit fehlen die drei Nachweise der Akzeptanz (Welt, Skalierung,
Rechte) vollständig; ein falscher `displayScale` kann nicht abgelehnt werden,
weil das Feld nicht existiert.

**R9: Fundament jetzt belegt, Darstellung offen.** `CityResidentState` trägt
seit dem Bewegungs-Schnitt eine Kachel (`position`), einen laufenden Weg
(`travel: { to, path, index }`) und damit eine Ankunftszeit; der Ort wechselt
erst am Ziel statt mit dem Entschluss. `city-life-movement.ts` baut den Weg mit
dem vorhandenen A* auf `cityNav(city)` (60×60 Straßen samt Requisiten) und läuft
eine Kachel je Tick. `src/render/city/city-actors.ts` und
`city-actors.test.ts` aus dem Plan existieren weiterhin nicht: Ein Renderer
kann die drei Bewohner jetzt zeichnen, tut es aber noch nicht. Das Stadtfenster
(`30-r9-stadtbewohner.png`: Rita 32/18/83, Boris 6/4/52, Mira 34/4/100 mit
Intent, Ort und Traits) zeigt deshalb weiter Zustand, keine Figuren auf der
Straße.

#### Was der letzte Simulations-PR geändert hat

Der letzte PR mit Simulationslogik ist #486 (Merge `e33e5ef6`,
„Kausaler Living-World-Langlauf"); #488/#491 haben nur Evidenz nachgezogen,
#490 Render, #493/#494 Test-Qualität. Inhaltlich kamen mit #480/#484/#485/#486:

| Bereich | Neu |
| --- | --- |
| Stadtleben | `city-life*.ts` (Score, Entscheidung, Wirkung, Erinnerung, Normalisierung) — zwölf Module, `tickCityLife` in `tick.ts` |
| Spielerbedürfnisse | `player-needs.ts`, `player-needs-tick.ts`, Leser in `player-jobs.ts`, `city-actions.ts`, `floor-actions.ts` |
| Fremder Floor | `active-player.ts` (ein Spielerstand je Szene), `worldNav` über `foreign.layout`/`foreign.furniture`, Tastatur/Kamera freigegeben |
| Evidenz | `living-world-longturn-*.ts` plus Artefakte unter `artifacts/`/`docs/evidence/` |

**Nachgerechnet:** Der 5-Tage-Lauf mit Seed 424242 erzeugt 363 Entscheidungen und
556 gekippte Gegenfakt-Proben — Routine 240, Umgebung 66, Fähigkeiten 55,
Müdigkeit 44, Traits 41, Hunger 29, Attribute 21, Erinnerung 19, Beziehung 19,
Emotion 16, Durst 4, Sozial 2; 110 Entscheidungen weichen vom Tagesplan ab. Die
Zahlen sind nach dem Bewegungs-Schnitt neu erzeugt (vorher: 512 Proben, 86
Abweichungen, Routine 254, Müdigkeit 51). Die Datei unter `artifacts/` wird dafür
lokal nachgeschrieben (`RBD_LIVING_WORLD_OUT=artifacts/living-world/trace-424242-5d.json`,
Befehl oben) und ist nicht Teil des Commits, weil `artifacts/` ignoriert wird;
`docs/evidence/living-world-longturn-424242-4d.json` belegt den Weg im echten
`tickWorld`.

#### Wo es noch nicht wie geplant funktioniert

1. **Behoben: Bedürfnis-Override war toter Code.** `needsOverrideIntent` hatte
   nur `resolveNpcIntent` als Aufrufer, und der lief in keinem
   Produktionspfad. Jetzt fragt `city-life-override.ts#urgentNeedVeto` dieselbe
   Funktion und macht das dringende Bedürfnis zu einem Veto gegen Arbeit,
   Einkauf, Freizeit und Besuche; Schlafen, Essen und Trinken bleiben offen.
   Der Trace kennt seither **keine** Nachtarbeit mehr (vorher: Boris an Tag 5
   um 01:00, 03:00, 04:00 und 06:00).
2. **Behoben: keine Öffnungszeiten im Score.** `hoursForIntent`/`isOpenAt`
   schließen Arbeit (ab 7 bis 20), Kneipe (ab 9 bis 23), Einkauf und Auswärts-
   essen; eine geschlossene Handlung kostet 1000 Punkte und kann die Stunde
   nicht gewinnen. Im Lauf gibt es jetzt **null** Kneipenbesuche vor 09:00
   (vorher acht: Rita und Mira um 08:00).
3. **Behoben: Bewegung war ein Etikett.** `COMMUTE` setzte die Stunde auf
   „unterwegs" und wechselte nur `location`. Jetzt startet der Entschluss einen
   Weg (`city-life-movement.ts`), der Bewohner läuft eine Kachel je Tick, der
   Ort wechselt bei Ankunft, und die Ankunft kostet Müdigkeit (ein Punkt je acht
   Kacheln). Im 4-Tage-Lauf: 64 Wege, 1878 Kacheln, 1817 Tick-Zustände „unterwegs",
   nie mehr als eine Kachel je Tick, 107 Bewohner zur vollen Stunde noch auf dem
   Weg. R9 bleibt nur noch die Darstellung offen (`city-actors.ts` fehlt).
4. **Behoben: Identität hing am Namen.** Jeder Bewohner trägt jetzt eine
   individuelle Kennung (`CityResidentState.visitorId`), gebunden in
   `city-identity.ts#bindCityIdentities` und gespeichert wie die übrigen Stats.
   `ensureCityVisitor` sucht das Profil über `Visitor.residentNpcId`, nie über
   den Namen; `cityLifeView` liest `resident.visitorId`. Ein Namensvetter im
   Gästepool hat damit eigene Traits und Beziehungen. Bewohnerprofile entstehen
   über `recordResidentVisitor` mit `visits: 0` — sie waren nie im Casino — und
   fallen aus `pickReturningVisitor`, bis sie wirklich da waren. Nur ein Save
   ohne Kennungen wird einmal per Name adoptiert (`adoptLegacyProfile`), danach
   trägt das Profil seine Kennung selbst. Der Start-Pool der Narrative-Domäne
   bleibt bewusst bei `visits: 1`: Das sind kuratierte Stammgäste ab Tick 0,
   keine behaupteten Stadtbesuche.
5. **Hausbedarf liest Etiketten, nicht IDs.** `homeItem()` sucht
   „Kochnische"/„Kühlschrank" per `label.includes` in
   `playerApartmentFurniture()` und misst Manhattan-Distanz ≤ 3 zur
   Möbel-Ursprungsecke — entgegen der eigenen Entscheidung „stabile IDs statt
   Label-Regexe".
6. **Anzeige ohne Schutz.** `hud.tsx` gibt `view.demand.perDay` ungeprüft aus;
   mit einem inkonsistenten Spielstand (Tick nach vorn gesetzt, `nextArrivalTick`
   zurück) stand dort `~NaN/Tag`. Mit frischem Spielstand nicht reproduzierbar —
   ein Robustheitsloch, kein Planbruch.

#### Nachgezogen: Slots und Öffnungszeiten aus der Stadt (2026-11-12)

Die Stundentabelle ist weg. `city-life-venues.ts` liest die Stadt selbst:
Gebäude tragen ihre Öffnungszeiten (`BuildingState.operatingHours`), Job-Slots
tragen Schicht und Inhaber. `city-life-override.ts` verbietet nur noch, was
wirklich zu ist: Arbeit außerhalb der eigenen Schicht, Kneipe vor 16, Einkauf
vor 6, Auswärtsessen zwischen 4 und 6. Der Score rechnet diesen Ausschluss als
Faktor, damit die Gegenfakt-Proben ihn neutralisieren können; der seedfeste
Tie-Break liegt in `city-life-tiebreak.ts`.

```
slot_pub_host      bld_kiez_pub   16–24  rita
slot_shop_counter  bld_corner_shop 7–20  boris
slot_market_runner bld_corner_shop 9–17  mira
```

Der Tagesplan folgt jetzt der Schicht (`createDayPlan(..., shift)`): Aufstehen
zwei Stunden vorher, Frühstück, Arbeit, Pause nach vier Stunden, danach Weg
nach Hause, Einkauf, Kneipe, Schlaf. Ein Resident ohne Slot arbeitet nirgends;
ein Slot ohne Inhaber bleibt offen und ist damit der Platz, an dem später der
Spieler oder ein neu zugezogener Bewohner einsteigt.

Zwei Schwellen waren im Modell tot: Durst zählte erst ab 25 und war ab 66
gedeckelt (abends liegt er bei 4–20), die Laune wirkte erst unter 40 (der Lauf
fällt nie unter 46). Jetzt zählt Durst ab 10 bis 55, Laune bis 55 — eine
Sensitivitätskorrektur innerhalb des Bereichs, den die Simulation erreicht.

**Beleg im Lauf (363 Entscheidungen, 5 Tage):** 555 gekippte Proben, 112
Abweichungen vom Plan; Arbeit nur in den Schichten 7–19 Uhr, kein Kneipenbesuch
vor 16, kein Einkauf vor 6, kein Auswärtsessen zwischen 4 und 6 (jeweils 0
Verstöße). Die Familienzähler: Routine 242, Umgebung 67, Fähigkeiten 59,
Fatigue 37, Traits 37, Hunger 29, Attribute 21, Beziehung 21, Erinnerung 20,
Emotion 14, Durst 6, Sozial 2.

Belege: `city-life-venues.ts` + `city-life-override.test.ts` (Öffnungszeiten,
Schichten, Veto), `city-life.test.ts` (Schichtroutine, 08:00-Kneipe,
Überstimmung des Plans), `npc-schedule.test.ts` (Standardplan bleibt
gespeichert), `living-world-causal-trace.test.ts` (alle zwölf Familien kippen
eine Entscheidung; Bargeld an einem armen, hungrigen Bewohner statt an einer
Zufallszeile).

### Nachgezogen: Bewegung als Weg (2026-11-13)

`COMMUTE` war ein Etikett: Die Stunde hieß „unterwegs", `location` sprang, es
gab weder Dauer noch Zwischenstand. Jetzt hat jeder Bewohner eine Kachel und
einen Weg.

**Modell** — `src/core/sim/city-life-movement.ts`

```
CityResident  position: Point                     Kachel auf der Stadtkarte
              travel:   { to, path[], index } | null
              location: Ziel erst bei Ankunft
```

**Regeln**

- Das Ziel kommt aus der Not: Der Score wählt den Intent (Arbeit, Einkauf,
  Kneipe, Besuch), der Intent wählt das Gebäude, `placeEntrance()` seine Tür.
  Der Weg selbst ist A* (`findPath`) auf `cityNav(city)` — dieselbe Navigation
  wie der Spieler, inklusive Requisiten-Fußabdrücken. Kein zweiter Graph, keine
  Luftlinie.
- Eine Kachel je Tick (25 je Stunde), höchstens acht je Aufruf. `tick.ts` ruft
  `tickCityMovement` nach `tickCityLife`; der Weg läuft also auch, während der
  Spieler im Casino steht.
- Der Ort wechselt **nur** bei Ankunft. Vorher meldet die Sicht
  `travelTo: 'Kiez'`, der alte Ort bleibt stehen — das ist der Zwischenstand.
- Ankunft kostet Müdigkeit (ein Punkt je acht Kacheln, ganzzahlig, damit der
  Save-Roundtrip nichts rundet). Ein Umweg verändert damit die nächste
  Entscheidung.
- Kein Weg, kein Sprung: Ist das Ziel unerreichbar, bleibt alles stehen.
  Kaputte Positionen/Speicherwege werden in `normalizeCityLife` verworfen.

**Beleg** — `docs/evidence/living-world-longturn-424242-4d.json`

| Größe | Wert |
| --- | --- |
| Wege im 4-Tage-Lauf | 64 |
| gelaufene Kacheln | 1878 |
| Tick-Zustände „unterwegs" | 1817 |
| Kacheln je Tick (Maximum) | 1 |
| Bewohner zur vollen Stunde noch unterwegs | 107 |

**Offen:** `src/render/city/city-actors.ts` (Figuren zeichnen), Zwischenstopps
auf dem Weg (Essen, wenn der Hunger unterwegs kippt) und Stau/Umwege zwischen
mehreren Bewohnern. Der Zustand dafür steht jetzt; es fehlen Leser.

### Stadtwachstum, Grundstücke und Slots (Plan, 2026-11-12)

Die Stadt ist die Wahrheit über Zeit, Arbeit und Platz — nicht der Score. Ein
Gebäude trägt Öffnungszeiten und Grundfläche, ein Job-Slot trägt Schicht und
Inhaber, ein Grundstück trägt Lage und Preis. Alles, was ein Bewohner tut, liest
diese Daten; nichts davon steht als Sondertabelle in einer Entscheidungsdatei.

**Regeln**

- Jede Schicht liegt innerhalb der Öffnungszeit ihres Gebäudes; Arbeit außerhalb
der Schicht ist keine Entscheidung, sondern ausgeschlossen.
- Ein Slot ohne Inhaber ist offen. Offene Slots sind die Stellen, an denen der
Spieler oder ein neu zugezogener Bewohner einsteigt.
- Ein Bewohner ohne Slot ist das Wachstumssignal: Es gibt zu wenig Arbeit, also
darf die Stadt bauen — aber nur, wenn ein Bauträger das Kapital hat.
- Grundstücke sind feste Plätze im Kartenlayout. Der Spieler wählt keinen
Standort; er fragt ein Grundstück an und bekommt es nur, wenn kein NPC mehr
bietet. So entsteht Bodenwert aus Lage, Nachfrage und Auslastung.
- Immobilien und Geschäftsübernahmen laufen über dieselbe Buchführung wie der
bestehende Kauf (`property.ts`, Ledger, Journal) — kein zweiter Geldweg.

**Datenmodell (Vorschlag)**

```
CitySlot      id, buildingId, label, from, to, holderId | null      (vorhanden)
CityPlot      id, rect, zoning(HOME|BUSINESS|PUBLIC), ownerId|null,
              askPriceVC, bids[], lastSaleDay
CityBuilding  BuildingState + plotId + builtDay + builderId
CityGrowth    openSlots, joblessResidents, builderCapitalVC, demand
```

**Slices**

| Slice | Inhalt | Akzeptanz |
| --- | --- | --- |
| S1 | Slots und Schichten aus Gebäuden (erledigt) | Arbeit nur in der Schicht; Kneipe erst ab 16; 0 Verstöße im 5-Tage-Lauf |
| S2 | Grundstücksregister mit festen Plätzen im Kartenlayout | Jedes Gebäude steht auf genau einem Grundstück; keine zwei Gebäude auf einem Platz; alte Saves bleiben lesbar |
| S3 | Bauträger und Wachstum | Ohne offene Slots und ohne Joblose baut niemand; mit Kapital entsteht ein Gebäude samt neuem Slot |
| S4 | Gebotsverfahren und Bodenwert | Der Spieler fragt an, ein NPC überbietet deterministisch (Seed), der Preis folgt Lage und Nachfrage; Verkauf landet im Journal |
| S5 | Spieler nimmt einen offenen Slot an und übernimmt ein Geschäft | Derselbe Slot, dieselbe Schicht, dieselbe Buchführung wie beim NPC |

S2 braucht das Kartenlayout als Datenquelle (Grundstücksraster statt freier
Koordinaten), S3 die Verbindung von Bewohnerzahl, offenen Slots und
Bauträgerkonto. Beides ist Headless prüfbar; der Renderer liest danach nur noch
`buildings`/`plots`.

## 1. Ausgangslage

Der Audit beschreibt 97 Render-Dateien und mehrere sichtbare Brüche zwischen
Simulation und Darstellung. Am aktuellen Baum wurden die folgenden Befunde
stichprobenartig bestätigt; die Zahlen aus dem Audit sind Ausgangsmessung und
werden in R0 neu erhoben, nicht ungeprüft übernommen.

| Befund | Aktueller Beleg | Phase |
| --- | --- | --- |
| D1: Grüner Platzhalter statt Ehrlichkeit | **Durch R2 umgesetzt:** `src/render/decor-roles.ts` + `src/render/__tests__/decor-roles.test.ts`; `furniture-atlas.ts` zeichnet unbekannte Flächen als Warnmuster. Verbleibende `0x2dd4a0`-Treffer sind Palette-Rollen (`PALM`/`PLANT` in `src/render/visual/scene-frame.ts`, `success` in `src/render/art-tokens.ts`), kein Platzhalter. | R2 |
| D2: Deko über Label-Regexe | **Durch R2 umgesetzt:** `src/render/decor-roles.ts` + `src/render/__tests__/decor-roles.test.ts` lösen stabile IDs, `kind` und exakte Labels auf; keine Regex-Heuristik mehr in `furniture-atlas.ts`. | R2 |
| D3: Fünf Materialien ohne Textur | `src/render/floor-material.ts` enthält fünf `texture: null` | R4 |
| D4: Figur wird zum Pin | `src/render/guest-rig.ts` ersetzt das Rig durch den Pin; `guest-paint.ts` malt 6×6 | R3 |
| D5: Stadt existiert nur headless | `createCityExteriorModel()`/`createCityStreetLayout()` haben keinen Produktionsaufrufer außerhalb der Simulation | R7 |
| D6: Teppich als Overdraw | `src/render/scene-cache.ts` nutzt `CarpetOverlay` | R4 |
| D7: Kein lokales Bildgate | Es gibt keinen reproduzierbaren Browservergleich für Render-Änderungen | R1 |
| D8: Falscher Kamera-/Hintergrundvertrag | Quadratische Kamera und flacher Hintergrund begrenzen die Stadt | R6 |

Der Audit nennt rund 554 Assets, davon 418 ohne Nutzung. Für diesen Plan ist
nicht „mehr Assets“ das Ziel, sondern **jede sichtbare Fläche hat eine benannte
Rolle, eine echte Textur und einen lokalen Beleg**.

## 2. Leitentscheidungen

Diese Entscheidungen gelten als Default. Eine Abweichung braucht einen
Messbeleg und wird in diesem Dokument nachgezogen, nicht still im Code
eingeführt.

1. **Die Simulation bleibt die Wahrheit.** `src/core/sim/city-exterior.ts`,
   `building.ts`, `room-transition.ts` und `player-apartment.ts` werden nicht
   neu geschrieben. R7 baut eine Darstellungsschicht darüber.
2. **`city-exterior.ts` ist der kanonische Stadtkern.** Die Portal-/Menülogik
   in `src/ui/city-popup.tsx` und die vorhandene `city-scene`-Darstellung
   werden zu einem Adapter auf das Exterior-Modell; es entsteht keine zweite
   Stadtwahrheit.
3. **Projektion:** Außenstadt in 2:1-Isometrie, Innenräume weiterhin
   top-down. Die Projektion wird in R6 als Vertrag festgeschrieben, bevor R7
   Assets und Kollisionen darauf auslegt.
4. **Ein Zustand, eine View.** `GameView` bleibt der bestehende
   Darstellungszustand. Die Stadt bekommt einen `WorldView`-Adapter, keinen
   zweiten Store und keinen zweiten Ticker.
5. **Rollen statt Label-Regexe.** Deko und Möbel werden über stabile
   `kind`-/`gameId`-/Asset-IDs einer Renderrolle zugeordnet. Ein optionales
   `Furniture.role` ist nur zulässig, wenn der Resolver ohne es nicht
   eindeutig bleibt.
6. **Das Bildgate bleibt lokal.** Es nutzt den vorhandenen
   Browser-/Playwright-Pfad in `packages/gamescout` (`playwright-core`,
   `pixelmatch`, `pngjs`) und wird **nicht** als Cloud-Workflow, nicht als
   reguläres Gate und nicht als Screenshot-Pflicht in jeden Testlauf gehängt.
7. **Loops sind Mechanik, keine Gates.** Lange Stadt-, Soak- und
   Wiederholungsläufe bleiben gezielte `test:mechanics`-Nachweise. Der
   Render-Plan fügt keine Endlosschleife und keinen Retry-Zyklus hinzu.
8. **Sichtbares wird vom Agenten abgenommen.** Jeder sichtbare Slice R2–R12
   endet mit einer Preview-Sichtabnahme gegen den lokalen Dev-Server. Ein
   Unit-Test oder Pixel-Diff ohne Browserbeleg ist kein Phasenabschluss.

## 3. Reihenfolge

R0–R1 sind die Basis. R2–R6 härten den bestehenden Casino-Render, bevor die
Stadt daraufsetzt. R7 ist der sichtbare Schnitt; R8–R12 bauen in dieser
Reihenfolge darauf auf. R3 und R5 dürfen nach R1 parallel laufen; R4 folgt nach
R2. R7 wartet auf R2, R6 und den Stadtkern S2-12. R10 plant die Wohnung nicht
neu: es nimmt die offenen S2-09–S2-11 im Renderer ab.

| Phase | Ergebnis | Abhängig von | Größe |
| --- | --- | --- | --- |
| R0 | Baseline, Rolleninventar, Rechte, Entscheidungen | — | S |
| R1 | Reproduzierbares lokales Bildgate | R0 | M |
| R2 | Ehrliche Platzhalter und Rollenauflösung | R1 | M |
| R3 | Akteur-Silhouette statt Pin | R1 | M |
| R4 | Materialien und Teppich ohne Overdraw | R1, R2 | M |
| R5 | Licht mit Fläche und sichtbaren Quellen | R1 | M |
| R6 | Kamera, Hintergrund und LOD-Vertrag | R1, R5 | M |
| R7 | Stadtansicht an S2-12 anbinden | R2, R6, S2-12 | L |
| R8 | Stadt-Assetpaket und Weltmetadaten | R4, R7 | L |
| R9 | Stadtleben: NPCs, Türen, Begegnungen | R7, R8, S2-12 | L |
| R10 | Wohnung: Render-Abnahme für S2-09–S2-11 | R4, R7, S2-09–S2-11 | M |
| R11 | Lauf- und Richtungsanimation | R3, R8 | M |
| R12 | Ambient und Wetter | R9 | M |

**Meilenstein-Zuordnung:** M0 = R0–R1, M1 = R2–R6, M2 = R7–R8,
M3 = R9–R10, M4 = R11–R12. Die Exit-Kriterien stehen in Abschnitt 6; die
Roadmap führt dieselben IDs als grobe Produkt-Etappen.

## 4. Task-Phasen

### R0 — Baseline, Rolleninventar und Rechte

**Ziel:** Eine belastbare Ausgangsmessung, damit später niemand „besser“ behauptet,
ohne es zu messen.

**Dateien:** `src/render/assets/manifest.json`, `src/render/assets/__tests__/asset-semantics.test.ts`,
`docs/RENDER_REWORK_PLAN.md`, `docs/ROADMAP.md` (nur Referenzen), ggf.
`docs/ASSET-LICENSES.md` (neu, nur wenn die Rechteprüfung es verlangt).

**Aufgaben**

- [ ] Render-Inventar am Baum `0.3.242` neu zählen: Dateien, Assets, benutzte
      Assets, Atlasrahmen, Materialien, Figuren, Lichtflächen, Boot-Requests.
- [ ] Rolleninventar anlegen: Terrain, Wand, Boden, Möbel, Gerät, Deko, Akteur,
      Licht, Partikel, UI. Jede Rolle nennt ihren Renderer und ihre Quelle.
- [ ] Die im Audit genannten `usedBy`-Fehler gegen den echten Importgraphen
      prüfen; keine Asset-Nutzung aus Kommentaren oder Tests ableiten.
- [ ] Rechteprüfung: Herkunft der 554 Dateien und der neuen Stadtassets
      dokumentieren; offene Punkte bleiben offen, statt als geklärt zu gelten.
- [ ] Q1–Q5 aus Abschnitt 2 als Entscheidung protokollieren, inklusive
      Projektionswahl und `GameView`-Grenze.
- [ ] Baseline-Zahlen und offene Rechtefragen in `ROADMAP.md` unter `PR-10`
      referenzieren; keine neue konkurrierende Roadmap-Zeile.

**Akzeptanz**

- [ ] Jede Zahl hat einen Befehl oder eine Datei als Quelle.
- [ ] Kein Render-Code und kein Asset wurde in R0 geändert.
- [ ] Das Rolleninventar deckt jede sichtbare Fläche ab; „sonstiges“ ist keine
      Rolle.
- [ ] Die Rechtelage ist als „belegt“, „offen“ oder „blockiert“ markiert.

**PixiJS-Falle:** R0 ist absichtlich framework-frei. Kein `Application`-Umbau,
keine Asset-Umbenennung und kein vorzeitiges `Assets.init`.

### R1 — Lokales Bildgate

**Ziel:** Render-Änderungen lokal und reproduzierbar sehen, bevor sie als
„fertig“ gelten. Das Gate ersetzt kein Cloud-Gate und verlangsamt die normale
Testline nicht.

**Dateien:** `packages/gamescout` (bestehender Browser-/Bildpfad),
`src/render/visual/` (Szenenvertrag, falls ein Renderer-Modul nötig ist),
`src/render/__tests__/floor-camera.test.ts`, `src/render/__tests__/floor-cache.test.ts`.

**Aufgaben**

- [ ] Vier fixe Szenen definieren: Casino-Übersicht, Casino-Detail,
      Stadt-Platzhalter und Wohnung. Jeweils fester Seed, feste Tickzahl, feste
      Kamera, fester Ausschnitt.
- [ ] Sichtbaren Frame über den vorhandenen Browserpfad aufnehmen; keine
      `Texture.from(url)`-Abkürzung und keine neue Root-Abhängigkeit.
- [ ] Vier Szenen in einem Lauf aufnehmen, nicht pro Szene einen Browser starten.
- [ ] Vergleich: Pixel-Diff und Konsolenfehler. Ein absichtlicher 5-%-Eingriff
      muss rot werden; ein unveränderter Lauf muss dreimal grün sein.
- [ ] Boot-Requests und First-Frame-Zeit als Messwerte ausgeben; die
      Audit-Baseline (77 Requests) erst nach eigener Messung ersetzen.
- [ ] Baseline-Update nur im selben Commit wie die beabsichtigte Änderung.
- [ ] Das Gate als gezielten lokalen Befehl dokumentieren; **nicht** in
      `ci:local`, `verify:all` oder einen Cloud-Workflow einhängen.

**Akzeptanz**

- [ ] Drei aufeinanderfolgende Läufe liefern denselben Diff.
- [ ] Eine beabsichtigte Farb-/Geometrieänderung wird erkannt.
- [ ] Ein fehlendes Asset oder ein Platzhalter erscheint im Bild, nicht als
      stiller grüner Fleck.
- [ ] Das Gate benötigt keinen Netzwerkzugriff außer den lokalen Vite-Assets.

**PixiJS-Falle:** `app.init()` ist asynchron; erst danach existieren
`app.canvas`, `app.renderer` und `app.screen`. Kein `new Application({...})` mit
Optionen. Kein zweiter Ticker im Gate.

### R2 — Ehrliche Platzhalter und Rollenauflösung

**Ziel:** Fehlende Assets werden sichtbar und zuordenbar, statt als grüne Fläche
oder falsches Möbelstück zu erscheinen.

**Dateien:** `src/render/furniture-atlas.ts`, `src/render/guest-paint.ts` (nur
gemeinsame Zeichenhelfer), neu `src/render/decor-roles.ts`, ggf.
`src/core/sim/furniture-catalog.ts`, `src/render/assets/manifest.json`.

**Aufgaben**

- [x] `decor-roles.ts` führt eine explizite Tabelle `stabile ID → Rolle`.
      Reihenfolge: `gameId`, `kind`, Asset-ID, erst danach Anzeigename.
- [x] Die Regex-/Label-Heuristik in `furniture-atlas.ts` entfernen. Ein
      unbekannter Name darf keine geratene Rolle mehr erzeugen.
- [x] Platzhalter zeichnen: gestrichelte Kontur, neutraler Warnfarbton,
      Asset-/Rollenname klein darunter. Kein `0x2dd4a0` als Erfolgssignal.
- [x] Unbekanntes Bodenmaterial bekommt denselben ehrlichen Platzhalter; der
      Boden fällt nicht auf Beton zurück.
- [x] `Furniture.role` nur ergänzen, wenn ein stabiler Schlüssel fehlt; die
      Schemaänderung braucht Save-/Migrationsprüfung.
- [x] Test: jede Rolle aus dem Inventar wird aufgelöst; unbekannte ID wird
      sichtbar als Platzhalter gemeldet; kein Treffer über Label-Text.

**Akzeptanz**

- [x] `rg "0x2dd4a0" src/render/furniture-atlas.ts` liefert keinen Treffer.
- [x] Kein Deko-Mapping liest mehr einen Anzeigenamen als Primärschlüssel.
- [x] Ein fehlendes Asset ist im lokalen Bildgate sichtbar und nennt seinen
      Schlüssel.
- [x] Bestehende Möbel und Geräte behalten ihre Textur.
- [x] Sichtabnahme: unbekanntes Möbel als gestrichelter Platzhalter mit
      Schlüssel; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Platzhalter sind `Graphics`-Leaves in einem `Container`.
Keine Kinder an `Graphics` hängen. Text als eigener `Text`/`BitmapText`-Leaf,
nicht als Canvas-in-Canvas.

### R3 — Akteur-Silhouette statt Pin

**Ziel:** Gäste bleiben als Figuren erkennbar, auch wenn das Rig im LOD reduziert
wird.

**Dateien:** `src/render/guest-rig.ts`, `src/render/guest-paint.ts`,
`src/render/entity-sync.ts`, neu `src/render/actor-silhouette.ts`,
`src/render/__tests__/rig.test.ts`, `src/render/__tests__/guest-sprite.test.ts`.

**Aufgaben**

- [ ] Fünf Silhouetten (Persona-Familien) als 24×32-Quelle, 12×16-Anzeige;
      Tint aus der bestehenden Personafarbe.
- [ ] `GuestRig` bekommt `setSilhouette(persona, color)`; der Pin-Pfad wird
      entfernt, nicht nur ungenutzt gelassen.
- [ ] LOD-Regel: Detail oberhalb der Schwelle, Silhouette darunter, nie ein
      unsichtbarer Actor. Kein inverses Skalieren des Pins.
- [ ] `entity-sync.ts` darf die Silhouette nicht pro Frame neu erzeugen; sie
      wird einmal pro Actor/Persona gebaut und wiederverwendet.
- [ ] Test: alle fünf Personas haben eine Silhouette; `paintPin` kommt im
      Renderpfad nicht mehr vor; ein LOD-Wechsel erzeugt kein Duplikat.

**Akzeptanz**

- [ ] Kein 6×6-Pin mehr im gerenderten Bild.
- [ ] Ein Gast ist bei beiden LOD-Stufen als dieselbe Person erkennbar.
- [ ] Die Silhouette skaliert mit der Welt, nicht gegen die Kamera.
- [ ] Der lokale Bildvergleich zeigt Detail und Silhouette.
- [ ] Sichtabnahme: Detail und Silhouette im selben Lauf, kein Pin;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `Sprite` ist ein Leaf. Kein `addChild` auf einem Sprite.
Silhouette als eigener `Sprite` in einem `ActorContainer`; `visible` statt
`renderable`, wenn Bounds für Hit-Tests erhalten bleiben müssen.

### R4 — Materialien und Teppich ohne Overdraw

**Ziel:** Böden sehen wie Materialien aus, nicht wie Farbflächen mit
Punktmuster. Der Teppich wird einmal gezeichnet, nicht als Overlay über einer
bereits gefüllten Fläche.

**Dateien:** `src/render/floor-material.ts`, `src/render/floor-surface.ts`,
`src/render/floor-carpet.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/floor-layout.test.ts`, neu
`src/render/__tests__/floor-material.test.ts`.

**Aufgaben**

- [ ] Sechs Casino-Materialien mit echten, nahtlosen Texturen belegen:
      Holz, Fliese, Stein, Linoleum, Beton, Teppich.
- [ ] `texture: null` aus der Materialtabelle entfernen; ein unbekanntes
      Material nutzt den Platzhalter aus R2, nicht `null`.
- [ ] Muster nicht mehr pro Kachel als `Graphics` zeichnen; Textur über
      `TilingSprite` oder eine materialeigene Textur.
- [ ] `CarpetOverlay` aus `scene-cache.ts` entfernen. Der Teppich ist eine
      Fläche mit einer Textur, kein zweiter vollflächiger Layer.
- [ ] `texture.source.scaleMode = "nearest"` für Pixelkunst zentral setzen;
      keine weichen Skalierungen pro Material.
- [ ] Test: jedes Material hat eine Textur; Teppich erzeugt genau einen
      Zeichenknoten; Layoutwechsel invalidiert den Cache genau einmal.

**Akzeptanz**

- [ ] Kein `texture: null` in der produktiven Materialtabelle.
- [ ] Kein `CarpetOverlay` mehr im Szenenaufbau.
- [ ] Ein Raum mit Teppich hat nicht zwei vollflächige Bodenknoten.
- [ ] Die sechs Materialien sind im lokalen Bildgate unterscheidbar.
- [ ] Sichtabnahme: sechs Materialien und genau ein Teppich-Bodenknoten;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `TilingSprite` ist ein Leaf; seine Textur kommt aus
`Assets.load`, nicht aus `Texture.from(url)`. `tileScale`/`tilePosition` statt
manueller Kachelschleifen. `cacheAsTexture` nur auf stabilen, großen Gruppen und
vor `destroy()` wieder abschalten.

### R5 — Licht mit Fläche und sichtbaren Quellen

**Ziel:** Licht wird als Fläche und Quelle lesbar; die 16 deckenden Ellipsen
verschwinden.

**Dateien:** `src/render/floor-surface.ts`, `src/render/fx/` (Lichtmodul),
`src/render/__tests__/depth.test.ts`, neu `src/render/__tests__/lighting.test.ts`.

**Aufgaben**

- [ ] Eine 256×256-Radialtextur mit definiertem Falloff und Alpha erzeugen.
- [ ] Lichtpool statt 16 einzelner `Graphics`-Ellipsen; jedes Licht hat
      Position, Radius, Farbe und Intensität aus der bestehenden Lichtquelle.
- [ ] Sichtbare Leuchtkörper (Lampe, Schild, Slot) als eigene Sprites; der
      Lichtpool bleibt additiv, die Quelle bleibt deckend.
- [ ] Lichtdaten aus `floor-surface.ts` in ein eigenes Modul ziehen; der
      Boden zeichnet keine Lichtlogik mehr.
- [ ] Keine Allokation pro Frame: Pools einmal bauen, pro Frame nur Werte
      setzen.
- [ ] Test: 16 Quellen, 16 Pool-Einträge, keine Ellipsen; BlendMode nur an
      Kindern, nicht an der Gruppe.

**Akzeptanz**

- [ ] Keine `ellipse()`-Lichtschleife mehr im Bodenrenderer.
- [ ] Ein Licht mit Radius 0 bleibt sichtbar als Quelle, ohne Fläche.
- [ ] Der Lichtpool erzeugt bei ruhender Szene keine neuen Objekte.
- [ ] Lokales Bildgate: Licht überlappt glaubwürdig, ohne den Boden zu
      überdecken.
- [ ] Sichtabnahme: Lichtpool und sichtbare Quelle ohne Ellipsen;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `blendMode = "add"` gehört auf die Lichtkinder, nicht auf
einen Container, dessen Kinder unterschiedliche BlendModes brauchen. Kein
`isRenderGroup` um den Lichtpool, solange dessen Kinder animiert werden.

### R6 — Kamera, Hintergrund und LOD-Vertrag

**Ziel:** Die Kamera kennt echte Weltgrenzen, der Hintergrund hat Tiefe, und LOD
flattert nicht an der Schwelle.

**Dateien:** `src/render/floor-view.ts`, `src/render/floor-camera.ts`,
`src/render/floor-camera-rig.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/floor-camera.test.ts`, `src/render/__tests__/floor-cache.test.ts`.

**Aufgaben**

- [ ] `FloorCamera` von quadratischem `size` auf `worldBounds {width,height}`
      umstellen; Casino-Verhalten bleibt über eine feste Bounds erhalten.
- [ ] Zoom-/Pan-Grenzen aus den Weltgrenzen ableiten, nicht aus dem Viewport.
- [ ] Hintergrund als zwei Parallax-Ebenen mit Faktor; keine Kamera-Reprojektion
      pro Frame über `getBounds()`.
- [ ] LOD-Schwelle mit Hysterese: Detail an, wenn näher als `enter`; erst
      Silhouette, wenn weiter als `exit`; kein Flackern bei einem Pixel.
- [ ] Q2 (2:1-Isometrie außen) im Kamera-Vertrag festhalten; Innenräume bleiben
      top-down.
- [ ] Test: Bounds 60×60 versus 10×10, Zoom-Grenzen, Hysterese an der Schwelle,
      Hintergrund bewegt sich langsamer als die Welt.

**Akzeptanz**

- [ ] Keine quadratische Kameraannahme mehr im Renderer.
- [ ] Ein LOD-Wechsel an der Schwelle erzeugt genau einen Wechsel, nicht mehrere.
- [ ] Der Hintergrund ist bei leerer Szene sichtbar und nicht schwarz.
- [ ] Die bestehende Casino-Kamera bleibt im Bild unverändert.
- [ ] Sichtabnahme: Weltgrenzen, Parallaxe und genau ein LOD-Wechsel am
      Rand; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `getBounds()` liefert `Bounds`, nicht `Rectangle`; für
`contains()` `.rectangle` verwenden. Keine Bounds-Abfrage pro Frame; Weltgrenzen
sind bekannt und werden einmal gesetzt. `isRenderGroup` nur für stabile
Hintergrundebenen.

### R7 — Stadtansicht an S2-12 anbinden

**Ziel:** Der vorhandene Stadtkern wird sichtbar. **S2-12 ist die offene
Roadmap-Aufgabe für das Stadtnetz**; R7 dupliziert sie nicht, sondern liefert
die Renderer-Schicht und den lokalen Bildbeleg dafür. Kein zweiter Stadtzustand,
kein Test-only-Renderer.

**Dateien:** `src/core/sim/city-exterior.ts`, `src/core/sim/city-scene.ts`,
`src/core/sim/building.ts`, `src/core/sim/room-transition.ts`,
`src/ui/city-popup.tsx`, neu `src/render/city/` (`city-world.ts`,
`city-ground.ts`, `city-buildings.ts`, `city-doors.ts`),
`src/render/__tests__/city-world.test.ts`.

**Belegstand 2026-11-12 (D5):** `createCityScene()` projiziert jetzt das
kanonische `createCityExteriorModel()` (60x60, vier Fassaden, fuenf
Strassenrequisiten) in `world.cityScene`; `buildView` reicht `cityExterior` an
den Renderer, `CityExteriorLayer` zeichnet Fassaden/Requisiten mit benannten
Rollen und echten SVG-Texturen, `FloorView` aktualisiert sie pro Frame und
`areasForSize` teilt 60x60 in vier 30er-Chunks. Kamera-Grenzen kommen aus
`worldBoundsOf` (echte 60x60-Kante), nicht aus der 30er-Vorlage. Die vier
`DOOR`-Kanten aus `layout.edges` werden als eigene Rolle `DOOR` mit der
Schwellen-SVG `environment/floor/city/doors/door.svg`, Fußanker-Tiefe und
Renderplan-Eintrag gezeichnet; V-Kanten teilen dieselbe Textur gedreht.
Deterministisch belegt durch `src/render/__tests__/city-exterior.test.ts`
(Produktions-Entry `createWorld` → `SceneCommands.enterCity` → `buildView` →
Renderplan), inkl. 60x60-Navigation und Türflaechen. Die vier `DOOR`-Kanten
sind jetzt klickbar: `resolveHit` liefert die Tür-ID, `buildDoorActions` die
Aktion, `SceneCommands.enterStreetDoor` den bestehenden Übergang. Seit dem Requisiten-Slice
sind die fünf Straßenrequisiten zusätzlich über ihren Footprint solide (Bank
2×1, übrige 1×1); `city-props-solid.test.ts` belegt die belegten Kacheln und
den Weg um die Bank. **Noch offen:** echter
Browser-Screenshot, Tuerklick ueber `floor-hit`, DOM-/Screenreader-Zugang,
WorldManager und der vollstaendige S2-12-Uebergang. Diese Punkte bleiben
bewusst unabgehakt.

**Aufgaben**

- [x] **S2-12 bleibt der Kern:** Das Stadtnetz und die Ortskanten kommen aus
      `city-scene.ts`/`city.ts`; R7 baut keinen zweiten Szenengraphen und keine
      zweite Wegewahrheit. *(belegt: `cityScene.layout` ist die direkte
      Exterieur-Projektion; alte 30x30-Portale entfernt)*
- [x] `CityExteriorModel` als Adapter aus `createCityExteriorModel()` lesen;
      der Renderer importiert keine Test-Fixtures und keine UI-Popup-Daten.
      *(belegt: `snapshot.ts` → `GameView.cityExterior`; Test durch
      `SceneCommands.enterCity`)*
- [ ] `city-popup.tsx` und die alte `city-scene`-Darstellung auf den Adapter
      umstellen oder als Menüzugang stilllegen; keine parallele Stadtansicht.
- [x] Straßen, Gehwege, Kreuzungen, Laternen, Gebäude und Türen aus dem Modell
      rendern; Tiefe über Fußanker, nicht über Namenssortierung.
      *(belegt: Straßen/Gehwege/Kreuzungen kommen als Bodenmaterialien aus
      `layout.floor`; `CityExteriorLayer` + `cityRenderPlan` zeichnen vier
      Fassaden, fuenf Requisiten mit Footprint und vier `DOOR`-Kanten mit
      Rollen/Texturen und `depth.set(..., 'prop', ...)`)*
- [x] Straßenrequisiten belegen ihren Footprint im Navigationsraster; Bild und
      Weg teilen dieselbe Kachelmenge. *(belegt: `city-props-solid.test.ts`)*
- [ ] `WorldManager` mit genau einer aktiven Welt einführen. `GameView` bleibt
      der Zustand; der Stadt-Adapter liest und schreibt nur die vorhandenen
      Übergänge.
- [x] Türen an bestehende `floor-hit`-/`floor-actions`-Pfade anschließen; kein
      zweiter Input-Listener und keine zweite Kollisionswahrheit. Die
      Wohnungstür ist mit S2-07 bereits verifiziert und wird nicht neu gebaut.
      *(belegt: `city-door-click.test.ts`: Treffer, Aktion, Szene/Stadtort)*
- [ ] Tastatur-/Screenreader-Zugang für Türen und Orte: DOM-Overlay mit
      `aria-label` oder Pixi-Accessibility mit `accessibleTitle`/`tabIndex`.
- [ ] Test: Stadtmodell wird ohne Test-Fixture gerendert; Tür öffnet den
      bestehenden Raumwechsel; kein doppelter Actor nach dem Wechsel.

**Akzeptanz**

- [x] `city-exterior`/`city-scene` haben einen Produktionsaufrufer außerhalb
      von `src/core/sim`; die offene S2-12-Aufgabe bleibt die einzige Quelle
      für das Stadtnetz.
      *(belegt: `SceneCommands.enterCity` → `buildView` → `GameView.cityExterior`
      → `cityRenderPlan`/`FloorView`)*
- [ ] Ein Lauf nutzt die bestehende S2-07/S2-12-Übergangskette, ohne Teleport
      und ohne Duplikat; das ist der S2-08-Browserbeleg.
- [ ] Die Stadt ist im lokalen Bildgate als Straßenraum erkennbar, nicht als
      Platzhalterfläche.
- [ ] Ein nicht begehbarer Ort ist sichtbar als Kulisse markiert, nicht als
      Tür.
- [ ] Sichtabnahme: Straßenraum und Türen im Stadt-Adapter, kein Teleport;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Die Stadt ist ein `Container` mit sortierbaren Kindern für
Tiefe; `sortableChildren` nur dort, nicht global. `Sprite`-Leaves bleiben
Leaves. Kein `Application` pro Stadt, kein zweiter Ticker, kein `cacheAsTexture`
auf animierten Häusern.

### R8 — Stadt-Assetpaket und Weltmetadaten

**Ziel:** Die Stadt bekommt nur die Assets, die eine benannte Rolle erfüllen,
mit Welt-, Skalierungs- und Rechteangaben.

**Dateien:** `src/render/assets/manifest.json`,
`src/render/assets/__tests__/asset-semantics.test.ts`, neu
`src/render/city/city-assets.ts`, `content/`-Metadaten nur falls vorhanden.

**Aufgaben**

- [ ] Rund 30 Stadtassets aus dem Audit auf Rollen prüfen: Straße, Gehweg,
      Kante, Fassade, Dach, Tür, Fenster, Laterne, Baum, Bank, Müll, Schild.
- [ ] Jedes neue Asset erhält `role`, `world`, `displayScale` (ganzzahlig) und
      `license`; fehlende Felder sind ein Fehler, kein Default.
- [ ] Nicht genutzte Assets nicht „für später“ laden; Boot-Budget und
      Bundles nach messbarem Bedarf.
- [ ] Straßenmaterialien aus R4 wiederverwenden, nicht als zweite
      Materialtabelle duplizieren.
- [ ] Test: jede Asset-ID ist eindeutig; jede Rolle hat eine Textur; jedes
      Pflichtfeld ist gesetzt; kein Asset außerhalb der erlaubten Welt.

**Akzeptanz**

- [ ] Kein Stadtasset ohne Rolle und Welt.
- [ ] Die Boot-Requests steigen nicht unkontrolliert; die Zahl steht im
      lokalen Messbericht.
- [ ] Die Rechteangabe ist pro neuem Asset vorhanden oder der Einsatz ist
      blockiert.
- [ ] Ein Asset mit falscher `displayScale` wird vom Test abgelehnt.
- [ ] Sichtabnahme: Stadtassets mit Rolle, Welt und Skalierung sichtbar
      korrekt; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Assets über `Assets.load`/Manifest laden, nicht über
`Texture.from(url)`. `Assets`-Cache bewusst halten; kein `Assets.reset()` pro
Szene. Bei Bundle-Wechsel `Assets.unloadBundle`, nicht alles global leeren.

### R9 — Stadtleben: NPCs, Türen und Begegnungen

**Ziel:** Die headless vorhandenen Tagespläne und Begegnungen werden sichtbar,
ohne eine zweite Simulation zu bauen.

**Dateien:** `src/core/sim/npc-schedule.ts`, `npc-needs.ts`,
`social-encounter.ts`, `actor-continuity.ts`, neu
`src/render/city/city-actors.ts`, `src/render/__tests__/city-actors.test.ts`.

**Aufgaben**

- [ ] NPCs aus `npc-schedule`/`npc-needs` positionieren; kein eigener
      Zufallsstrom und keine eigene Uhr.
- [ ] Wege über die vorhandene Stadtkollision; Türen nutzen den bestehenden
      Raumwechsel.
- [ ] Actor-LOD aus R3 wiederverwenden; Stadt und Innenraum teilen die
      Actor-Darstellung.
- [ ] Begegnungen aus physischer Nähe an das bestehende
      `social-encounter`-Ergebnis binden; keine Renderer-seitige Beziehung.
- [ ] Sichtbare Reaktionen nur aus vorhandenen Facts/Beziehungen; kein neues
      Save-Feld.
- [ ] Test: zwei NPCs mit gleichem Plan kollidieren nicht; ein Türwechsel
      erhält die Actor-ID; eine Begegnung erzeugt genau ein Fact.

**Akzeptanz**

- [ ] Ein NPC läuft sichtbar von A nach B und verschwindet nicht an der Tür.
- [ ] Actor-IDs bleiben über den Raumwechsel stabil.
- [ ] Kein doppelter NPC nach Re-Entry.
- [ ] Die Begegnung ist im Bild und im bestehenden Fact-Log belegt.
- [ ] Sichtabnahme: NPC-Weg, Türwechsel und Begegnung in einem Lauf;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Viele Actors als `Container` mit `Sprite`-Leaves; bei
hunderten Figuren `ParticleContainer` nur für statische, gleichartige Sprites
prüfen, nicht für individuelle Rigs. Keine EventListener pro Frame neu binden.

### R10 — Wohnung: Render-Abnahme für S2-09–S2-11

**Ziel:** Die offenen Wohnungs-Tasks S2-09 (Wände), S2-10 (eigene Möbel) und
S2-11 (warmes Dekor) werden im Renderer abgenommen. R10 plant diese Features
nicht neu und legt keine konkurrierenden Roadmap-Zeilen an; fehlende Arbeit
gehört in die jeweilige S2-Aufgabe.

**Dateien:** `src/core/sim/player-apartment.ts`,
`src/core/sim/room-transition.ts`, `src/render/room-art.ts`,
`src/render/floor-material.ts`, `src/render/scene-cache.ts`,
`src/render/__tests__/apartment-render.test.ts`.

**Aufgaben**

- [ ] S2-09 abnehmen: Wände, Türrahmen und Occlusion aus `wall-art.ts`/
      `wall-occlusion.ts` müssen im Wohnungsbild sichtbar sein. Fehlt etwas,
      wird S2-09 repariert, nicht R10 erweitert.
- [ ] S2-10 abnehmen: Bett, Schrank, Kochnische, Bad und Sofa nutzen eigene
      Wohnungs-Sprites statt Casino-Möbel; die Interaktionen bleiben erhalten.
- [ ] S2-11 abnehmen: Teppich, Lampen, Bilder und Pflanzen folgen der warmen
      Wohnungspalette; kein Neon und kein Automat.
- [ ] Die bereits vorhandene Wohnungs-Palette (`FloorTheme = 'apartment'`,
      Szene im Cache-Schlüssel) als Integrationspfad prüfen; keine zweite
      Materialtabelle und kein zweiter Szenencache.
- [ ] Boden/Wand/Licht aus R4/R5 wiederverwenden; die Haustür bleibt an den
      bestehenden Stadtübergang angebunden.
- [ ] Test: Layout stimmt mit dem Kern überein; Tür führt auf die Straße; kein
      Teleport; Rückweg erhält den Zustand.

**Akzeptanz**

- [ ] S2-09, S2-10 und S2-11 sind abgehakt oder ausdrücklich als offen an die
      jeweilige Roadmap-Zeile zurückgegeben; R10 behauptet keine eigene
      Feature-Implementierung.
- [ ] Die Wohnung ist als eigener Raum sichtbar; der Startpfad bleibt der
      verifizierte S2-07-Pfad.
- [ ] Möbelrollen sind eindeutig; kein Möbelstück wird als Deko geraten.
- [ ] Lokales Bildgate zeigt alle vier Bereiche.
- [ ] Sichtabnahme: alle vier Wohnbereiche und die Tür zur Straße;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Innenraum top-down, keine isometrische Projektion mischen.
Wände als Tiefenobjekte mit Fußanker; Occlusion nicht über `zIndex` aus Namen.

### R11 — Lauf- und Richtungsanimation

**Ziel:** Figuren bewegen sich lesbar, ohne das Rig zu verdoppeln.

**Dateien:** `src/render/guest-rig.ts`, `src/render/actor-silhouette.ts`,
`src/render/entity-sync.ts`, neu `src/render/__tests__/actor-locomotion.test.ts`.

**Aufgaben**

- [ ] Vier Laufframes je Personafamilie und zwei Richtungen; Richtung aus
      Geschwindigkeit, nicht aus einem separaten Zustand.
- [ ] Animation aus Tick/Fortschritt, nicht aus `Date.now()`; deterministisch.
- [ ] Stillstand fällt auf das Standbild zurück; kein Flackern an der
      LOD-Schwelle.
- [ ] Silhouette und Rig teilen dieselbe Actor-ID und dieselbe Position.
- [ ] Test: vier Frames, zwei Richtungen, deterministische Frame-Wahl;
      Stillstand erzeugt keinen Lauframe.

**Akzeptanz**

- [ ] Eine Figur läuft sichtbar in beide Richtungen.
- [ ] Zwei gleiche Ticks erzeugen denselben Frame.
- [ ] Kein zusätzlicher Actor durch den Animationswechsel.
- [ ] Das lokale Bildgate zeigt Lauf und Stillstand.
- [ ] Sichtabnahme: Lauf in beide Richtungen und Stillstand im selben
      Zustand; Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** `AnimatedSprite` ist ein Leaf und benötigt eine
Spritesheet-Textur; keine manuelle Textur pro Frame aus URLs. `Ticker` nur der
eine App-Ticker; keine `setInterval`-Animation.

### R12 — Ambient und Wetter

**Ziel:** Die Stadt atmet, ohne die Spielregeln zu übernehmen.

**Dateien:** neu `src/render/city/ambient.ts`,
`src/render/city/weather.ts`, `src/render/__tests__/ambient-director.test.ts`.

**Aufgaben**

- [ ] Ambient-Director mit festem Seed und Tageszeit aus der bestehenden Uhr.
- [ ] Drei bis fünf Ambient-Zustände (Tag, Abend, Nacht, Regen, Nebel) nur als
      Darstellung; keine Wirtschafts- oder NPC-Regel im Renderer.
- [ ] Wetter partikelarm und gepoolt; keine Allokation pro Frame, kein
      unbegrenztes `Graphics`.
- [ ] Reduzierte Bewegung respektieren (`prefers-reduced-motion`), Ambient
      abschaltbar.
- [ ] Test: gleicher Seed und gleiche Tickzahl ergeben denselben Zustand; kein
      Wetterzustand schreibt in den Spielzustand.

**Akzeptanz**

- [ ] Ambient ist deterministisch und abschaltbar.
- [ ] Kein Wettereffekt ändert Ledger, NPC-Plan oder Save.
- [ ] Die Szene bleibt bei 60 fps im lokalen Messlauf; keine neue
      Dauerallokation.
- [ ] Lokales Bildgate zeigt mindestens Tag und Nacht.
- [ ] Sichtabnahme: Tag/Nacht und reduced motion ohne Zustandsänderung;
      Screenshot, Konsole und Probe nach Abschnitt 8.

**PixiJS-Falle:** Partikel nur mit `ParticleContainer`, wenn es viele
gleichartige Sprites sind; sonst gepoolte `Sprite`-Leaves. Kein
`BlurFilter` pro Frame neu erzeugen; Filterressourcen wiederverwenden.

## 5. PixiJS-v8-Guardrails

Diese Regeln sind für alle Phasen verbindlich. Sie verhindern die häufigsten
falschen Implementierungen, die in den angehängten Plänen noch als v7-Muster
stehen könnten.

- **Application:** `const app = new Application(); await app.init({...});`
  Danach `app.canvas` verwenden. Keine Options im Konstruktor, kein
  `app.view`.
- **Hierarchie:** `Container` gruppiert; `Sprite`, `Graphics`, `Text`, `Mesh`
  sind Leaves. Keine Kinder an Leaves hängen.
- **Tiefe:** `sortableChildren` nur auf dem Tiefen-Container; `zIndex` aus
  Fußanker/explizitem Depth-Wert, nicht aus Labels.
- **Bounds:** `getBounds()` liefert `Bounds`; für Rectangle-Methoden
  `.rectangle`. Keine Bounds-Abfrage pro Frame, wenn die Weltgrenzen bekannt
  sind.
- **Events:** `eventMode = "static"` plus `cursor` und ggf. `hitArea`. Für Drag
  `globalpointermove`, nicht `pointermove`. `buttonMode`/`interactive` sind
  keine neuen APIs.
- **Assets:** `Assets.load`/`Assets.get`; `Texture.from(url)` lädt nicht.
  Pixelkunst mit `scaleMode: "nearest"`. Bundles/Unload nur bei echten
  Szenenwechseln.
- **Caching:** `cacheAsTexture()` statt `cacheAsBitmap`; vor `destroy()` wieder
  deaktivieren. Nicht auf animierte Stadtteile anwenden.
- **RenderGroups:** `isRenderGroup` nur für stabile, große Teilbäume. Kein
  pauschales RenderGroup um Szenen, deren Kinder animiert werden.
- **Accessibility:** Canvas allein ist kein Screenreader-Beleg. DOM-Overlay
  oder Pixi-Accessibility mit `accessibleTitle`, `accessibleHint`,
  `tabIndex`; Tastaturpfad testen. `AccessibilitySystem` wird erst nach Tab
  aktiv, wenn `enabledByDefault` nicht gesetzt ist.
- **Farben:** `Color`/`Color.shared` für Konvertierung; keine neuen Rohfarben
  im Kern. `blendMode` an Kindern, nicht an der Gruppe mit gemischten Modis.
- **Umgebung:** Browser bleibt der Zielpfad. Kein `DOMAdapter`-Umbau ohne
  konkreten Worker-/SSR-Bedarf; kein Node-Renderer als Ersatz für den
  Browserbeleg.
- **Performance:** ein `Application`, ein Ticker, keine Allokation pro Frame,
  keine `setInterval`-Schleife, keine unbegrenzten Graphics-Listen.

## 6. Meilensteine

Die Meilensteine sind Exit-Punkte, keine Kalenderdaten. Ein Meilenstein ist erst
erreicht, wenn alle genannten Phasen ihr Akzeptanz- und Sichtabnahme-Ergebnis
haben; ein grüner Einzeltest reicht nicht. Die Roadmap führt dieselben IDs als
grobe Produkt-Etappen (R-0 bis R-4), dieser Plan bleibt die Detail-Todo.

| ID | Name | Phasen | Exit-Kriterium | Roadmap |
| --- | --- | --- | --- | --- |
| M0 | Wahrheit und Bildgate | R0–R1 | Baseline, Rollen, Rechte und vier reproduzierbare Szenen sind belegt; kein Cloud-Gate | R-0 |
| M1 | Ehrlicher Casino-Render | R2–R6 | Platzhalter, Figuren, Materialien, Licht und Kamera bestehen Akzeptanz und Sichtabnahme; kein grüner Fallback | R-1 |
| M2 | Stadt sichtbar | R7–R8 | Der bestehende S2-12-Stadtkern ist als Straßenraum sichtbar, Türen nutzen den bestehenden Wechsel, Assets haben Rollen | R-2 |
| M3 | Stadt lebt, Wohnung abgenommen | R9–R10 | NPCs, Türen und Begegnungen sind sichtbar; S2-08 ist im Browser belegt; S2-09–S2-11 sind abgehakt oder offen zurückgegeben | R-3 |
| M4 | Bewegung und Ambient | R11–R12 | Laufframes und Ambient sind deterministisch, reduced-motion-fähig und im lokalen Messlauf stabil; darf zurückgestellt werden | R-4 |

M0 ist die Basis für jede Aussage über den Renderzustand. M1–M3 sind die
Release-Blocker der Phase 3R. M4 ist die letzte P2-Ausbaustufe und darf
zugunsten von M1–M3 zurückgestellt werden. R7 kann erst starten, wenn S2-12
vorliegt; R10 kann erst abschließen, wenn S2-09–S2-11 belegt oder ausdrücklich
zurückgegeben sind.

## 7. Roadmap-Kopplung

Die Roadmap ist die Produktquelle, dieser Plan die Ausführungsquelle. Es gibt
keine dritte Statusliste und keine stillen Statuswechsel. Die Kopplung ist
verbindlich:

| Plan | Roadmap-Zeile | Statusführer |
| --- | --- | --- |
| R0–R1 / M0 | R-0 | Plan-Checkbox und Bildgate-Beleg; Roadmap erst bei M0 |
| R2–R6 / M1 | R-1 | Plan-Checkboxen je Phase; Roadmap erst bei M1 |
| R7–R8 / M2 | R-2 | Plan-Checkboxen je Phase; Roadmap erst bei M2 |
| R9–R10 / M3 | R-3 | Plan-Checkboxen je Phase; Roadmap erst bei M3 |
| R11–R12 / M4 | R-4 | Plan-Checkboxen je Phase; Roadmap erst bei M4 oder Zurückstellung |

**Regeln für die gemeinsame Bearbeitung**

- Eine Änderung an Reihenfolge, Abhängigkeit oder Umfang wird im selben Commit
  in diesem Plan und in der Roadmap-Zeile nachgezogen. Keine neue,
  konkurrierende Roadmap-Zeile für dieselbe Arbeit.
- `S2-*`-Zeilen bleiben die Quelle für Spielumfang. R7 und R10 dürfen sie
  referenzieren und im Renderer abnehmen, aber nicht durch eigene
  Feature-Zeilen ersetzen.
- `PR-07` und `S2-08` bleiben offen, bis der vollständige Browserbeleg
  vorliegt. Einzelne Slice-Screenshots sind Belege auf dem Weg dorthin, kein
  automatischer Abschluss.
- Ein Meilenstein wird in der Roadmap erst `erledigt`, wenn die Sichtabnahme
  aus Abschnitt 8 vorliegt; `verifiziert` braucht den Browserbeleg ohne neuen
  Code. Die Detailstatuses R0–R12 bleiben ausschließlich in diesem Plan.
- Generierte Roadmap-Bestandteile werden über `node scripts/sync-generated.mjs`
  gepflegt, nie per Hand. Die Statusentscheidung selbst bleibt eine bewusste
  Doku-Änderung mit Beleg.

## 8. Preview-Sichtabnahme im lokalen Dev-Server

Gilt für jeden sichtbaren Slice R2–R12. R0 und R1 liefern Baseline und
Bildgate; R1 ist kein Ersatz für die Sichtabnahme.

**Regel:** Der Agent führt die Abnahme nach der Implementierung des Slices und
vor dem Abhaken der Phase selbst durch. Ein Unit-Test, ein Pixel-Diff oder ein
grüner Build ohne Browserbeleg ist kein Phasenabschluss.

**Ablauf**

1. `pnpm run dev` starten (Vite, `http://localhost:3000`; kein Cloud-Runner).
2. Deterministischen Zustand herstellen: frischer Spielstand bzw. benannter
   Seed, Szene und Tick; Viewport 1024×768, DPR 2. Keine manuell veränderten
   Spielstände als Beweis.
3. Vorher/Nachher mit dem vorhandenen GameScout-/Playwright-Pfad
   (`packages/gamescout`) aufnehmen; kein zweiter Browser-Stack, kein neuer
   Prozess pro Szene.
4. Konsole, Page-Errors und fehlgeschlagene Requests prüfen: null Fehler.
5. Simulationswahrheit über `window.__rbdProbe` prüfen (`getOverview`,
   `getFurniture`, `compareRenderAndSim`); wenn die Probe für den Slice nicht
   verfügbar ist, den Grund im Beleg nennen und den zustandsbezogenen Test
   zusätzlich ausführen.
6. Screenshot unter `docs/screenshots/current/` mit der nächsten freien Nummer
   und sprechendem Slice-Namen ablegen; Vorher/Nachher unter
   `docs/screenshots/comparison/` mit Version und Slice. Bestehende Bilder
   werden nicht überschrieben.
7. Im Phasenbeleg `PASS`, `FAIL` oder `INCONCLUSIVE` eintragen, mit
   Screenshot-Pfad, Szenen-/Tick-Angabe, Konsolenstatus und Probe-Ergebnis.
8. Bei `FAIL`/`INCONCLUSIVE`: Phase bleibt offen; kein Baseline-Update und kein
   Weiterhaken. Erst reparieren, dann erneut aufnehmen; kein Retry-Loop.

**Kein Gate:** Die Sichtabnahme läuft nicht in `ci:local`, `verify:all`, einem
GitHub-Workflow oder als Screenshot-Pflicht in jedem Test. Sie ist der
Abschlussbeleg des Slices, nicht ein zweiter Testpfad.

**Sichtbare Slice-Matrix**

| Phase | Preview-Zustand | Muss sichtbar sein | Beleg |
| --- | --- | --- | --- |
| R2 | Casino, unbekanntes Möbel | Gestrichelte Kontur, Rollen-/Assetname, kein `0x2dd4a0` | `docs/screenshots/current/16-r2-platzhalter.png` |
| R3 | Casino, Gast nah und fern | Silhouette als Person, kein 6×6-Pin, LOD-Wechsel ohne Duplikat | `docs/screenshots/current/17-r3-silhouette.png` |
| R4 | Casino, Raum mit Teppich | Sechs unterscheidbare Materialien, genau ein Bodenknoten | `docs/screenshots/current/18-r4-materialien.png` |
| R5 | Casino, Lichtquellen | Lichtfläche und sichtbare Quelle, keine Ellipsen | `docs/screenshots/current/19-r5-licht.png` |
| R6 | Casino, Zoom/Pan an der Weltgrenze | Weltgrenzen, Parallaxe, genau ein LOD-Wechsel | `docs/screenshots/current/20-r6-kamera.png` |
| R7 | Stadt, Straße und Tür | Straßenraum, Türen, kein Teleport, kein zweiter Stadtgraph | `docs/screenshots/current/21-r7-stadt.png` |
| R8 | Stadt, Assetpaket | Rollen, Welten und Skalierung sichtbar korrekt | `docs/screenshots/current/22-r8-stadtassets.png` |
| R9 | Stadt, NPC-Weg, Tür, Begegnung | NPC von A nach B, stabile Actor-ID, ein Fact | `docs/screenshots/current/23-r9-stadtleben.png` |
| R10 | Wohnung, vier Bereiche | S2-09–S2-11 sichtbar; Tür führt auf die Straße | `docs/screenshots/current/24-r10-wohnung.png` |
| R11 | Casino/Stadt, Lauf und Stillstand | Beide Richtungen, deterministischer Frame, kein Duplikat | `docs/screenshots/current/25-r11-lauf.png` |
| R12 | Stadt, Tag und Nacht | Ambient und reduced motion, keine Zustandsänderung | `docs/screenshots/current/26-r12-ambient.png` |

Die Aufnahmen sind Belege für `PR-07` und `S2-08`, schließen sie aber erst,
wenn der vollständige Screenshot-Satz bzw. der vertikale Pfad belegt ist. R10
darf S2-09–S2-11 nur abhaken, wenn deren eigene Akzeptanz vorliegt.

## 9. Prüfpfad und Abschluss je Phase

Jede Phase endet mit dem kleinsten passenden lokalen Nachweis:

1. **Typ/Logik:** `pnpm run typecheck` und der genannte Vitest-Fokus.
2. **Render:** lokales Bildgate aus R1, vier Szenen, dreimal stabil.
3. **Sichtabnahme:** für R2–R12 nach Abschnitt 8; der Beleg gehört zum
   Phasenabschluss.
4. **Doku:** `pnpm run verify:docs` und die betroffenen Referenzen in
   `ROADMAP.md`/`ARCHITECTURE.md`.
5. **Gesamt:** `pnpm run verify:light`; `verify:all` nur, wenn die Phase den
   gemeinsamen Baum oder die Testline berührt.
6. **Kein Cloud-Gate:** kein neuer Workflow, kein `.circleci/`, kein
   `.github/workflows/`, kein Retry um einen roten lokalen Lauf.

**Phasen-Fertig heißt:**

- [ ] Alle Aufgaben der Phase sind abgehakt oder ausdrücklich als
      „zurückgestellt“ mit Grund markiert.
- [ ] Die Akzeptanzliste ist vollständig belegt.
- [ ] Das lokale Bildgate ist grün und der Baseline-Stand ist erklärt.
- [ ] Für R2–R12: Sichtabnahme nach Abschnitt 8 ist `PASS`; Screenshot,
      Konsole und Probe liegen vor.
- [ ] Kein neuer Cloud-/CI-Pfad und keine neue Endlosschleife.
- [ ] Die betroffenen Doku-Stellen sind aktualisiert, nicht nur dieser Plan.
- [ ] Commit und Push sind erfolgt; ein Merge nach `main` braucht eine
      ausdrückliche Anweisung.

## 10. Adversarialer Review

Geprüft gegen den Baum `0.3.233`, die Roadmap-Phase 3R und die lokale
Testlinie. Die Befunde sind eingearbeitet; offene Abhängigkeiten sind
Produktblocker, keine stillen Planannahmen.

| Befund | Risiko | Entscheidung |
| --- | --- | --- |
| Plan nannte `0.3.232`, `main` steht auf `0.3.233` | Baseline driftet vor dem ersten Lauf | Stand und R0 auf `0.3.233`; R0 misst den echten Baum neu |
| R3/R4/R5 sollten parallel nach R1 laufen, R4 verlangt aber R2 | falsche Reihenfolge | R3/R5 parallel nach R1; R4 nach R2 |
| R1 definierte drei Szenen, R10 verlangt vier Wohnbereiche | kein Wohnungsbaseline | R1 nimmt vier Szenen inklusive Wohnung auf |
| Meilensteine standen nur als Prosa | kein gemeinsamer Exit | M0–M4 mit Exit-Kriterien und Roadmap-Zuordnung |
| Keine Agent-Sichtabnahme war verlangt | grüner Test bei falschem Bild | Abschnitt 8 ist für R2–R12 verbindlich |
| `PR-07`/`S2-08` sind offen, aber Screenshots waren geplant | Scheinabschluss | Aufnahmen sind Belege, Status bleibt bis zum Vollbeleg offen |
| Sichtabnahme könnte zum Gate werden | Testline wird langsamer | ausdrücklich nicht in `ci:local`, `verify:all` oder Cloud |
| Roadmap und Plan konnten auseinanderlaufen | zwei Statuswahrheiten | Abschnitt 7: eine Statusquelle, Änderung im selben Commit |
| R7 wartet auf S2-12; R10 auf S2-09–S2-11 | Meilenstein blockiert | explizite Abhängigkeit, keine neue konkurrierende Roadmap-Zeile |

**Nicht als Planfehler gewertet:** R0 bleibt framework-frei und R1 ist kein
Cloud-Gate. Die Bildgate-Szenen sind bewusst lokal und werden nicht in die
reguläre Testline gehängt. Die offenen S2-Abhängigkeiten bleiben offen, bis
ihre eigenen Belege vorliegen.

## 11. Nicht in diesem Plan

- Kein Rewrite der Simulation und kein neues Save-Schema ohne eigenen
  Migrationsnachweis.
- Kein neuer Cloud-Runner, kein GitHub-Workflow und kein Screenshot-Gate in
  `ci:local`.
- Keine 418 ungenutzten Assets „vorsorglich“ laden.
- Keine Stadtökonomie, keine neue NPC-KI und keine neue Narrativmaschine.
- Keine v7-Pixi-Muster (`beginFill`, `cacheAsBitmap`, `Texture.from(url)`,
  `new Application({...})`, `app.view`).

## 12. Referenzen

- [`ROADMAP.md`](ROADMAP.md) — Produktreihenfolge, offene Punkte, Phasen 1–7.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Zustandsbesitz, Render-Grenzen,
  Living-World-Leitentscheidungen.
- [`TESTING.md`](TESTING.md) — lokale Testline und Mechanik-Tests.
- [`CI.md`](CI.md) — lokale Required-Gates; dieser Plan fügt kein Cloud-Gate
  hinzu.
- [`packages/gamescout/AGENTS.md`](../packages/gamescout/AGENTS.md) — lokaler
  Browser-/Screenshot-Pfad und Sichtwahrheit.
- [`screenshots/current/`](screenshots/current/) — kanonischer Satz für die
  Sichtabnahmen; Vergleichsbilder liegen unter `screenshots/comparison/`.
