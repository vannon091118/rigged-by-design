# Roadmap — Spiel und Präsentation

<!-- rbd-doc: managed -->

**Zweck:** Diese Datei ist die einzige Planung für das Spiel und seine Präsentation.
Jede Zeile nennt den Code, den Test oder das Bild, an dem die Arbeit weitergeht.
Abgeschlossenes bleibt als Beleg stehen, bis es ins Changelog wandert.

**Stand:** 2026-11-12 · Version `0.3.242`

## Lesart

| Bereich | Gehört hierher | Liegt in |
| --- | --- | --- |
| **Spiel** | Simulation, UI, Inhalte, Save, Balance, Abnahme im Browser | `src/`, `content/`, `public/` |
| **Präsentation** | `README.md`, Screenshots, Banner, Alt-Texte, Release-Bilder | `README.md`, `docs/screenshots/`, `docs/banners/` |
| **Governance** | Lanes, Claims, Gates, CI, Freeze, Doku-Pflichten | `AGENTS.md`, `docs/GOVERNANCE.md`, `docs/WORKFLOW.md`, `docs/CI.md` |

**Governance ist kein Gegenstand dieser Datei.** Hier steht keine Aufgabe, die nur
über eine Governance-Lane geändert werden darf; umgekehrt nennt keines der genannten
Dokumente eine Spiel- oder Präsentationsaufgabe. Vermischte Bezeichnungen sammelt
[`FLAG.md`](FLAG.md).

**Status:** `erledigt` (Code und Test vorhanden), `verifiziert` (belegt, kein neuer Code
nötig), `offen`, `blockiert`, `zurueckgestellt`.

**IDs:** `S<phase>-<nr>` für Spiel, `PR-<nr>` für Präsentation, `R-<nr>` für
den Render-Querschnitt, `M0–M4` für die Exit-Meilensteine des Render-Plans,
`P-13` als fortgeschriebene Bestands-ID für den Textbaustein-Fortschritt.

## Jetzt — Das Spiel trägt den ersten Abend

### Phase 1 — Erster Abend (P0)

Ziel: Ein neuer Spieler sieht genau einen Einstieg, ein Ziel und einen Gast, den er
auch bedienen kann.

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| S1-01 | Genau ein Startzustand: Eröffnung, dann Wohnung, dann Stadt und Raum | erledigt | `src/ui/opening-card.tsx`, `src/ui/onboarding-panel.tsx`, `src/store/__tests__/onboarding-save.test.ts` | Zwei Modals überlagern sich nie; alte Saves laden als `DONE` |
| S1-02 | Genau ein sichtbares Ziel im HUD | erledigt | `src/ui/goal.ts`, `src/ui/__tests__/goal.test.ts` | Erst Barkauf, dann Miete; Anzeige leitet nur aus dem Snapshot ab |
| S1-03 | Ein Startzustand ohne schwarze Balken | erledigt | `src/ui/floor-feedback.tsx`, `src/ui/__tests__/world-first-ui.test.tsx` | Der Plan liegt auf einer Bühne, nicht in einem Loch |
| S1-04 | Erster Gast nur mit Kasse und erreichbarem Weg | erledigt | `src/core/sim/spawn.ts`, `src/core/sim/demand.ts`, `src/core/sim/__tests__/spawn-demand.test.ts` | Ohne Kasse entstehen weder Gast noch PRNG-Verbrauch |
| S1-05 | Kettentest Erster Abend | verifiziert | `src/store/__tests__/first-evening.test.ts` | Eröffnung, Szene, Kiste, Gast, Spiel, Buchung, Tagesende in einem Lauf |
| S1-06 | Starter-Kiste führt sichtbar zum ersten Automaten | offen | `src/store/new-game.ts`, `src/ui/goal.ts`, `src/store/__tests__/first-evening.test.ts` | Der Gast kommt an und findet ein Gerät vor, nicht `GERÄTE 0/0` |
| S1-07 | Slot-Wahrheit: exakte Linien-Erwartung und kein eigener Über-100-%-Spin | erledigt | `src/core/games/engines/slot-models.ts`, `src/core/games/slot-profile.ts`, `src/core/sim/__tests__/own-play.test.ts` | `lineStats` ist die einzige Erwartung; eigene Spins über 10.000 bps buchen nicht |
| S1-08 | Ruhetag und verzögerte Folge überstehen Save/Load | verifiziert | `src/core/sim/__tests__/city-day-closeout.test.ts`, `src/core/sim/__tests__/city-encounter-loop.test.ts` | Tag, Ledger, Beziehung, Frist und PRNG bleiben ohne Tick identisch |

### Phase 2 — Präsentation des ersten Abends (P0)

Ziel: Wer die README öffnet, sieht den heutigen Stand und nicht den von `0.3.114`.

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| PR-01 | README-Aussagen gegen den laufenden Build prüfen | offen | `README.md`, `src/ui/__tests__/first-evening.test.ts` | Jede Aussage hat einen Beleg im Spiel; gestrichen wird, was nicht läuft |
| PR-02 | Screenshot-Satz auf `0.3.231` erneuern | offen | `docs/screenshots/current`, `docs/screenshots/v0.3.132`, `README.md` | Ein Satz zeigt Eröffnung, Ziel, Gast, Automat, Charakter und Smartphone |
| PR-03 | Veraltete Bildsätze entfernen | offen | `docs/screenshots/v0.3.78`, `docs/screenshots/v0.3.114`, `docs/screenshots/comparison` | Nur der aktuelle Satz und ein bewusster Vorher/Nachher-Beleg bleiben |
| PR-04 | Alt-Texte und Banner prüfen | offen | `README.md`, `docs/banner.svg`, `docs/banners` | Jedes Bild beschreibt seinen Zustand, nicht seine Datei |
| PR-05 | Kleinste Viewports bleiben bedienbar | verifiziert | `src/ui/__tests__/small-screen-acceptance.test.tsx`, `src/ui/__tests__/small-screen-layout.test.ts` | 360×640 und 320 px sind belegt |
| PR-06 | First-Frame-Budget der Atlasse | verifiziert | `src/ui/__tests__/phase34-acceptance.test.tsx` | Beide Atlasseiten bleiben unter dem gemeinsamen Budget |
| PR-07 | Sichtprüfung im echten Browser | offen | `docs/screenshots/current`, `README.md`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Die Bilder in der README stammen aus dem Build, den der Tag nennt |

**Ablageregel Screenshots:** `docs/screenshots/current/` ist der kanonische Satz;
versionierte Sätze liegen in `docs/screenshots/v<version>/`; Vorher/Nachher-Belege in
`docs/screenshots/comparison/` mit Version im Dateinamen. Nummerierung folgt dem Weg
durch das Spiel, nicht dem Aufnahmezeitpunkt.

## Als Nächstes — Stadt, Wirtschaft und Inhalte

### Phase 3 — Wohnung als Raum, dann Stadt als Netz (P1)

Der Systemkern der Living World steht bereits headless; offen ist der begehbare Start
und der Browserbeleg.

**Reihenfolge:** erst die Wohnung als echter Raum (S2-09 bis S2-11), danach die Stadt
als Netz zwischen allen Lokationen (S2-12).

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| S2-01 | Wohnungslayout mit Schlaf-, Koch-, Bad- und Wohnbereich | erledigt | `src/core/sim/player-apartment.ts` | Räume, Möbel und Haustür sind ein Layout |
| S2-02 | Physische Straße mit Gehwegen, Kreuzungen und Laternen | erledigt | `src/core/sim/city-exterior.ts`, `src/core/sim/city.ts` | Die Stadt ist ein zusammenhängender Spielraum, kein Menü |
| S2-03 | Gebäude mit ID, Eingang, Öffnungszeit und Innenraumbezug | erledigt | `src/core/sim/building.ts`, `src/core/sim/building-types.ts`, `src/core/sim/__tests__/building.test.ts` | Jedes Gebäude ist eine stabile Entität |
| S2-04 | Deterministische Tagespläne und Bedürfnisse | erledigt | `src/core/sim/npc-schedule.ts`, `src/core/sim/npc-needs.ts`, `src/core/sim/__tests__/npc-schedule.test.ts` | Schlafen, Arbeit, Essen und Freizeit folgen dem Plan |
| S2-05 | Akteur-Kontinuität über Raumgrenzen | erledigt | `src/core/sim/actor-continuity.ts`, `src/core/sim/__tests__/living-world-continuity.test.ts` | Kein Duplikat, kein Respawn beim Raumwechsel |
| S2-06 | Soziale Begegnung aus physischer Nähe | erledigt | `src/core/sim/social-encounter.ts`, `src/core/sim/__tests__/living-world-social-economy.test.ts` | Nähe erzeugt Gespräch, Fact und Beziehungsdelta |
| S2-07 | Wohnung als erster begehbarer Raum im Startpfad | verifiziert | `src/store/new-game.ts`, `src/store/scene-commands.ts`, `src/core/sim/player-apartment.ts`, `src/store/__tests__/new-game.test.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Der Start führt durch die Wohnungstür auf die Straße |
| S2-08 | Sichtbarer Beweis: kein Teleport, keine Duplikate im Browser | offen | `src/core/sim/__tests__/living-world-vertical-slice.test.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Der Vertikalschnitt ist im Browser nachvollzogen, nicht nur headless |
| S2-09 | Wände bauen: Wohnungszonen als Räume | offen | `src/core/sim/player-apartment.ts`, `src/core/sim/nav-grid.ts`, `src/render/wall-art.ts`, `src/render/wall-occlusion.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Jede Wohnzone hat Wände und Türrahmen; Türen bleiben begehbar, Occlusion verdeckt Figuren korrekt |
| S2-10 | Möbel bauen: eigene Wohnungs-Sprites | offen | `src/core/sim/player-apartment.ts`, `src/render/furniture-art.ts`, `src/render/furniture-atlas.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Bett, Schrank, Kochnische, Bad und Sofa nutzen eigene Wohnungs-Assets statt Casino-Möbel; Interaktionen bleiben erhalten |
| S2-11 | Dekor bauen: Wohnungsbild ohne Casino-Symbole | offen | `src/render/room-dressing.ts`, `src/render/art-tokens.ts`, `src/core/sim/player-apartment.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Teppich, Lampen, Bilder und Pflanzen folgen der warmen Wohnungspalette; kein Neon und kein Automat |
| S2-12 | Stadt als Netz: alle Lokationen in einer eigenen Szene | offen | `src/core/sim/city-scene.ts`, `src/core/sim/city.ts`, `src/store/scene-commands.ts`, `src/store/snapshot.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Wohnung, Casino, Kneipe und Markt sind Knoten, ihre Wege sind Kanten der Szene CITY; jeder Ortswechsel läuft über dieses Netz |

### Phase 3R — Render- und Living-World-Rework (Querschnitt, P0/P1)

Der ausfuehrbare Task-Plan steht in [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md).
Die Reihenfolge ist verbindlich: R0–R1 sichern die Wahrheit, R2–R6 haerten den
Casino-Render, R7 macht die Stadtansicht auf dem Stadtkern sichtbar; R8–R12 bauen
darauf auf. **R7 erfindet S2-12 nicht neu, R10 nimmt S2-09–S2-11 ab.** Die Zeilen
hier sind die Produkt-Etappen, nicht die Detail-Todo. Die Abnahme verweist auf
die bestehenden Zeilen S2-07, S2-08, S5-06, S5-07, S5-09 und PR-10; sie werden
hier referenziert, nicht dupliziert.

| ID | Meilenstein | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- | --- |
| R-0 | M0 | Baseline und lokales Bildgate (R0–R1) | offen | `packages/gamescout`, `docs/screenshots/current`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Zahlen, Rechte und vier deterministische Szenen sind belegt; kein Cloud-Gate |
| R-1 | M1 | Casino-Render ehrlich und stabil (R2–R6) | offen | `src/render/furniture-atlas.ts`, `src/render/guest-rig.ts`, `src/render/floor-material.ts`, `src/render/floor-camera.ts` | Kein gruener Fallback, keine Pin-Figur, echte Materialien, Lichtflaeche und echte Weltgrenzen |
| R-2 | M2 | Stadtansicht und Assetpaket (R7–R8) an S2-12 | offen | `src/core/sim/city-scene.ts`, `src/core/sim/city-exterior.ts`, `src/render/city/`, `src/ui/city-popup.tsx`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | R7 rendert den bestehenden S2-12-Stadtkern; kein zweiter Szenengraph, Weg über S2-07/S2-12 ohne Teleport |
| R-3 | M3 | Stadtleben und Wohnungsabnahme (R9–R10) | offen | `src/core/sim/npc-schedule.ts`, `S2-09`–`S2-11`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | NPCs und Türen sind sichtbar; S2-09–S2-11 sind abgehakt oder offen zurueckgegeben; Actor-IDs bleiben stabil |
| R-4 | M4 | Bewegung und Ambient (R11–R12) | zurückgestellt | `src/render/guest-rig.ts`, `src/render/city/ambient.ts` | Laufframes und Ambient sind deterministisch; erst nach R-2/R-3 |

Die Spalte **Meilenstein** ist die Brücke zur Roadmap: M0–M4 sind die
Exit-Punkte aus [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md). Jeder
sichtbare Meilenstein M1–M4 verlangt die Preview-Sichtabnahme des Agents
(lokaler Vite-Dev-Server, Screenshot, Konsole, `window.__rbdProbe`); sie ist
kein Cloud- oder CI-Gate. Ein Meilenstein wird erst `erledigt`, wenn diese
Abnahme vorliegt; die Detailstatuses R0–R12 bleiben im Plan.

### Phase 4 — Wirtschaft, Bereiche und Ereignisse (P1)

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| S3-01 | Modulare Business-Bereiche aus vorhandenen Zonen | erledigt | `src/core/sim/business-areas.ts`, `src/core/sim/__tests__/business-areas.test.ts` | Ein Konto, eine Besuchersimulation, mehrere Bereiche |
| S3-02 | Bar und Gastronomie mit Karte, Bestand und Preis | erledigt | `src/core/sim/bar-service.ts`, `src/core/sim/drink-menu.ts` | Der Gast bestellt nach Durst, die Kasse bucht den Kartenpreis |
| S3-03 | Clubabend in der Lounge | erledigt | `src/core/sim/club-night.ts`, `src/core/sim/__tests__/club-night.test.ts` | Öffnungszeit, Lautstärke und Licht lesen vorhandene Zustände |
| S3-04 | Hybride Besucherströme zwischen Bereichen | erledigt | `src/core/sim/hybrid-flow.ts`, `src/core/sim/__tests__/hybrid-visitor-flows.test.ts` | Ein Gast wechselt Kasse, Bar und Automat in einem Lauf |
| S3-05 | Zentrale Event-Infrastruktur | erledigt | `src/core/sim/venue-event.ts`, `src/core/sim/__tests__/venue-event.test.ts` | Ankündigung, Einlass, Durchführung und Ergebnis sind Phasen einer Instanz |
| S3-06 | Eigene Arena als Ausbau | erledigt | `src/core/sim/arena.ts`, `src/core/sim/__tests__/arena.test.ts` | Stufen aus Journal-Belegen, Geld vom Betriebskonto |
| S3-07 | Wettmarkt auf den Vorkampf | erledigt | `src/core/sim/fight-bets.ts`, `src/core/sim/fight-event.ts`, `src/core/sim/__tests__/fight-bets.test.ts` | Quoten fixiert bei Abgabe, Abrechnung über den Ledger |
| S3-08 | E-Sport-Liga als Ableitung | erledigt | `src/core/sim/esport.ts`, `src/ui/career-esport.tsx`, `src/core/sim/__tests__/esport.test.ts` | Teams, Rollen und Form ohne neues Save-Feld |
| S3-09 | E-Sport an Event- und Wettinfrastruktur anschließen | offen | `src/core/sim/esport.ts`, `src/core/sim/venue-event.ts`, `src/core/sim/fight-bets.ts` | Ein E-Sport-Abend ist eine echte Event-Instanz mit Abrechnung |
| S3-10 | Personal mit Qualifikation und Leistungsbewertung | offen | `src/core/sim/staff.ts`, `src/core/sim/staff-queries.ts` | Jede Rolle hat Auftrag, Blockadegrund und Bewertung |
| S3-11 | Immobilienportfolio und Konzernnetz | offen | `src/core/sim/property.ts`, `src/core/sim/business-areas.ts` | Mehrere Standorte teilen Regeln, bleiben aber getrennte Welten |

### Phase 5 — Inhalte und Erzählung (P1)

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| P-13 | 685 / 1500 gewertete Textbausteine (1030 gesamt; `documentation`, `memory`, `rumor` quota-frei) | offen | `content/narrative/registry/fragments.json`, `scripts/verify-narrative-blocks.mjs` | 1500 gewertete Bausteine, kein gewerteter Pool unter 50, freigestellte Slots mit Befund dokumentiert |
| S4-01 | Neue Pools brauchen einen Leser im Spiel | offen | `scripts/verify-narrative-blocks.mjs`, `src/core/sim/narrative` | Die Prüfung lehnt einen Textpool ohne anzeigendes System ab |
| S4-02 | Geräte-, Lager- und Personal-Facts | offen | `src/core/sim/narrative/facts.ts` | Jeder Fact hat Definition, Template und Leser |
| S4-03 | Narrative Balance messen statt begrenzen | offen | `src/core/sim/__tests__/balance-operating.test.ts` | Die Grenzen haben eine Messreihe, nicht nur einen Deckel |
| S4-04 | Governance-Sätze aus Spieltexten entfernen | verifiziert | `docs/FLAG.md`, `src/core/governance/__tests__/narrative-world-text.test.ts`, `content/narrative/contributions` | Kein Text nennt Claim, Merge, Gate, CI oder PR; Anzahl bleibt bei 1008 |
| S4-05 | Verkettete Narrative mit Ruhephasen und Zusammenführung | verifiziert | `src/core/sim/narrative/chains/chain-runtime.ts`, `src/core/sim/__tests__/narrative-chain-runtime.test.ts` | Start nur aus aufgelösten Events, ruhende Übergänge werden erneut geprüft |
| S4-06 | NPC-Wissen und Gerüchte mit Quellenverlust | verifiziert | `src/core/sim/__tests__/knowledge.test.ts`, `src/core/sim/__tests__/knowledge-relationships.test.ts` | Herkunft, Distanz und Widerspruch bleiben erhalten |

## Später — Abnahme und Release

### Phase 6 — Abnahme, Performance und Geräte (P2)

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| S5-01 | Werkstatt-Einstieg im Browser öffnen | offen | `src/ui/workshop.tsx`, `src/ui/__tests__/editor-gate.test.ts` | Beide Wege (Marke, Tastenkürzel) führen in die Werkstatt |
| S5-02 | Alle sechs Werkstatt-Ziele anklicken | offen | `src/ui/workshop.tsx`, `src/ui/__tests__/editor-tools.test.ts` | Jedes Ziel öffnet seinen erwarteten Zustand |
| S5-03 | Spiegel im Lager mit Save-Roundtrip | offen | `src/store/__tests__/save-roundtrip.test.ts` | Der Spiegel überlebt Speichern und Laden |
| S5-04 | FPS aus echten rAF-Frames | offen | `src/ui/__tests__/phase34-acceptance.test.tsx` | Das Panel zeigt gemessene Frames, keine Schätzung |
| S5-05 | Smartphone als echte Gerätefläche | offen | `src/ui/smartphone.tsx` | Alle vier Fensterzustände sind verglichen |
| S5-06 | Wand-Occlusion visuell belegen | offen | `src/ui/__tests__/world-first-ui.test.tsx`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Depth-Tests plus Browserbeleg |
| S5-07 | First Frame unter 3 s bei Slow 4G | offen | `src/ui/__tests__/phase34-acceptance.test.tsx`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Baseline 22 Requests / 2,42 MB wird unterboten oder begründet |
| S5-08 | Touch, Hülle und APK-Installation | zurueckgestellt | `scripts/prepare-android.mjs`, `docs/LOCAL_CI.md` | Erst nach vollständiger Desktop-Abnahme |
| S5-09 | Release-Horizont: bespielbare Stadt | offen | `src/core/sim/__tests__/living-world-vertical-slice.test.ts`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Mehrere Orte, Wege und Figuren mit Tagesablauf spielbar |

### Phase 7 — Präsentation für den Release (P2)

| ID | Aufgabe | Status | Referenz | Fertig wenn |
| --- | --- | --- | --- | --- |
| PR-08 | Bildsatz je Release versionieren | offen | `docs/screenshots/current`, `README.md` | Jeder Tag hat einen eigenen Satz, kein Bild wird überschrieben |
| PR-09 | README-FAQ gegen den Spielstand prüfen | offen | `README.md`, `src/core/sim/__tests__/money-truth.test.ts` | Keine Antwort verspricht Mechanik, die nicht läuft |
| PR-10 | Bildsprache und Asset-Lizenz belegen | offen | `docs/banners`, `README.md`, [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) | Stilregeln und Herkunft der Bilder stehen nachvollziehbar im Repo |

## Referenzen

- [`README.md`](../README.md) — Präsentation des Spiels.
- [`FLAG.md`](FLAG.md) — vermischte Bezeichnungen und die getrennte Schreibweise.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Zustandsbesitz, Verträge und technische Grenzen.
- [`RENDER_REWORK_PLAN.md`](RENDER_REWORK_PLAN.md) — ausfuehrbare Render- und Living-World-Todo.
- `docs/screenshots/current/` — kanonischer Bildsatz der Präsentation.
