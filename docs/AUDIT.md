# Produkt-Audit rigged-by-design

<!-- rbd-doc: managed -->

**Zweck:** Dauerhafte, evidenzbasierte Bestandsaufnahme des Produkts. Kontrollpunkt ist Issue **#937**; dieses Dokument ist der Nachweis. Jede Zeile nennt Status, Kernbefund, Evidenz, Priorität und Issue. Detailbegründungen, Gegenproben und Nebenbefunde stehen in den Abschnitten A und B.

**Untersuchter Commit:** `52f02ec9150918922ba3720afc1a32da819eb906` (= `origin/main`, `fix(#887): Pin- und State-Vertrag … (#936)`, 2026-11-16 00:23 +0100)
**Bestandsaufnahme:** 2026-11-15/16 · Arbeitsbaum = dieser SHA + fremde WIP zu #809
**Board-Stand:** 96 offene Issues, 3 offene PRs zu Beginn (#933 gemergt während des Laufs), 132 Claims
**Nachtrag 2026-11-18:** Der Prüfstand ist heute grün — `pnpm run verify` (quick, inkl. Suite) und `pnpm run verify:release` laufen auf `a8f6f6fd` durch, offen sind 8 Issues und 0 PRs, #782 ist gemergt. Die Zahlen dieser Bestandsaufnahme gelten für den 15./16.11.

## Methodik

Up-to-Down (A): Produktversprechen → Architektur → Produktionscode. Down-to-Up (B): Implementierung → Abhängigkeiten → Produktwirkung. Jede Frage hat **einen** Status: `BELEGT`, `TEILWEISE BELEGT`, `WIDERLEGT`, `NICHT IMPLEMENTIERT`, `WIDERSPRÜCHLICH`. Es gibt keinen Status „muss geprüft werden“; fehlende Evidenz ist ein Befund mit Issue.

Gemessene Grundlagen dieses Audits:

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm test` (Vollauf) | 422 Dateien, **2 293 Tests: 2 279 PASS, 12 FAIL**, 252,93 s |
| `pnpm run verify:light` | **FAIL** — `check:loc`, `docs`, `catalog`, `generated`, `lint` |
| `verify:capabilities` | PASS — 13 Fähigkeiten, 8 aktiv, **5 unverified** |
| `verify-narrative-blocks` | PASS — **787/1500 gewertet, 1182 gesamt**, 14 Pools ≥ 50 |
| Branch-Schutz (GitHub API) | `enforce_admins: true`, Force-Push/Löschen verboten, **0 Pflicht-Reviews, keine Required-Checks** |
| Gate-Plan (`pipeline-plan.mjs`) | light 11 · dev 12 · fast 15 · quick 15 · full 17 · release 17 · 8 Profile |

**Nachtrag 2026-11-18:** Diese Messwerte sind der Audit-Stand vom 15./16.11. und bleiben als Beleg stehen. Heute sind `verify:light`, `verify` (quick) und `verify:release` grün; die Suite läuft durch.

## Statusverteilung

| Status | Anzahl |
| --- | --- |
| BELEGT | 31 |
| TEILWEISE BELEGT | 57 |
| WIDERSPRÜCHLICH | 8 |
| WIDERLEGT | 1 |
| NICHT IMPLEMENTIERT | 3 |
| **Summe** | **100** |

`WIDERLEGT` bezeichnet Aussagen, die der Baum aktiv widerlegt (z. B. „Test fehlt“ bei existierender Datei, „15 Required-Gates“ bei 16). `WIDERSPRÜCHLICH` bezeichnet zwei gültige Quellen mit unvereinbaren Aussagen.

## Zentrale Übersicht

| ID | Domäne | Status | Kernfinding | Evidenz | Prio | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| UD-01 | Spielkreislauf | TEILWEISE | Startpfad da, Tageskreislauf nicht geschlossen | `new-game.ts`, `scene-commands.ts`, `first-evening.test.ts` | P1 | #780, #810 |
| UD-02 | Motivation | TEILWEISE | Kein Verdienst außerhalb des Casinos | `player-jobs.ts:100`, `player-job-catalog.ts` | P2 | #801, #803 |
| UD-03 | Ziele | TEILWEISE | Fünf Ziele, kein Wechsel zwischen ihnen | `arena.ts`, `property.ts`, `esport.ts` | P2 | #810 |
| UD-04 | Versprechen | WIDERSPRÜCHLICH | Kiste (#782), Anrufe ohne Sim-Ereignis | `use-floor-interaction.ts`, `smartphone.tsx` | P2 | #782, #797 |
| UD-05 | Druck | TEILWEISE | Kein Konkurs-/Endzustand | `openLiability`, `injuryTicks` | P2 | #538 |
| UD-06 | XP | TEILWEISE | Registry ja, Vergabenaht nicht auffindbar | `player-skills.ts:82` | P2 | #801 |
| UD-07 | Skills | TEILWEISE | `service`/`cardDealing` ohne Wirkleser auf main | `floor-work.ts:71`, `actions.ts:64`, `player-skills.ts:65` | P1 | #801, #809 |
| UD-08 | Beruf | BELEGT | Voraussetzungen als Daten | `player-job-catalog.ts`, `player-job-promotion.ts` | — | — |
| UD-09 | Training | NICHT IMPL. | Kein Trainingspfad | grep `trainSkill` = 0 | P2 | #801 |
| UD-10 | Konkurrenz | TEILWEISE | Priorisierung nur für NPCs | `city-life-score.ts`, `city-life-tiebreak.ts` | P3 | #810 |
| UD-11 | NPC-Kette | TEILWEISE | Zwei Identitätsmodelle | `actor-continuity.ts`, `city-life-restore.ts` | P2 | #763 |
| UD-12 | NPC-Entscheidung | BELEGT | Deterministisch, Gründe ungemessen | `city-life-decision/score/tiebreak` | P2 | #840 |
| UD-13 | Ortsgraph | TEILWEISE | Drei Orte-Quellen | `city-network.ts:25/76`, `city-venues.ts` | P2 | #780 |
| UD-14 | Navigation | TEILWEISE | Engpässe ungemessen | `nav-grid.ts`, `pathfinding.ts` | P2 | #840 |
| UD-15 | Bevölkerung | TEILWEISE | Vier Zahlen, keine gemeinsame Zählung | `city-npc-roster.ts`, `visitors`, `guests` | P2 | #822 |
| UD-16 | Facts | BELEGT | Fünf Kausalketten; Smartphone ohne Fact | `narrative/runtime.ts`, `settleMoneyJournal` | P2 | #541 |
| UD-17 | Grenzen | BELEGT | Verlust protokolliert, nicht sichtbar | 48/120/200/32/8/6/240 | P3 | #789 |
| UD-18 | Gedächtnis | WIDERSPRÜCHLICH | Drei Modelle ohne Schreibvertrag | `city-life-types.ts:60`, `relationships.ts` | P1 | #763 |
| UD-19 | Scheduler | BELEGT | Max. 3 Instanzen/Lauf, 64 Kandidaten | `event-scheduler.ts:13`, `event-lifecycle.ts:19` | P3 | #789 |
| UD-20 | Content | TEILWEISE | Leser registriert, Szenenkontext offen | `verify-narrative-blocks.mjs`, `view.ts` | P2 | #541 |
| UD-21 | Bereiche | TEILWEISE | Ein Konto, eine Besuchermenge | `business-areas.ts`, `hybrid-flow.ts` | P2 | #810, #540 |
| UD-22 | Personal | TEILWEISE | Qualifikation ja, Bewertung nein (S3-10) | `staff-*.ts` (6 Module) | P2 | #810 |
| UD-23 | Immobilien | NICHT IMPL. | `player.property` ist Singular | `property.ts:119` | P1 | #540 |
| UD-24 | Events | TEILWEISE | Zwei Quotenmodelle, keine gemeinsame Instanz | `venue-event.ts`, `esport-odds.ts`, `fight-bets.ts` | P2 | #787 |
| UD-25 | Betrieb | TEILWEISE | Aktive Rollen nur als WIP | `business-active-work.ts` (untracked) | P2 | #809 |
| UD-26 | Geldwege | BELEGT | Alles über `transfer`; Umbau längste Kette | `ledger.ts`, `remodel.ts` | P3 | #840 |
| UD-27 | Schulden | TEILWEISE | Tilgung nur über `HOUSE_FLOAT` | `openLiability`, `repayDebt` | P2 | #538 |
| UD-28 | Gleichzeitigkeit | BELEGT | Single-Thread, Salden vor Mutation | `ledger.ts` `transfer` | P3 | #840 |
| UD-29 | Waren | TEILWEISE | Deko/Geräte ohne Bestand | `bar-service.ts`, `actions.ts:64` | P2 | #809 |
| UD-30 | Ressourcen | TEILWEISE | Zeit hat keine Opportunitätskosten | `tick.ts`, `reputation` | P1 | #810 |
| UD-31 | Spiele | BELEGT | Acht Spiele, ein Vertrag, POKER-Sonderweg | `contracts.ts:14` | — | — |
| UD-32 | RTP | TEILWEISE | Messung nicht im Regelprofil | `slot-profile.ts`, Katalog | P2 | #789, #840 |
| UD-33 | Präsentation | BELEGT | Kein Weg in den Spielzustand | `render/rng.ts`, `assertGameplayRng` | — | — |
| UD-34 | Mods | TEILWEISE | Kombinationen ungemessen | `resolveModEffects`, `installMod` | P2 | #840 |
| UD-35 | Pakt | BELEGT | Nur Fremdspiel, 3 Aufrufstellen | `foreign-play.ts:64/112/145` | — | — |
| UD-36 | Datenfluss | BELEGT | Command→Store→Snapshot→UI | `world-store.ts`, `buildView()` | P3 | #840 |
| UD-37 | Aktionsmenü | WIDERSPRÜCHLICH | `action-card.test.tsx` existiert, Manifest sagt „fehlt“ | `ui/__tests__/action-card.test.tsx` | P1 | #940 |
| UD-38 | Assets | TEILWEISE | Nur CARPET mit echter Textur | `floor-material.ts` | P2 | #647, #786 |
| UD-39 | Viewports | TEILWEISE | Abnahmetests im Lauf rot (WIP) | `small-screen-acceptance.test.tsx` | P2 | #840, #795 |
| UD-40 | Renderkosten | TEILWEISE | 2,42 MB ist Notiz, kein Gate | `phase34-acceptance.test.tsx` | P2 | #651 |
| UD-41 | Save-Umfang | TEILWEISE | `narrative`/`rivals` nicht belegt | `save.ts:24-75` | P2 | #792 |
| UD-42 | Wachstum | TEILWEISE | Keine Messung über 20 Tage | Grenzen in A/UD-42 | P2 | #840 |
| UD-43 | Migration | BELEGT | v5–v11 migriert, v3/v4 verworfen | `save.ts:15/16`, `migrate.ts:46` | P3 | #841 |
| UD-44 | Import | BELEGT | Gestuft, fail-closed, REPAIR automatisch | `io/envelope.ts:53`, `io/repair.ts` | P3 | #792 |
| UD-45 | Replay | TEILWEISE | 200-Tick-Test fehlt | `living-world-multiseed.test.ts` | P2 | #792 |
| UD-46 | Capabilities | WIDERSPRÜCHLICH | Grün und falsch, Legacy-Owner | `capabilities.json`, `verify-capabilities` | P1 | #940 |
| UD-47 | Testarten | TEILWEISE | Keine Domäne×Klasse-Matrix | Katalog 436/423/13 | P2 | #840 |
| UD-48 | Last | TEILWEISE | Mechanik nicht gefahren | `test:mechanics` (13) | P2 | #789 |
| UD-49 | Doku | WIDERSPRÜCHLICH | Vier Gate-Zahlen gleichzeitig | `INDEX.md`, `ARCHITECTURE.md` | P1 | #941 |
| UD-50 | Produktreife | TEILWEISE | Kein Produkt-Gate, S2-12 offen | S5-09, PR-08/09/10 | P1 | #780, #795 |
| DU-01 | Zustandsbesitz | BELEGT | Ein Schreiber, 193 Sim-Module | `world-store.ts`, `narrative-clock.ts:18` | P2 | #792 |
| DU-02 | Commands | TEILWEISE | Keine Command→Leser-Inventur | `world-store.ts`, `buyBarCmd` | P2 | #840 |
| DU-03 | Fehler | TEILWEISE | Spielerreaktion unbelegt | `InsufficientFundsError` | P2 | #840 |
| DU-04 | Kopplung | TEILWEISE | Fachlich breit, formal intakt | `property.ts`, `floor-work.ts` | P3 | #840 |
| DU-05 | Schichten | BELEGT | headless-core/tree/impact-graph PASS | Gates (9,0 s/2,7 s/2,8 s) | — | — |
| DU-06 | XP-Registry | TEILWEISE | Registry vollständig, Aufrufer fehlt | `player-skills.ts:82/94` | P2 | #801 |
| DU-07 | Skill-Wirkung | TEILWEISE | `skillEffect()` liefert Strings | `player-skills.ts:65`, `player-career-skills.ts:23` | P1 | #801, #809 |
| DU-08 | Wertefamilien | TEILWEISE | `rpg` vs. `skills` getrennt maximierbar | `floor-work.ts:52-63` | P2 | #801 |
| DU-09 | Jobs | TEILWEISE | 8 im Katalog, 1 im Zustand, 250 LOC | `player-jobs.ts` | P0 | #942, #803 |
| DU-10 | Bedürfnisse | TEILWEISE | NPC reicher modelliert als Spieler | `city-life-needs.ts`, `injuryTicks` | P2 | #810 |
| DU-11 | Netz-Verbraucher | BELEGT | `city-doors` + `scene-commands` | `city-network.ts:76` | P2 | #780 |
| DU-12 | Identitäten | TEILWEISE | `nextVisitorId`-Kollision ungeprüft | `city-npcs.ts`, `actor-continuity.ts` | P2 | #763 |
| DU-13 | Bewegung | BELEGT | Kette klar, Fallback fehlt | `city-life-movement.ts`, `pathfinding.ts` | P2 | #785 |
| DU-14 | Nav-Verbraucher | BELEGT | Tür ist kleinste Änderung mit größter Wirkung | `nav-grid.ts`, `nav-reach.ts` | P3 | #840 |
| DU-15 | Engpässe | TEILWEISE | Kein Stresstest | `TICK_MS = 520` | P2 | #840 |
| DU-16 | Speicher-Sync | WIDERSPRÜCHLICH | Begegnung erinnert, Kante nicht | `city-life-memory.ts`, `relationships.ts` | P1 | #763 |
| DU-17 | Speichergrenzen | BELEGT | Geld-Facts konkurrieren um 48 Plätze | `narrative/*` Grenzen | P2 | #789 |
| DU-18 | Journal/Facts | BELEGT | `lastEvent` ist vierter Kanal | `settleMoneyJournal`, `lastEvent` | P2 | #541 |
| DU-19 | Content-Kette | BELEGT | `documentation` 258 ohne Szene | `registry/fragments.json` | P2 | #822 |
| DU-20 | Choices | BELEGT | Geparst, geprüft, einmalig | NAR-08-Pfad | P3 | #789 |
| DU-21 | Ein Standort | NICHT IMPL. | Struktureller Blocker | `property.ts:119` | P1 | #540 |
| DU-22 | propertyWorld | BELEGT | Zuordnung geometrisch, nicht identitär | `inArea()`-Filter | P1 | #540 |
| DU-23 | Personalmodule | TEILWEISE | Sechs Module, keine Bewertung | `staff-*.ts` | P2 | #810 |
| DU-24 | Event-Welten | TEILWEISE | Gemeinsame Instanz fehlt | `venue-event.ts`, `esport-odds.ts` | P2 | #787 |
| DU-25 | Bereichsökonomie | TEILWEISE | Keine Bereichsdimension im Ledger | ein `HAUSKONTO` | P2 | #810 |
| DU-26 | Ledger-Integrität | BELEGT | Dreifach gesichert | `verifyBalanceSheet`, `mulVC` | — | — |
| DU-27 | Schuldenpfad | TEILWEISE | Float ist der Engpass | `repayDebt` | P2 | #538 |
| DU-28 | Geldentstehung | BELEGT | Nur `EXTERNAL_WORLD` | `ledger-integrity.ts:7` | P3 | #840 |
| DU-29 | Bestände | TEILWEISE | Getränke ja, Deko nein | `bar-service.ts` | P2 | #809 |
| DU-30 | Exploits | TEILWEISE | Doppel-Settle-Schutz nur im Store | `store/own-play.ts` | P2 | #792 |
| DU-31 | Engines | BELEGT | Ein Vertrag, POKER anders bewertet | `contracts.ts:14` | — | — |
| DU-32 | Parameter | TEILWEISE | `houseEdgeBps` wirkt am stärksten | `slot-profile.ts` | P3 | #789 |
| DU-33 | RNG-Stellen | BELEGT | Ein Save-Feld, zwei Streams | `core/rng/streams.ts` | — | — |
| DU-34 | Mod-Kombinationen | TEILWEISE | EXTRA_REEL doppelt wirksam | `installMod` | P2 | #840 |
| DU-35 | Pakt-Aufrufe | BELEGT | Doppelzählung konstruktiv möglich | `self-exclusion-bet.ts:72` | P2 | #840 |
| DU-36 | UI/Commands | BELEGT | Nur optimistische Elemente können veralten | `action-card.tsx` | P3 | #840 |
| DU-37 | action-card | WIDERLEGT | Behauptung „Testdatei fehlt“ widerlegt | `action-card.test.tsx`, `menu-action-contract.test.ts` | P1 | #940 |
| DU-38 | CityActorSync | WIDERSPRÜCHLICH | Lebenszyklus getestet, Position nicht | `city-actor-sync.ts:46` | P2 | #640 |
| DU-39 | Renderkosten | TEILWEISE | Hypothese ungemessen | `DepthStage` | P2 | #651 |
| DU-40 | Asset-Laden | TEILWEISE | Fallback sieht wie Design aus | `floor-material.ts` | P2 | #786, #657 |
| DU-41 | Save-Felder | TEILWEISE | Hydration ist die Wahrheit | `toSavedGame`, `hydrateJobState` | P2 | #792 |
| DU-42 | Wachstum | BELEGT | `visitors` wächst am ineffizientesten | Grenzen + `visitors` | P3 | #822 |
| DU-43 | Speicherfehler | TEILWEISE | `saveWorld` → boolean, UI unklar | `save.ts:102` | P2 | #792 |
| DU-44 | Replay-Voraussetzungen | TEILWEISE | 200-Tick-Vergleich fehlt | `prng-persistence.test.ts` | P2 | #792 |
| DU-45 | Alt-Saves | BELEGT | v3/v4 still verworfen | `OLD_KEYS` | P3 | #841 |
| DU-46 | Gate-Tiefe | TEILWEISE | `capabilities` grün bei falscher Aussage | `verify-capabilities` | P1 | #940 |
| DU-47 | Datei-Widersprüche | WIDERSPRÜCHLICH | Profilbeschreibung führt in die Irre | `ARCHITECTURE.md` | P1 | #941, #927 |
| DU-48 | Erzwungene Regeln | TEILWEISE | 0 Pflicht-Reviews per API | Branch-Protection-API | P1 | #884, #909 |
| DU-49 | Skript-Doppelung | TEILWEISE | Prüfer gegen Schreiber | `verify:*` ↔ `sync-*` | P3 | #875 |
| DU-50 | Nachweiskette | TEILWEISE | Tag ohne Browserabnahme | `ci-tag-release.mjs` | P1 | #656, #795 |

## Detail A — Up-to-Down (UD-01 bis UD-50)

**UD-01 · TEILWEISE BELEGT** — Es gibt einen Startpfad, aber keinen geschlossenen Tageskreislauf.
Kette: `new-game.ts` (Wohnung) → `scene-commands.ts` (Tür → Stadt) → `city-encounter.ts` (Begegnung) → `player-jobs.ts` `acceptJob`/`requestJobTask`/`completeJobTask` → `ledger.transfer` → `tickWorld` (`narrative-clock.ts:18`). Unverbunden: Arbeit und Stadt sind an keinen Tagesabschluss gekoppelt, der Betrieb und Wohnung wieder verbindet.
Gegenprobe: `first-evening.test.ts` deckt Eröffnung→Kiste→Gast→Buchung→Tagesende ab, aber **ohne** Stadt- oder Arbeitsstation.
Nebenbefund: `completeJobTask` ist der einzige Arbeitsabschluss; er schreibt Text nach `world.lastEvent`, kein Journal-Eintrag — der Spieler kann seine Schicht nicht nachlesen.
Domäne: Sim, Store, UI. Prio P1 · **#780**, **#810**.

**UD-02 · TEILWEISE BELEGT** — Motivation außerhalb des Casinos existiert, hängt aber am Casinogeld.
`player-job-catalog.ts` (acht Jobs mit `requiredSkill`), `player-job-promotion.ts` (`checkPromotion`, `promote`), `payDailyWage` in `player-jobs.ts:100`. Konsequenz: `world.player.job`, Lohn über Ledger, Aufstieg über `averagePerformance`.
Gegenprobe: Es gibt keinen Geldzufluss außerhalb des Casinos — jeder Job wird vom Casino-Hauskonto oder `EXTERNAL_WORLD` bezahlt; ein Spieler ohne Casino hat keinen zweiten Verdienstpfad.
Nebenbefund: Der Jobmarkt (`city-employment.ts`) zählt Beschäftigung, aber der Spieler-Job ist davon getrennt — zwei Arbeitsbegriffe.
Domäne: Ledger, Sim, UI. Prio P2 · **#801**, **#803**.

**UD-03 · TEILWEISE BELEGT** — Fünf Ziele sind angelegt, aber nur zwei haben Rück- und Wechselpfad.
Casino-Ausbau (`barLevel`/`wcLevel`/`arena.ts`), Immobilie (`property.ts`), Karriere (`player-jobs`), E-Sport (`esport.ts`), Ruf (`reputation`). Fortschritt über Geld/Ledger; Rückschritt nur über Geldverlust; ein **Wechsel** zwischen Zielen ist nirgends modelliert.
Gegenprobe: `checkPromotion` verlangt Leistung, aber kein Ziel konkurriert um dieselbe Ressource außer VaCoins.
Nebenbefund: Ruf ist eine Zahl ohne Verfall — einmal aufgebaut, kostet er nichts.
Domäne: Wirtschaft, Sim, UI. Prio P2 · **#810**.

**UD-04 · WIDERSPRÜCHLICH** — Drei Versprechen, drei verschiedene Grade von Nicht-Implementierung.
① „Kisten schleppen“ (`use-floor-interaction.ts`) hängt an S1-06 (#782, offen) — ohne Starter-Kiste gibt es nichts zu tragen. ② „Anrufe & Nachrichten“ (`smartphone.tsx`) zeigt Nachrichten, aber es gibt kein Anruf-Ereignis im Sim-Kern. ③ README markiert Maja/Waschsalon korrekt als Fiktion — dieser Punkt ist **sauber**.
Gegenprobe: `#797` („README-FAQ vollständig gegen den tatsächlichen Spielstand prüfen“) ist offen; die FAQ-Antwort „Spielstände werden lokal abgespeichert“ ist belegt (`save.ts:102`).
Nebenbefund: Die README ist ehrlicher als die Roadmap — sie markiert Fiktion, die Roadmap nicht.
Domäne: UI, Sim, Release. Prio P2 · **#782**, **#797**.

**UD-05 · TEILWEISE BELEGT** — Ein Erschöpfungszustand ist erreichbar, aber er beendet nichts.
Druck: Miete (`goal.ts`), Verbindlichkeit `HAUS_SCHULDEN` (`openLiability`), Verletzung (`brawl-combat.ts` → `injuryTicks`), Hunger (`city-life-needs`). Kein Code-Pfad definiert Konkurs oder Spielende.
Gegenprobe: Ein Spieler mit 0 VC und offener Schuld kann weiter `requestJobTask` — Arbeit ist nicht an Gesundheit oder Kontostand gebunden.
Nebenbefund: Die teuerste Sackgasse ist nicht Geld, sondern `injuryTicks` ohne Heilpfad-Nachweis.
Domäne: Ledger, Sim, UI. Prio P2 · **#538**, **#810**.

**UD-06 · TEILWEISE BELEGT** — XP-Quellen sind zentral registriert, der Vergabepfad ist nicht durchgängig belegt.
`player-skills.ts:82` `SKILL_XP_SOURCES` (u. a. `CLEAN_FLOOR`, `CLEAN_TILE`, `DEEP_CLEANING` → `cleaning`), `skillIdForSource()`; Anzeige über `player-career-skills.ts:23`.
Gegenprobe: Eine Funktion `trainSkill`/`addSkillXp` existiert unter diesem Namen **nicht**; der Schreiber der XP ist damit nicht als einzelne Naht auffindbar — genau die Lücke, die #801 beschreibt.
Nebenbefund: `SKILL_XP_SOURCES` ist `Record<string, PlayerSkillId>` — ein Tippfehler im Quellschlüssel fällt still auf `null` (`?? null`) und vergibt keine XP.
Domäne: Sim, Save, UI. Prio P2 · **#801**.

**UD-07 · TEILWEISE BELEGT** — Zwei Skills wirken mechanisch, zwei sind auf `main` nur Voraussetzung oder Text.
Leser: `cleaning` → `cleaningReach()` (`floor-work.ts:71`); `perception`/`technique` → `cleaningReach`/`maintenanceGain`; `brawl` → `fighters`/`applyFightOutcome` (`brawl-combat.ts`); `repair` → `actions.ts:64`.
Kein mechanischer Leser auf `main`: `service` (nur `player-job-catalog.ts` `requiredSkill`), `cardDealing` (nur `requiredSkill`; der einzige Wirkleser `business-active-work.ts:197` ist **untracked WIP** #809).
Gegenprobe: `skillEffect()` (`player-skills.ts:65`) gibt **Strings** zurück („Gaststimmung +5 pro serviertem Drink“, „Gewinnchance +2 %“) — es ist ein Beschreibungsgenerator, kein Effekt. Der Text ist damit stärker als die Mechanik.
Nebenbefund: `workQuality()` nennt sich „Dieselbe Formel fuer Anzeige und Wirkung“ — dort ist die Kopplung korrekt; bei `service`/`cardDealing` fehlt sie.
Domäne: Sim, UI, Balance. Prio P1 · **#801**, **#809**.

**UD-08 · BELEGT** — Job-Voraussetzungen sind Daten, nicht Prosa.
`player-job-catalog.ts` führt je Job `requiredSkill: { cleaning, service, cardDealing, repair }`; `player-job-promotion.ts` liefert `checkPromotion`/`promote`/`averagePerformance`. Aufstieg ist an Leistung gebunden, nicht an Zeit.
Gegenprobe: Die Voraussetzung ist ein **Skill-Level**, nicht Erfahrung im Job — ein Quereinsteiger mit Level 2 bekommt den Job, ein langjähriger ohne Level nicht.
Nebenbefund: Damit ist Karriere ein Skill-Check, kein Berufsweg; `player-job-catalog` kennt acht Jobs, `player-jobs` nur einen aktiven.
Domäne: Sim, UI. Prio — · kein Issue.

**UD-09 · NICHT IMPLEMENTIERT** — Es gibt keinen Trainingspfad, also auch kein Abwägen.
Kein `trainSkill`, kein Trainingsort, keine Kosten-Zeit-Rechnung. Skills steigen nur über `SKILL_XP_SOURCES` aus echter Arbeit.
Gegenprobe: Ohne Training ist die Frage „trainieren statt verdienen“ gegenstandslos — sie kann nicht falsch beantwortet werden, weil es sie nicht gibt.
Nebenbefund: Genau deshalb ist Skill-Fortschritt derzeit ein reines Nebenprodukt der Arbeit; ein Spieler kann seinen Build nicht planen.
Domäne: Sim, UI, Balance. Prio P2 · **#801**.

**UD-10 · TEILWEISE BELEGT** — Konkurrenz entsteht, aber die Priorisierung ist nicht als Regel belegt.
Konkurrenten: Schicht (`player-jobs`), Bedürfnisse (`city-life-needs`), Verletzung (`injuryTicks`), Miete (`goal.ts`). Entscheidungslogik für den **Spieler** existiert nicht — er entscheidet selbst; die Engine priorisiert nur NPCs (`city-life-score.ts`, `city-life-tiebreak.ts`).
Gegenprobe: Für NPCs ist die Gewichtung dokumentiert und testbar; für den Spieler ist sie absichtlich offen. Die Frage nach „welche Handlung gewinnt“ ist damit nur für NPCs beantwortbar.
Nebenbefund: Diese Trennung ist richtig, wird aber in der Roadmap nirgends benannt — „Priorisierungslogik“ klingt nach beiden.
Domäne: Sim, UI. Prio P3 · **#810**.

**UD-11 · TEILWEISE BELEGT** — Kontinuität ist headless belegt, die Identitätskette hat zwei Schreiber.
Kette: `city-npcs.ts`/`city-npc-roster.ts` (Herkunft) → `actor-continuity.ts` (ID) → `npc-schedule.ts` (Plan) → `city-life-movement.ts` (Bewegung) → `city-life-restore.ts` (Wiederherstellung) → `visitors`/`Visitor` (Besuch).
Gefahr: `city-life-*` und `visitors` sind zwei Modelle derselben Person (#763 offen).
Gegenprobe: `living-world-continuity.test.ts` prüft ID-Stabilität über Raumgrenzen, nicht die Synchronität der beiden Modelle.
Nebenbefund: `city-life-normalize.ts` und `city-life-override.ts` sind zwei Wege, denselben Zustand zu korrigieren — ein dritter wäre Redundanz.
Domäne: Sim, Narrative, Save. Prio P2 · **#763**.

**UD-12 · BELEGT (headless)** — NPC-Entscheidungen sind gewichtet, deterministisch und testbar.
`city-life-decision.ts` (Absicht), `city-life-score.ts` (Bewertung), `city-life-tiebreak.ts` (Gleichstand), `city-life-apply.ts` (Wirkung). Kein RNG, kein Uhrzugriff.
Gegenprobe: Welcher Faktor **selten** ausschlaggebend ist, ist nicht gemessen — dafür fehlt eine Zählung der Entscheidungsgründe über einen Langlauf (Befund, nicht Implementierung).
Nebenbefund: Ohne diese Zählung ist Balancing von Bedürfnissen blind; `test:mechanics` enthält Balance-Läufe, aber keine Entscheidungsgründe.
Domäne: Sim, Balance. Prio P2 · **#840**.

**UD-13 · TEILWEISE BELEGT** — Der Ortsgraph existiert, ist aber nicht der einzige Weg.
`city-network.ts:25` `CITY_NETWORK_NODES`, `:76` `cityNetworkEdges()`, konsumiert von `city-doors.ts`; daneben `scene-commands.ts` (Szenenwechsel) und `city-venues.ts`.
Gegenprobe: `city-network.test.ts` prüft Knoten und Kanten; es prüft nicht, dass jeder Ortswechsel über den Graphen läuft — S2-12 offen (#780).
Nebenbefund: Drei Orte-Quellen (Netz, Venues, Szenen) ohne gemeinsamen Test; die fehlende Kante ist damit nicht die größte Lücke, sondern die fehlende Einigkeit.
Domäne: Sim, Render, UI. Prio P2 · **#780**.

**UD-14 · TEILWEISE BELEGT** — Navigationsregeln sind getestet, Engpässe nicht.
`nav-grid.ts` (`blockedTiles`, `stepOpen`), `pathfinding.ts` (A* je Schritt), `nav-reach.ts` (Erreichbarkeit), `path-cache` an Layout-Identität. Tests: `nav-edges.test.ts`, `city-exterior-walls.test.ts`.
Gegenprobe: Kein Stresstest mit vielen Akteuren an einer Tür/Kreuzung; die Engpassfrage ist damit unbeantwortet (Befund).
Nebenbefund: `stepOpen` und `canPlaceAt` sichern dieselbe Tür-Invariante getrennt — ein Fehler in einem fällt nicht im anderen auf.
Domäne: Sim, Render. Prio P2 · **#840**.

**UD-15 · TEILWEISE BELEGT** — Vier Bevölkerungsbegriffe, keine gemeinsame Zählung.
`city-npc-roster.ts` (Stammfiguren), `city-life-*` (autonom entscheidende), `visitors` (persistente Profile), `guests` (temporäre Besuche), `render/city-actor-sync.ts` (gerenderte).
Gegenprobe: Kein Dokument und kein Test nennt die vier Zahlen nebeneinander; `START_POOL` erzeugt nur den Startbestand.
Nebenbefund: Die Frage „ist Vielfalt nur Darstellung derselben wenigen Akteure“ ist damit nicht widerlegt — sie ist unbelegt, und das ist selbst der Befund.
Domäne: Sim, Narrativ, Render. Prio P2 · **#822**.

**UD-16 · BELEGT** — Fünf Kausalketten sind im Code nachvollziehbar.
① Spawn → `SPAWN`-Fact → `visitorDisposition` → Rückkehrchance. ② Auszahlung → `MONEY` via `settleMoneyJournal` → Journal. ③ Streit → `BRAWL`-Fact → Kante Rivale→Haus. ④ Kassenbedienung → Fact → Beziehung. ⑤ Rivalenabrechnung → `RIVAL_ACTION` → Trigger `rival-action` → `RIVAL_MOVE`.
Gegenprobe: `processedId` verhindert Doppelverarbeitung; `pending` max. 48 begrenzt die Kette pro Tick.
Nebenbefund: „Anruf“ und „Nachricht“ (Smartphone) erzeugen **keinen** Fact — das sichtbarste Kommunikationsmittel ist narrativ blind.
Domäne: Narrativ, Sim, UI. Prio P2 · **#541**.

**UD-17 · BELEGT** — Die Grenzen sind benannt, der Verlust ist konstruktiv.
Grenzen: `pending` 48, `recent` 120, Relationships max. 200, Events 32 (8 live), `Visitor.memories` 6, Journal 240, `MAX_CANDIDATES` 64, `MAX_FREEZE_TICKS` 200 (`event-lifecycle.ts:19`).
Gegenprobe: `dropped` zählt verworfene Facts — der Verlust ist damit nicht still, aber unbewertet.
Nebenbefund: Sechs Erinnerungen bei bis zu 240 Journal-Zeilen heißt: der Spieler erinnert mehr als der NPC, der dabei war.
Domäne: Narrativ, Sim, Save. Prio P3 · **#789**.

**UD-18 · WIDERSPRÜCHLICH** — Drei Gedächtnismodelle ohne gemeinsamen Schreibvertrag.
`NpcMemory` in `city-life-types.ts:60` (`memories`), `Visitor`-Erinnerungen (max. 6, narrativ), `narrative/relationships.ts` (Kanten, Limit 200, `RELATIONSHIP_REPUTATION_LIMIT` 6).
Gegenprobe: Ein Bewohner kann eine Begegnung in `cityLife` erinnern, ohne dass eine Narrative-Kante entsteht — die Synchronisation ist an Quellen gebunden (Besuch, Streit, Kasse, Rivalenabrechnung), nicht an jede Begegnung.
Nebenbefund: Genau diese Lücke macht #763 („eindeutige Laufzeit- und Contract-Wahrheit“) notwendig statt kosmetisch.
Domäne: Sim, Narrativ, Save. Prio P1 · **#763**.

**UD-19 · BELEGT** — Der Scheduler ist deterministisch und begrenzt.
`event-scheduler.ts` (`MAX_CANDIDATES` 64, Priorität/Fairness/Scope), `event-lifecycle.ts` (Cooldown, Frist, Stale-Cancel, `MAX_FREEZE_TICKS` 200), `narrative-rng.ts` (eigener Strom), `runtime.ts` legt höchstens drei Instanzen pro Lauf an.
Gegenprobe: Bei mehr als 64 Kandidaten wird geschnitten — welcher Typ dabei systematisch verliert, ist nicht gemessen.
Nebenbefund: Die Drei-Instanzen-Grenze pro Lauf ist die eigentliche Engstelle, nicht die 64.
Domäne: Narrativ. Prio P3 · **#789**.

**UD-20 · TEILWEISE BELEGT** — Pools haben Leser, aber nicht jeder Leser ist im Spiel erreichbar.
`verify-narrative-blocks.mjs` = PASS, 14 Pools, jeder ≥ 50 (gemessen). Leser: `narrative/view.ts` → `GameView.narrative` → `src/ui/narrative-*`.
Gegenprobe: Der Gate prüft Registrierung, nicht Szenenkontext; `documentation` (258) und `memory` (54) sind quota-frei und erklären den Überhang.
Nebenbefund: `documentation` ist der größte Pool und per Definition kein Spieltext — er verzerrt jede „Content-Menge“-Aussage.
Domäne: Narrativ, UI. Prio P2 · **#541**.

**UD-21 · TEILWEISE BELEGT** — Bereiche teilen Konto und Besucher, nicht Regeln.
`business-areas.ts` (Zonen), `bar-service.ts` + `drink-menu.ts` (Bar), `club-night.ts` (Lounge), `arena.ts` (Arena), `hybrid-flow.ts` (Wechsel), `venue-event.ts` (Events).
Gegenprobe: Ein Konto, eine Besuchermenge — die Unterschiede liegen in Öffnungszeit und Preis, nicht in eigenen Betriebsregeln (S3-11 offen).
Nebenbefund: Der Markt hat kein Modul — er ist Ort, nicht Betrieb.
Domäne: Sim, Wirtschaft, UI. Prio P2 · **#810**, **#540**.

**UD-22 · TEILWEISE BELEGT** — Personal handelt, aber ohne bewertete Leistung.
`staff.ts`, `staff-queries.ts`, `staff-qualification.ts`, `staff-step.ts`, `staff-cashier.ts`, `staff-porter.ts`; Ausführung in `staff-step.ts`, Vergütung über Ledger.
Gegenprobe: S3-10 („Personal mit Qualifikation und Leistungsbewertung“) ist **offen**; der Audit findet Qualifikation, aber keine Bewertung.
Nebenbefund: Zwei Rollen (Kassierer, Porter) haben eigene Module, alle anderen laufen über den generischen Step — die Rollenvielfalt ist schmaler als der Name `staff` vermuten lässt.
Domäne: Sim, Wirtschaft. Prio P2 · **#810**.

**UD-23 · NICHT IMPLEMENTIERT** — Das Eigentumsmodell ist strukturell einfach.
`property.ts:119` `const owned = world.player.property;` — **Singular**. `propertyWorld()` filtert Zonen, Möbel und Gäste über `propertyArea(world)`; `PROPERTY_ACCOUNT` ist ein festes Konto.
Gegenprobe: Ein zweiter Standort würde dieselbe Area und dasselbe Konto treffen; es gibt keine Gebäude-ID im Eigentum.
Nebenbefund: Damit ist #540 (Portfolio) kein Feature-Wunsch, sondern eine Datenmodelländerung — der erste Blocker ist `world.player.property`, nicht die UI.
Domäne: Sim, Save, Wirtschaft, UI. Prio P1 · **#540**.

**UD-24 · TEILWEISE BELEGT** — Event-Infrastruktur existiert, der E-Sport-Abend ist noch nicht eine Instanz.
`venue-event.ts` (Ankündigung/Einlass/Durchführung/Ergebnis), `fight-bets.ts` (Quoten fixiert bei Abgabe), `esport.ts` + `esport-event.ts` + `esport-odds.ts`, `arena.ts`.
Gegenprobe: S3-09 („E-Sport an Event- und Wettinfrastruktur anschließen“) ist offen; PR #938 (Rollen) lag während des Audits offen.
Nebenbefund: `esport-odds.ts` existiert parallel zu `fight-bets.ts` — zwei Quotenmodelle, ein Abrechnungswunsch.
Domäne: Sim, Wirtschaft, Narrativ. Prio P2 · **#787**.

**UD-25 · TEILWEISE BELEGT** — Aktive Betriebsarbeit ist im Entstehen, nicht auf `main`.
Auf `main`: Bestand (`bar-service`), Geräte (`device.ts`), Reinigung (`stain.ts`), Reparatur (`actions.ts`), Events, Nachfrage (`demand.ts`). Aktiv-bedienende Rollen: `business-active-work.ts` ist **untracked** (WIP #809).
Gegenprobe: Ohne diese Datei gibt es auf `main` keine Spielerrolle am Tresen — der Betrieb läuft passiv über `demand.ts` und `bar-service`.
Nebenbefund: Die Frage „welcher Bereich hat Datensatz ohne operative Verantwortung“ beantwortet sich damit für **alle** Bereiche gleich: Verantwortung ist derzeit Bestandsverwaltung, nicht Bedienung.
Domäne: Sim, UI, Wirtschaft. Prio P2 · **#809**.

**UD-26 · BELEGT** — Jeder Zahlungsweg läuft über `Ledger.transfer`.
Gastkauf: `FIAT_<id>` → `VISITOR_<id>` → `HAUSKONTO`; Gewinn: `HAUSKONTO` → `PENDING_<id>` → `VISITOR_<id>` → `FIAT_<id>`; eigenes Spiel: `PORTEMONNAIE` → `HAUSKONTO` und zurück; Umbau: Deckung → Gastansprüche → Geld → Haustausch (`remodel.ts`).
Gegenprobe: `transfer` erlaubt `game: string | null` — der Spieltyp ist optional, also nicht jeder Buchung ist anzusehen, aus welchem Spiel sie stammt.
Nebenbefund: `reason` ist Freitext ohne Enum; die längste Kette (Umbau) ist zugleich die einzige mit vier Schritten und ohne eigenen Kettentest-Namen.
Domäne: Wirtschaft. Prio P3 · **#840**.

**UD-27 · TEILWEISE BELEGT** — Schulden wachsen monoton, Tilgung ist an eine Schwelle gebunden.
`openLiability` erlaubt negative Konten; Rückzahlung nur aus Überschuss über `HOUSE_FLOAT` (`repayDebt`). Wöchentliche Rechnungen existieren nicht (#538 offen).
Gegenprobe: Ein Betrieb, der nie über `HOUSE_FLOAT` kommt, tilgt **nie**; die Schuld sinkt auch bei steigenden Einnahmen nicht, solange die Schwelle nicht überschritten wird.
Nebenbefund: Damit ist `HOUSE_FLOAT` der eigentliche wirtschaftliche Endgegner — eine Konstante, kein Spielentscheid.
Domäne: Wirtschaft, Balance. Prio P2 · **#538**.

**UD-28 · BELEGT** — Gleichzeitigkeit ist im Tick ausgeschlossen, nicht verwaltet.
Der Tick ist single-threaded; `transfer` berechnet beide neuen Salden **vor** jeder Mutation; `InsufficientFundsError` verhindert Unterdeckung; `ledger-tick-guard.ts:39` prüft danach inkrementell.
Gegenprobe: „Gleichzeitig“ heißt hier: zwei Commands im selben Tick. Deren Reihenfolge ist die Command-Reihenfolge — und die ist nirgends als Vertrag dokumentiert.
Nebenbefund: Der wahrscheinlichste Konflikt-Hotspot ist die Auszahlung an einen Gast, während das Haus schon Schulden trägt — dort entscheidet `openLiability`, ob der Gast Geld sieht.
Domäne: Wirtschaft, Store. Prio P3 · **#840**.

**UD-29 · TEILWEISE BELEGT** — Getränke haben einen Kreislauf, andere Waren nicht.
Bar: `drink-menu.ts` (Preis) + `bar-service.ts` (Bestand/Verbrauch), `serveFreeDrink` verbraucht Barbestand. Reparatur: `parts` verbraucht Ersatzteile (`actions.ts:64`, `repair`-Skill spart sie).
Gegenprobe: Für Deko, Möbel und Geräte gibt es **keinen** Bestand — sie werden gekauft und sind danach zustandslos; „Einkauf → Bestand → Verbrauch → Verkauf“ fehlt dort vollständig.
Nebenbefund: `world.parts` ist ein Zähler, kein Lager — die Teilknappheit ist global, nicht pro Gerät.
Domäne: Wirtschaft, Sim. Prio P2 · **#809**.

**UD-30 · TEILWEISE BELEGT** — Zeit und Ruf sind Ressourcen ohne Preis.
Zeit: `world.tick`, fortgeschrieben nur in `tick.ts`; kein Ort kostet Zeit außer implizit. Ruf: `world.reputation` ohne Verfall. Teile: `world.parts` knapp. Gesundheit: `injuryTicks`.
Gegenprobe: Zeit hat **keine** Opportunitätskosten — warten ist immer gratis, also ist Warten nie die falsche Entscheidung.
Nebenbefund: Das ist der stärkste ökonomische Hebel im ganzen System und er ist nicht bewertet; jede Balance-Aussage ohne Zeitkosten ist unvollständig.
Domäne: Wirtschaft, Sim, Balance. Prio P1 · **#810**.

**UD-31 · BELEGT** — Acht Spiele, eine Naht.
`contracts.ts:14` `GAMES = ['SLOT','BLACKJACK','POKER','VIDEO_POKER','ROULETTE','PLINKO','SHELL','DICE']`; `playAction({game, stake, …})` prüft vor der Ziehung, `payout = mulVC(stake, multiplierBps)`.
Gegenprobe: POKER wird nicht über RTP bewertet, sondern über Handverteilung und Schuh (`poker-distribution.test.ts`) — ein Sonderweg, aber ein dokumentierter.
Nebenbefund: Die Reihenfolge in `GAMES` ist die UI-Reihenfolge; sie ist keine Priorität und nirgends als solche markiert.
Domäne: Spiele, Wirtschaft. Prio — · kein Issue.

**UD-32 · TEILWEISE BELEGT** — Theorie und Messung sind getrennt, aber nicht in jedem Profil verbunden.
Angezeigt: `slot-profile.ts`/`lineStats`; gemessen: RTP-Monte-Carlo (SLOT 200 000, SHELL 300 000, PLINKO 5 000). Klasse `statistics` läuft **nicht** in `light`/`quick`/`fast`.
Gegenprobe: Der Standard-Vor-PR-Nachweis enthält die Messung nicht; ein Paytable-Fehler wäre dort unsichtbar.
Nebenbefund: Die Tail-Verteilung ist laut Architektur „an frische Seeds angepasst“ — das ist Kalibrierung, kein Beweis für jedes Band.
Domäne: Spiele, Wirtschaft. Prio P2 · **#789**, **#840**.

**UD-33 · BELEGT** — Präsentation kann den Spielzustand nicht erreichen.
`render/rng.ts` (Presentationsstrom, nie im Save), `assertGameplayRng` an `tickWorld`/`playRound`, `headless-core` PASS, `render` importiert `store` nur als `import type`.
Gegenprobe: Gleicher Seed + andere Animation → gleiche Ledger-Zeilen, weil das Save nur `prngState` trägt (A2/UD-02).
Nebenbefund: Die Trennung ist typ- und importseitig erzwungen, nicht laufzeitgeprüft; ein `as any` im Renderer wäre unsichtbar.
Domäne: Render, Spiele. Prio — · kein Issue.

**UD-34 · TEILWEISE BELEGT** — Mods wirken zentral, Kombinationen sind ungemessen.
`resolveModEffects` dedupliziert Mod-Ids, FREE_DRINK nur mit `freeDrink`/`freeDrinkCost`, EXTRA_REEL nur auf SLOT; `installMod` erhöht Walzenzahl und löscht Slot-Gedächtnis; VELVET wirkt über `guestTier`.
Gegenprobe: Keine Messreihe für Mod-Kombinationen; „stärkster Synergieeffekt“ ist unbeantwortet (Befund).
Nebenbefund: EXTRA_REEL verändert die Walzenzahl **und** löscht das Gedächtnis — ein Mod, zwei Wirkungen, kein gemeinsamer Test.
Domäne: Spiele, Wirtschaft, Balance. Prio P2 · **#840**.

**UD-35 · BELEGT** — Der Pakt ist auf Fremdspiel begrenzt, technisch belegt.
`recordExclusionPlay`/`Win` werden ausschließlich aus `store/foreign-play.ts` gerufen (Zeilen 64, 112, 145) — drei Aufrufstellen, keine im eigenen Spiel (`own-play.ts`).
Gegenprobe: Ein Spieler, der nur im eigenen Haus spielt, kann den Pakt nie auslösen; die Schutzwirkung ist damit an das fremde Haus gebunden.
Nebenbefund: Das ist eine bewusste Designentscheidung, aber sie bedeutet: das Spiel schützt vor allem vor den Casinos der anderen.
Domäne: Spiele, UI, Narrativ. Prio — · kein Issue.

**UD-36 · BELEGT** — Command → Store → Snapshot → UI/Render ist eine Bahn.
Command schreibt über `world-store.ts`; `buildView()` erzeugt `GameView`; UI liest Snapshot, Renderer liest `GameView.layout`/Actor-Snapshots.
Gegenprobe: Abgeleitete Werte (z. B. `GameView.company` aus `companyStatus()`) werden bei jeder Ableitung neu berechnet — zwei Aufrufer könnten unterschiedliche Zwischenstände sehen.
Nebenbefund: Der Store ist der einzige Ort, an dem ein Command „fertig“ ist; es gibt keinen expliziten Commit-Zeitpunkt pro Command in der UI.
Domäne: Store, UI, Render. Prio P3 · **#840**.

**UD-37 · WIDERSPRÜCHLICH** — Die Capability behauptet eine fehlende Testdatei, die existiert.
`src/ui/__tests__/action-card.test.tsx` **existiert**; `docs/capabilities.json` sagt für `actions.radial-menu` und `actions.dropdown-sheet` je „Testdatei … fehlt noch“ mit `testIds: []`.
Gegenprobe: Der 6/7-Schwellwert zwischen Radialmenü und Sheet ist nirgends als Konstante geteilt; die Tests decken die Karte, nicht die Schwelle.
Nebenbefund: Damit ist die Frage „was fehlt bei Überfüllung“ offen, obwohl die Datei existiert — der Befund ist präziser als „Test fehlt“.
Domäne: UI, Governance. Prio P1 · **#940**.

**UD-38 · TEILWEISE BELEGT** — Ein Material ist echt, der Rest ist prozedural.
`floor-material.ts` ist die einzige Auflösung `FloorMaterialId` → Darstellung/Textur/Fallback; **nur CARPET** hat eine echte Manifest-Textur; `wall-art.ts`, `furniture-atlas.ts`, `guest-rig.ts`, `room-dressing.ts` liefern den Rest.
Gegenprobe: Ein fehlendes Asset fällt auf die stabile Fallback-ID zurück — sichtbar falsch, aber ohne Fehler.
Nebenbefund: Damit ist „fehlendes Asset“ im Betrieb unsichtbar; nur ein Bildvergleich würde es zeigen (#647/#786 offen).
Domäne: Render, Assets. Prio P2 · **#647**, **#786**.

**UD-39 · TEILWEISE BELEGT** — Kleine Viewports sind getestet, im Lauf aber rot.
`small-screen-acceptance.test.tsx` (360×640, 320×640), `small-screen-layout.test.ts`; PR-05 = „verifiziert“. Im Vollauf beide Abnahmetests **FAIL** (`worldStore.businessWork`, WIP #809).
Gegenprobe: Die Layouttests sind grün, die Abnahmetests nicht — zwei Aussagen über dasselbe Gerät.
Nebenbefund: Touch ist nur über gemeinsame Funktionen abgedeckt, nicht über Touch-Events (#795 zurückgestellt).
Domäne: UI, Render, Release. Prio P2 · **#840**, **#795**.

**UD-40 · TEILWEISE BELEGT** — Kosten sind benannt, nicht gemessen.
S5-07 (#651): First Frame < 3 s bei Slow 4G, Baseline 22 Requests / 2,42 MB; PR-06: Atlas-Budgets („verifiziert“). `phase34-acceptance.test.tsx` prüft Budgetwerte, kein Netz, keine GPU.
Gegenprobe: `verify:assets` prüft Manifest-Konsistenz, nicht Bytes; ein wachsender Atlas bleibt grün.
Nebenbefund: Der gemessene Wert (2,42 MB) ist eine Notiz, kein Gate — die Zahl kann ohne roten Lauf wachsen.
Domäne: Render, Release. Prio P2 · **#651**.

**UD-41 · TEILWEISE BELEGT** — Der Save ist breit, aber nicht nachweislich vollständig.
`toSavedGame` (`save.ts:24-75+`) trägt: `layout`, `furniture`, `guests`, `player`, `prices`, `staff`, `tick`, `day`, `crates`, `agents`, `disputes`, `stains`, `mops`, `parts`, `reputation`, `city`, `cityLife`, `cityGrowth`, `visitors`, `journal`, `archive`, `fightBets`, `look`, `plinko`, `prngState`, `version`.
Gegenprobe: `narrative`/`rivals` lagen außerhalb des gelesenen Fensters (Zeilen >75) — ihre Aufnahme ist **nicht** von mir belegt; das ist der offene Punkt.
Nebenbefund: `layout` und `furniture` reisen getrennt, obwohl `layout` die räumliche Wahrheit ist — ein inkonsistentes Paar wäre möglich.
Domäne: Save, alle. Prio P2 · **#792**.

**UD-42 · TEILWEISE BELEGT** — Grenzen sind bekannt, Wachstum ist ungemessen.
Feste Grenzen: pending 48, recent 120, relationships 200, events 32/8, memories 6, journal 240, knowledge 200, `MAX_CANDIDATES` 64.
Gegenprobe: Es gibt **keine** Messung über 1/5/10/20 Tage; die Frage nach dem ersten Engpass ist damit unbeantwortet (Befund).
Nebenbefund: `knowledge` (200) und `relationships` (200) wachsen mit Begegnungen, nicht mit Zeit — der Engpass kommt durch Spielaktivität, nicht durch Spielalter.
Domäne: Save, Sim, Narrativ. Prio P2 · **#840**.

**UD-43 · BELEGT** — v5–v11 migrieren, v3/v4 fallen bewusst weg.
`save.ts:15` `LEGACY_KEYS` v10…v5, `:16` `OLD_KEYS` v3/v4; `migrate.ts:46` Typ `5|6|7|8|9|10|11`, `:47` „Ab v11 der kanonische Layout-Vertrag; v5–v10 leiten ihn aus der Vorlage ab“.
Gegenprobe: v3/v4 werden **verworfen**, nicht migriert — der Verlust ist bewusst, aber für den Spieler still, wenn die UI ihn nicht nennt.
Nebenbefund: Der Kopfkommentar von `migrate.ts` sagt noch „v5/v6/v7“ — die Datei beschreibt sich selbst falsch.
Domäne: Save. Prio P3 · **#841**.

**UD-44 · BELEGT** — Import ist gestuft und fail-closed.
`io/envelope.ts` (FNV-1a `checksum`, `:53` Vergleich), `io/issues.ts` (FATAL/REPAIR/IGNORE), `io/repair.ts` (Pflichtfelder), `store/transfer.ts` (Trockenlauf vor Ersetzen).
Gegenprobe: `REPAIR` ergänzt fehlende Pflichtfelder automatisch — ein technisch gültiger, sachlich falscher Stand ist damit möglich (Standardwerte statt Abbruch).
Nebenbefund: Genau diese Klasse ist die gefährlichste: sie sieht wie Erfolg aus. Ein Test, der einen reparierten Stand gegen den Originalstand vergleicht, fehlt.
Domäne: Save, UI. Prio P3 · **#792**.

**UD-45 · TEILWEISE BELEGT** — Replay-Voraussetzungen sind benannt, nicht als Ganzes geprüft.
Voraussetzungen: `prngState` im Save, Tick/`day` aus der Welt, keine Wanduhr im Spielpfad, feste Iterationsreihenfolge, keine Asynchronität im Tick.
Gegenprobe: `living-world-multiseed.test.ts` (PASS, 36 s) belegt Seed-Reproduzierbarkeit — aber nicht „200 Ticks nach Save/Load identisch“.
Nebenbefund: Der Test, der die Frage wirklich beantwortet (Save → 200 Ticks → Vergleich), existiert nicht; das ist die konkreteste Testlücke des Audits.
Domäne: Save, Sim, RNG. Prio P2 · **#792**.

**UD-46 · WIDERSPRÜCHLICH** — Das Manifest ist grün und falsch.
`verify:capabilities` = PASS (13 Fähigkeiten, 8 aktiv, 5 unverified); `unverified`-Begründungen sind durch den Baum widerlegt (`action-card.test.tsx` existiert, `nav-edges.test.ts` existiert); Owner sind Legacy (`UI-Owner`, `Interaction-Owner`, `Core-Owner`).
Gegenprobe: Fehlende Fähigkeiten: `narrative.event-scheduler` ist aktiv, aber **kein** Eintrag deckt `npc-schedule`/`city-network`/`walk`-Bewegung ab — die Liste ist auch unvollständig.
Nebenbefund: Damit ist das Manifest doppelt falsch: falsche Negativa **und** fehlende Positiva.
Domäne: Governance, alle. Prio P1 · **#940**.

**UD-47 · TEILWEISE BELEGT** — Beweisklassen sind definiert, die Abdeckung ist ungleich.
Katalog: 436 Dateien, 423 Regellauf, 13 Mechanik; Klassen `contract|integration|governance|statistics|performance`; 172 Sim-Testdateien, 41 Render, 29 UI.
Gegenprobe: `src/core/economy` hat 4 Module, aber Wirtschaftstests liegen verteilt; eine Matrix „Domäne × Beweisklasse“ existiert nicht.
Nebenbefund: 193 Sim-Module gegen 172 Sim-Testdateien heißt nicht 1:1 — viele Tests decken mehrere Module, andere Module keinen.
Domäne: Qualität. Prio P2 · **#840**.

**UD-48 · TEILWEISE BELEGT** — Langlast ist vorbereitet, nicht gefahren.
`test:mechanics` (13 Dateien: RTP, Soak, Balance, Bench), `soak` mit 100 000 Ticks, `bench:lowend`. Im Audit wurde nur die Regelsuite gefahren.
Gegenprobe: Der einzige Langlauf im Audit war `living-world-multiseed.test.ts` (36 s) — kein Soak, kein Benchmark.
Nebenbefund: Damit ist „Systeme unter Last“ die größte unbelegte Fläche des Audits; sie ist ausdrücklich als Befund geführt, nicht als „grün“.
Domäne: Sim, Render, Wirtschaft. Prio P2 · **#789**.

**UD-49 · WIDERSPRÜCHLICH** — Vier Dokumente, vier Gate-Zahlen, dazu Versionsdrift.
Code: 16 Required / 11 Light / 8 Profile. `CI.md` + `AGENTS.md`: korrekt. `INDEX.md`: „15“. `ARCHITECTURE.md`: „fünf Profile“, „acht“, „vierzehn“, „fünfzehn/sechzehn“. Version: `package.json` 0.3.281 vs. ROADMAP 0.3.267. Narrative gesamt: 1182 vs. 1030.
Gegenprobe: Alle Abweichungen bestehen **gleichzeitig** auf demselben Commit.
Nebenbefund: Die gefährlichste ist nicht die Zahl, sondern die Profilbeschreibung: wer `ARCHITECTURE.md` folgt, hält `verify:integration` für einen vollen Nachweis.
Domäne: Doku, CI. Prio P1 · **#941**, **#822**.

**UD-50 · TEILWEISE BELEGT** — Es gibt Exit-Kriterien, aber kein Produkt-Gate.
Exit-Kriterien existieren verteilt: `verify:all` (16 Gates), S5-09 (bespielbare Stadt), PR-08/09/10 (Bildsatz, FAQ, Lizenzen), S5-08 (APK zurückgestellt). Ein einzelnes „Produkt reif“-Gate gibt es nicht.
Gegenprobe: Die fehlende Abnahme mit der größten Wirkung ist **S2-12** (#780): ohne Stadtnetz ist „bespielbare Stadt“ nicht erfüllbar, und daran hängen S5-09, R-2 und die README-Erzählung.
Nebenbefund: Der Tag `v*` wird lokal gesetzt, ohne Bindung an eine Browserabnahme — ein Release kann formal korrekt und ungesehen sein.
Domäne: Release, alle. Prio P1 · **#780**, **#795**.

## Detail B — Down-to-Up (DU-01 bis DU-50)

**DU-01 · BELEGT** — `WorldState`/`Ledger`/PRNG haben einen Besitzer, viele Leser.
`world-store.ts` ist der einzige Schreiber; `narrative-clock.ts:18` ruft `tickWorld`; `ledger-tick-guard.ts:39` prüft danach; UI und Render lesen `GameView`.
Gegenprobe: 193 Sim-Module hängen an `WorldState` — der Hotspot ist nicht ein Modul, sondern der Typ selbst.
Nebenbefund: Genau deshalb ist jede `WorldState`-Feldänderung eine potenzielle Save-Migration; der Typ ist die teuerste Signatur des Repos.
Domäne: alle. Prio P2 · **#792**.

**DU-02 · TEILWEISE BELEGT** — Commands sind zentral, ihre Wirkungstiefe ist ungleich.
Alle Commands laufen über `world-store.ts`; Beispiele: `dismissNarrativeCmd` (UI-gelesen), `buyBarCmd` (nimmt `world.tick` vom Store, nicht vom Aufrufer), `settleMoneyJournal` (kopiert Ledger-Zeilen genau einmal, `journaledSeq`).
Gegenprobe: Eine Inventur „Command → Zustandsänderung → sichtbarer Leser“ existiert nicht; damit ist „welcher Command wirkungslos ist“ nicht beantwortbar (Befund).
Nebenbefund: `buyBarCmd` ist der einzige Command mit Zeitparameter — und er bekommt ihn vom Store, nicht vom Aufrufer. Das ist korrekt und der einzige Grund, warum Determinismus hält.
Domäne: Store, UI. Prio P2 · **#840**.

**DU-03 · TEILWEISE BELEGT** — Fehler sind typisiert, die Spielerreaktion ist nicht belegt.
`InsufficientFundsError` (Konto, angefragt, verfügbar, Grund), `LedgerError`, `VaCoinError`, `io/issues.ts` (FATAL/REPAIR/IGNORE), `ERR-xxxx` im Fehlerregister.
Gegenprobe: Ob ein Command-Fehler in der UI ankommt oder die Oberfläche still alt bleibt, ist im Audit nicht belegt — es gibt keinen Test „Command scheitert → Spieler sieht warum“.
Nebenbefund: `ERR-` Codes sind Pipeline-Sprache; ein Spieler sieht sie nie. Zwischen „technisch erkannt“ und „verständlich erklärt“ liegt eine nicht implementierte Übersetzung.
Domäne: Store, UI, Governance. Prio P2 · **#840**.

**DU-04 · TEILWEISE BELEGT** — Fachlich lokale Module greifen breit.
Beispiele: `property.ts` nutzt `propertyArea(world)` und filtert `world.zones`/`furniture`/`guests`; `floor-work.ts` liest `player.rpg` **und** `player.skills`; `business-active-work.ts` (WIP) verbindet Betrieb, Skill, Station und Ledger.
Gegenprobe: `headless-core` und `impact-graph` sind grün — die Grenzen sind also formal intakt; die Kopplung ist fachlich, nicht architektonisch.
Nebenbefund: `floor-work.ts` ist die einzige Stelle, an der Attribut **und** Fach-Skill in dieselbe Formel gehen — ein Hotspot für Balance-Änderungen.
Domäne: Sim, Wirtschaft. Prio P3 · **#840**.

**DU-05 · BELEGT** — Die Schichtgrenzen tragen.
`verify:headless-core` PASS (9,0 s), `verify:tree` PASS (2,7 s), `verify:impact-graph` PASS (2,8 s); `src/core` ohne `pixi.js`/`react` (grep 0 Treffer); `render` importiert `store` nur als Typ.
Gegenprobe: Die riskanteste Grenze ist `store → core`: der Store ruft Core-Funktionen **und** hält den Zustand — er ist der einzige Ort, an dem beide Wahrheiten zusammentreffen dürfen.
Nebenbefund: Ein zweiter Zustand entstünde nicht durch einen Import, sondern durch eine Kopie im Store; dagegen gibt es kein Gate.
Domäne: Architektur. Prio — · kein Issue.

**DU-06 · TEILWEISE BELEGT** — Die Registry ist vollständig, der Aufrufer ist nicht auffindbar.
`SKILL_XP_SOURCES` (`player-skills.ts:82`) registriert u. a. `CLEAN_FLOOR`, `CLEAN_TILE`, `DEEP_CLEANING`; `skillIdForSource()` (`:94`) liefert `null` bei unbekanntem Schlüssel.
Gegenprobe: `grep` nach `trainSkill`/`addSkillXp` findet **nichts** — die XP-Vergabe hat keinen benannten Einstiegspunkt.
Nebenbefund: Ein unbekannter Quellschlüssel fällt still auf `null`; ein Tippfehler kostet Fortschritt, ohne rot zu werden.
Domäne: Sim, Save. Prio P2 · **#801**.

**DU-07 · TEILWEISE BELEGT** — Zwei Effekte sind Mechanik, zwei sind Anzeige.
Mechanik: `cleaningReach()` liest `skills.cleaning.level` (`floor-work.ts:71`); `repair` liest `player.skills.repair` (`actions.ts:64`). Anzeige: `player-career-skills.ts:23` rendert `skillEffect()`, das **Strings** liefert; `service`/`cardDealing` haben auf `main` keinen Wirkleser.
Gegenprobe: `workQuality()` sagt ausdrücklich „Dieselbe Formel fuer Anzeige und Wirkung“ — dort ist die Kopplung bewusst; bei `service`/`cardDealing` fehlt sie ganz.
Nebenbefund: Damit kann der Spieler eine Stufe kaufen/erarbeiten, die ihm +5 Gaststimmung verspricht, ohne dass irgendein System sie liest.
Domäne: Sim, UI, Balance. Prio P1 · **#801**, **#809**.

**DU-08 · TEILWEISE BELEGT** — Drei Wertefamilien, zwei Formeln.
`PlayerRpgState` (speed, charisma, brawl, perception, technique, endurance, luck) über `levelOf`/`workQuality` (`floor-work.ts:52-63`); Fach-Skills (`cleaning, service, cardDealing, repair`) über `SKILL_XP_SOURCES`; Job-Anforderungen über `requiredSkill` (`player-job-catalog.ts`).
Gegenprobe: Arbeit liest `rpg`, Jobs lesen `skills` — ein Spieler kann beide getrennt maximieren, ohne dass sie sich beeinflussen.
Nebenbefund: Diese Trennung ist der Grund, warum „nur eine Tätigkeit“ mehrere Vorteile erzeugen kann — genau der in der Frage vermutete Fall.
Domäne: Sim, Balance. Prio P2 · **#801**.

**DU-09 · TEILWEISE BELEGT** — Acht Jobs im Katalog, ein aktiver Job im Zustand.
`player-jobs.ts` exportiert `JOB_DEFS`, `acceptJob`, `quitJob`, `requestJobTask`, `completeJobTask`, `hydrateJobState`, `payDailyWage`, `buyBar`; `player-job-promotion.ts` liefert `checkPromotion`/`promote`/`averagePerformance`.
Gegenprobe: Ein Job ohne Aufstiegsmechanik ist im Katalog möglich — `checkPromotion` ist generisch, nicht pro Job konfiguriert.
Nebenbefund: `player-jobs.ts` hat **250 LOC** (Grenze 200) und ist damit selbst der Auslöser des roten `check:loc` — Karriere und Budget kollidieren.
Domäne: Sim, Wirtschaft, UI. Prio P0 (LOC) / P2 (Inhalt) · **#942**, **#803**.

**DU-10 · TEILWEISE BELEGT** — Bedürfnisse haben Schreiber, der Erholungspfad ist unklar.
Schreiber: `city-life-needs.ts`/`city-life-apply.ts` (Hunger, Durst, Müdigkeit), `brawl-combat.ts` (`injuryTicks`), `stain.ts`/`floor-work.ts` (Betrieb). Leser: `city-life-decision.ts`/`city-life-score.ts` (NPC), `goal.ts` (Miete).
Gegenprobe: Für den **Spieler** gibt es keinen belegten Erholungspfad gegen `injuryTicks`; „wirtschaftlich effizienteste Erholung“ ist damit unbeantwortet.
Nebenbefund: NPC-Bedürfnisse sind besser modelliert als Spieler-Bedürfnisse — die Simulation ist für die Figuren reicher als für den Protagonisten.
Domäne: Sim, UI, Wirtschaft. Prio P2 · **#810**.

**DU-11 · BELEGT** — Das Netz hat einen Verbraucher, der Wechsel einen zweiten.
`CITY_NETWORK_NODES` (`city-network.ts:25`) und `cityNetworkEdges()` (`:76`) werden von `city-doors.ts:12/17` konsumiert; der Ortswechsel läuft zusätzlich über `scene-commands.ts`.
Gegenprobe: Eine gerichtete Kante („nur nachts begehbar“) kann der Graph nicht ausdrücken; Bedingungen liegen außerhalb.
Nebenbefund: Genau deshalb ist S2-12 (#780) keine Renderaufgabe, sondern eine Vertragsfrage: ein Graph, zwei Nutzer.
Domäne: Sim, Render. Prio P2 · **#780**.

**DU-12 · TEILWEISE BELEGT** — Identitäten haben mehrere Erzeuger.
`visitorId`/`nextVisitorId` (`world.visitors`), `npcId`/`city-npcs.ts`, `actor-continuity.ts` (stabile Actor-ID), `hydrateJobState` (Spieler-Job), `city-life-restore.ts` (Wiederherstellung).
Gegenprobe: `nextVisitorId` ist ein Zähler im Save; nach einer Migration mit verworfenen Besuchern könnte er hinter bestehenden IDs liegen — Kollisionsgefahr ist nicht geprüft.
Nebenbefund: Namensgleichheit ist zulässig (Figuren heißen gleich), aber `actor-id`-Eindeutigkeit ist der einzige Schutz — und sie wird von `actor-continuity.ts` allein getragen.
Domäne: Sim, Save, Narrativ. Prio P2 · **#763**.

**DU-13 · BELEGT (headless)** — Bewegung ist eine Kette mit klaren Stufen.
Intent (`city-life-decision.ts`) → Weg (`pathfinding.ts` über `nav-grid.ts`) → Anwendung (`city-life-apply.ts`) → Zustand (`city-life.ts`/`city-life-state.ts`) → Wiederherstellung (`city-life-restore.ts`).
Gegenprobe: Bei nicht erreichbarem Ziel existiert kein belegter Fallback (Wartezeit? Aufgabe? Neuplanung?) — das ist die offene Stelle der Kette.
Nebenbefund: `city-life-movement.ts` und `pathfinding.ts` sind zwei Ebenen; ein Fehler in der oberen sieht wie ein Navigationsfehler aus.
Domäne: Sim, Render. Prio P2 · **#785**.

**DU-14 · BELEGT** — Navigationsverbraucher teilen Regeln, nicht Code.
`nav-grid.ts` (`stepOpen`, `walls` nur für WALL), `nav-reach.ts` (Erreichbarkeit), `pathfinding.ts` (A*), `nav-cache` je Layout-Identität; Verbraucher: Spielerbewegung, NPC-Bewegung, Platzierung.
Gegenprobe: `stepOpen` und `canPlaceAt` prüfen dieselbe Tür-Invariante an zwei Stellen — eine minimale Layoutänderung (Tür-Tile) wirkt auf beide.
Nebenbefund: Damit ist die kleinste Layoutänderung mit der größten Wirkung eine Tür — sie ändert Begehbarkeit **und** Bebaubarkeit.
Domäne: Sim, Render, UI. Prio P3 · **#840**.

**DU-15 · TEILWEISE BELEGT** — Engpässe sind vermutet, nicht gemessen.
Real: `nav-grid`-Raster, Wegkosten in `pathfinding.ts`, Belegung in `city-tile-occupancy.ts`, Frequenz aus `TICK_MS` (520 ms).
Gegenprobe: Kein Stresstest mit N Akteuren an einer Tür; die Frage „welche Gruppe bleibt am längsten stehen“ ist unbeantwortet (Befund).
Nebenbefund: `TICK_MS = 520` ist langsam genug, dass Stau selten sichtbar wird — der Engpass könnte im Test entstehen, nicht im Spiel.
Domäne: Sim, Render. Prio P2 · **#840**.

**DU-16 · WIDERSPRÜCHLICH** — Drei Speicher, keine gemeinsame Schreibregel.
`CityResidentState`/`cityLife` (`NpcMemory`, `city-life-memory.ts`), `Visitor`-Erinnerungen (max. 6), `narrative/relationships.ts` (Kanten, 200) mit Quellen Besuch/Streit/Kasse/Rivalenabrechnung.
Gegenprobe: `city-life-memory.ts` schreibt unabhängig von `relationships.ts`; eine Begegnung kann in einem Modell landen und im anderen fehlen.
Nebenbefund: Daraus folgt die konkrete Fehlinterpretation: ein NPC „erinnert“ den Streit, aber seine Beziehung zum Spieler bleibt unverändert — oder umgekehrt.
Domäne: Sim, Narrativ, Save. Prio P1 · **#763**.

**DU-17 · BELEGT** — Jede Grenze hat einen Schreibpfad und ein definiertes Verhalten.
pending 48 (Drop + `dropped`), recent 120 (Ring), relationships 200 (Retention mit gepinnten Visitor-Endpunkten), events 32/8, memories 6, journal 240 (Ring), knowledge 200, `MAX_CANDIDATES` 64, `MAX_FREEZE_TICKS` 200.
Gegenprobe: `dropped` zählt, aber niemand liest die Zahl im Spiel — der Verlust ist protokolliert, nicht sichtbar.
Nebenbefund: Der gefährdetste Typ ist der häufigste: Geld-Facts entstehen bei jeder Buchung und konkurrieren mit allem anderen um 48 Plätze.
Domäne: Narrativ, Save. Prio P2 · **#789**.

**DU-18 · BELEGT** — Journal, Facts und Diagnose sind drei getrennte Pfade.
Journal: typisiertes Ringpuffer-Ereignisprotokoll (240), `settleMoneyJournal` kopiert jede neue Ledger-Zeile **genau einmal** als `MONEY`-Event (`journaledSeq`). Facts: `narrative/pending` (48). Diagnose: `ledger.diagnose()`, `LedgerDiagnosis`.
Gegenprobe: `world.lastEvent` ist ein vierter Kanal — ein einzelner String, den `completeJobTask` und andere schreiben; er ist weder Journal noch Fact.
Nebenbefund: Genau dieser vierte Kanal ist die Diskrepanz: der Spieler sieht `lastEvent`, die NPCs erinnern nichts davon.
Domäne: Narrativ, UI, Wirtschaft. Prio P2 · **#541**.

**DU-19 · BELEGT** — Beiträge erreichen die Anzeige über eine Kette.
`content/narrative/contributions` → `turns/manifest.json` → `narrative:compile` → `registry/fragments.json` → `composer/registry.generated.ts` → `composition-context.ts` → `view.ts` → `GameView.narrative` → `src/ui/narrative-*`.
Gegenprobe: `documentation` (258) ist der größte Pool und geht **nicht** in Szenen; „optisch stark vertreten, mechanisch gering“ trifft genau ihn.
Nebenbefund: `memory` (54) ist quota-frei, wird aber im Spiel gelesen — die Ausnahme ist sinnvoll, verzerrt aber jede Mengenaussage.
Domäne: Narrativ, UI. Prio P2 · **#822**.

**DU-20 · BELEGT** — Choices sind geparst, geprüft und einmalig ausgeführt.
Parser + Allowlist + Preflight (NAR-08), `EVENT_RESOLVED` als Fact schließt den Kreis, Effekte laufen über `dismissNarrativeCmd`/Choice-Handler.
Gegenprobe: Eine gültige Choice kann Zustand ändern, den ein anderes System bereits begrenzt hat (z. B. Relationships-Limit 200) — die Reihenfolge entscheidet, wer gewinnt.
Nebenbefund: Der Kreis Command→Fact→Event→Choice→Fact ist elegant, aber er hat keine Tiefenbegrenzung; Rekursion wird nur durch „neue Facts warten auf den nächsten Lauf“ verhindert.
Domäne: Narrativ, Sim. Prio P3 · **#789**.

**DU-21 · NICHT IMPLEMENTIERT** — Ein Standort ist strukturell, nicht konfigurierbar.
`world.player.property` ist ein Einzelwert (`property.ts:70/79/119/149`); `propertyWorld()` gibt `null` ohne Eigentum und filtert sonst über **eine** `propertyArea(world)`; `PROPERTY_ACCOUNT` ist ein festes Konto.
Gegenprobe: Ein zweiter Standort hätte dieselbe Area und dasselbe Konto — die Zuordnung wäre nicht falsch, sondern unmöglich.
Nebenbefund: Die erste Änderung ist damit `property: Property | null` → `properties: Property[]` plus Konto pro Standort — eine Save-Migration, kein UI-Feature.
Domäne: Sim, Save, Wirtschaft. Prio P1 · **#540**.

**DU-22 · BELEGT** — Zuordnung ist geometrisch, nicht identitär.
`propertyWorld()` filtert `zones`, `furniture` und `guests` über `inArea(area, x, y)`. Es gibt keine Gebäude-ID im Filter.
Gegenprobe: Ändert sich der Eingangsbereich oder der Grundriss, wechseln Möbel/Gäste die Zuordnung **allein durch Geometrie** — ohne dass jemand sie bewegt hat.
Nebenbefund: Das ist der stärkste Beleg dafür, dass Eigentum räumlich und nicht identitär gedacht ist — und damit der strukturelle Blocker für #540.
Domäne: Sim, Render, Save. Prio P1 · **#540**.

**DU-23 · TEILWEISE BELEGT** — Personal hat sechs Module und keine Bewertung.
`staff.ts` (Zustand), `staff-queries.ts` (Abfragen), `staff-qualification.ts` (Qualifikation), `staff-step.ts` (Ausführung), `staff-cashier.ts`, `staff-porter.ts`.
Gegenprobe: Kein Modul bewertet Leistung; S3-10 ist offen. Eine Einstellung ist damit ohne messbare Rückmeldung.
Nebenbefund: Zwei Rollen haben eigene Module — die anderen laufen generisch; die „Rollenvielfalt“ ist faktisch Zweiklassengesellschaft.
Domäne: Sim, Wirtschaft. Prio P2 · **#810**.

**DU-24 · TEILWEISE BELEGT** — Drei Event-Welten, ein gewünschter Abend.
`venue-event.ts` (Phasen), `fight-bets.ts` (Quoten bei Abgabe fixiert, Abrechnung über Ledger), `esport.ts`/`esport-event.ts`/`esport-odds.ts`, `arena.ts` (Stufen aus Journal-Belegen).
Gegenprobe: S3-09 offen; PR #938 lag offen. `esport-odds.ts` und `fight-bets.ts` sind zwei Quotenmodelle.
Nebenbefund: Damit ist die Frage „welcher Übergang fehlt“ beantwortet: nicht die Durchführung, sondern die **gemeinsame Instanz** (eine Event-ID für Anmeldung, Quote, Ergebnis, Auszahlung).
Domäne: Sim, Wirtschaft, Narrativ. Prio P2 · **#787**.

**DU-25 · TEILWEISE BELEGT** — Ein Konto, eine Besuchermenge, viele Bereiche.
`business-areas.ts` (Zonen), `hybrid-flow.ts` (Bereichswechsel), ein `HAUSKONTO`, `demand.ts` (Nachfrage), `bar-service.ts` (Bar).
Gegenprobe: Ein Gast, der Bar und Automat besucht, verändert beide Umsätze über dasselbe Konto — die Zuordnung „welcher Bereich hat verdient“ ist im Ledger nur über `reason`/`game` erkennbar, nicht über ein Bereichsfeld.
Nebenbefund: Genau diese fehlende Bereichsdimension macht Bereichs-Balancing unmöglich, ohne Buchungen zu raten.
Domäne: Wirtschaft, Sim. Prio P2 · **#810**.

**DU-26 · BELEGT** — Integrität ist dreifach gesichert.
`ledger.ts` (`transfer`, `verifyLedgerIntegrity`, `verifyIncremental`, `diagnose`), `ledger-integrity.ts` (`applyEntry`, `verifyBalanceSheet`, `isMintingAccount`), `vacoin.ts` (Integer, `mulVC` per BigInt). Transaktional: beide Salden vor Mutation, `InsufficientFundsError`.
Gegenprobe: `transfer` hat viele Aufrufer; die längste Folge ist der Umbau (`remodel.ts`: Deckung → Gastansprüche → Geld → Haustausch) — dort ist ein Teilfehler am teuersten.
Nebenbefund: `entriesSince` und `entriesAfterSeq` sind zwei Lesepfade derselben Historie; ein dritter wäre Redundanz, zwei sind schon Grenzfall.
Domäne: Wirtschaft. Prio — · kein Issue.

**DU-27 · TEILWEISE BELEGT** — Schulden haben einen Schreiber und eine Bremse.
`openLiability` (anlegen), `openLiability`-Buchungen bei Auszahlungsunterdeckung, `repayDebt` (Tilgung nur aus Überschuss über `HOUSE_FLOAT`). Kein zweites Schuldenkonto.
Gegenprobe: Die Bremse ist eine Konstante, kein Spielentscheid; ein Betrieb knapp über `HOUSE_FLOAT` tilgt nie.
Nebenbefund: Damit ist der wirtschaftliche Engpass nicht die Schuldenhöhe, sondern die Float-Schwelle — eine Zahl, die kein Spieler kennt.
Domäne: Wirtschaft, Balance. Prio P2 · **#538**.

**DU-28 · BELEGT** — Geldentstehung hat genau einen Ort.
`MINTING_ACCOUNT = 'EXTERNAL_WORLD'` (`ledger-integrity.ts:7`), `isMintingAccount` als einzige Ausnahme von der Deckungsprüfung; `circulating` summiert alle Nicht-Minting-Konten.
Gegenprobe: Eine falsche Herkunft wäre an der Bilanz **nicht** erkennbar, solange beide Seiten stimmen — die Buchung nennt `from`/`to`, aber keine Absicht.
Nebenbefund: Die formale Ausgeglichenheit ist damit stark, die semantische Herkunft schwach — genau die Lücke, die ein falsch zugeordneter Transfer ausnutzen würde.
Domäne: Wirtschaft. Prio P3 · **#840**.

**DU-29 · TEILWEISE BELEGT** — Zwei Bestände, zwei Buchungen, eine Lücke.
Bar: Bestand und Verbrauch in `bar-service.ts`, Preis in `drink-menu.ts`, `serveFreeDrink` verbraucht Bestand. Reparatur: `world.parts` + `actions.ts:64` (`repair`-Skill spart Teile).
Gegenprobe: Dekoration und Geräte haben **keinen** Bestand; ein gekauftes Gerät ist zustandslos, „verfügbar“ ist es immer.
Nebenbefund: Damit ist „im UI verfügbar, im Bestand nicht vorhanden“ für Deko/Geräte strukturell unmöglich — und für Getränke möglich, wenn Bestand und Anzeige getrennt gelesen werden.
Domäne: Wirtschaft, UI. Prio P2 · **#809**.

**DU-30 · TEILWEISE BELEGT** — Drei Ausnutzungskandidaten, einer davon belegt.
① `mulVC` floort zugunsten der Bank — kein Exploit, aber systematische Mini-Verluste. ② Eigene Runden: `store/own-play.ts` hält die offene Kartenrunde je Gerät, um Doppel-Settle zu verhindern — der Schutz liegt im **Store**, nicht im Core. ③ `repair`-Skill spart jede n-te Reparatur ein Teil (`skillEffect`-Text) — der Sparpfad ist nicht gegen Wiederholung geprüft.
Gegenprobe: Ein Reload zwischen Deal und Settle verliert den Store-Schutz, wenn die offene Runde nicht im Save liegt.
Nebenbefund: Genau dieser Fall ist der wahrscheinlichste Exploit: nicht Betrug am Ledger, sondern Zustandsverlust zwischen zwei Commands.
Domäne: Wirtschaft, Save, Spiele. Prio P2 · **#792**.

**DU-31 · BELEGT** — Acht Engines, ein Vertrag, ein dokumentierter Sonderweg.
Alle acht Spiele (`contracts.ts:14`) laufen über `playAction`; POKER wird über Handverteilung/Schuh bewertet statt RTP (`poker-distribution.test.ts`, `poker-table.test.ts`).
Gegenprobe: Der stärkste Sonderweg ist damit nicht ein Spiel, sondern die **Bewertungsmethode**: sieben Spiele messen RTP, eines misst Verteilung.
Nebenbefund: Das ist methodisch korrekt und trotzdem eine Vergleichbarkeitslücke: „RTP“ ist für POKER keine gültige Kennzahl.
Domäne: Spiele. Prio — · kein Issue.

**DU-32 · TEILWEISE BELEGT** — Parameter sind Daten, der wirksamste ist benannt.
`slot-profile.ts`/`slot-models.ts` (`lineStats`), `slot-paytable.ts`, `contracts.ts` (`houseEdgeBps`, `bonusBps`), `risk-card.ts`.
Gegenprobe: Der stärkste Einzelparameter ist `houseEdgeBps` — er wirkt auf jeden Gewinn, während `bonusBps` nur Gewinne erhöht und Einsätze unberührt lässt.
Nebenbefund: `MAX_OWN_BET_MULTIPLE` (10× Mindesteinsatz) begrenzt die Wirkung des Hausvorteils nach oben — eine Begrenzung, die kein Spieler sieht.
Domäne: Spiele, Wirtschaft. Prio P3 · **#789**.

**DU-33 · BELEGT** — Zwei Streams, ein Save-Feld, keine dritte Quelle.
Gameplay: `core/rng/streams.ts` (gameplay), verbraucht in `tickWorld`/`playRound`; Presentation: `render/rng.ts`. `assertGameplayRng` weist fremde Ströme ab; `entropySeed()` ist der einzige Krypto-Ort.
Gegenprobe: Eine dritte Quelle könnte nur über eine neue Datei entstehen — ESLint verbietet die Aufrufe global, also wäre sie sofort rot.
Nebenbefund: Das Save trägt **einen** `prngState` — die Trennung ist damit eine Laufzeit-, keine Speichertrennung.
Domäne: RNG, Save. Prio — · kein Issue.

**DU-34 · TEILWEISE BELEGT** — Mod-Wirkung ist zentral, Rückbau ist die offene Stelle.
`resolveModEffects` (dedupliziert, FREE_DRINK nur mit Kosten, EXTRA_REEL nur SLOT), `installMod` (Walzenzahl + Gedächtnislöschung), VELVET über `guestTier`.
Gegenprobe: Rückbau/Deinstallation ist nicht als eigener Pfad belegt; ein Mod, der die Walzenzahl erhöht, verändert die Engine dauerhaft.
Nebenbefund: EXTRA_REEL ist der stärkste Kandidat für Überverstärkung: zwei Wirkungen (mehr Walzen, Gedächtnis weg) aus einer Installation.
Domäne: Spiele, Wirtschaft, Balance. Prio P2 · **#840**.

**DU-35 · BELEGT** — Drei Aufrufstellen, alle im fremden Haus.
`store/foreign-play.ts:64` (Spin), `:112` (Kartendeal), `:145` (Auszahlung) rufen `recordExclusionPlay`/`Win`; `own-play.ts` ruft keine.
Gegenprobe: `recordExclusionWin` wird zusätzlich **innerhalb** von `recordExclusionPlay` (`self-exclusion-bet.ts:72`) gerufen — eine doppelte Zählung ist damit konstruktiv möglich, wenn beide Wege greifen.
Nebenbefund: Das ist der einzige Ort im Audit, an dem eine Zählung zwei Quellen hat; die Wirkung (Sucht-/Verlustzähler) ist spielrelevant.
Domäne: Spiele, Narrativ. Prio P2 · **#840**.

**DU-36 · BELEGT** — UI liest, Commands schreiben, dazwischen liegt der Snapshot.
UI-Elemente senden Commands an `world-store.ts`; sie halten lokalen Zustand nur für Darstellung (`action-card.tsx`: Anker/Sheet). `GameView` wird aus dem Zustand gebaut.
Gegenprobe: Ein älterer UI-Stand ist möglich, wenn ein Command scheitert und die UI ihren lokalen Optimismus nicht zurücknimmt — dafür gibt es keinen Test.
Nebenbefund: Der einzige Ort, an dem „UI zeigt alt“ entstehen kann, ist ein lokal optimistisches Element; reine Snapshot-Leser können nicht veralten.
Domäne: UI, Store. Prio P3 · **#840**.

**DU-37 · WIDERLEGT** — Die Testdatei existiert, die Capability sagt das Gegenteil.
`src/ui/__tests__/action-card.test.tsx` existiert; `menu-action-contract.test.ts` ebenfalls. `capabilities.json` führt beide Aktionen als `unverified` mit `testIds: []` und der Notiz „fehlt noch“.
Gegenprobe: Der 6/7-Übergang Radial→Sheet ist in keinem der beiden Tests als Schwelle belegt — die Lücke ist real, nur anders als behauptet.
Nebenbefund: Damit ist die Frage „welche Lücke bleibt, obwohl ein Testdateiname existiert“ beantwortet: die Schwelle, nicht die Karte.
Domäne: UI, Governance. Prio P1 · **#940**.

**DU-38 · WIDERSPRÜCHLICH** — Die Sync-Klasse existiert, der Positionsweg ist bestritten.
`render/city-actor-sync.ts:46` `class CityActorSync`, instanziiert in `floor-view.ts:118`, genutzt in `floor-animate.ts`/`view-layers.ts`; Test `city-actor-sync-lifecycle.test.ts` (Lebenszyklus).
Gegenprobe: Der Test prüft **Lebenszyklus** (Anlegen/Entfernen), nicht Position/Richtung/Depth — und #640 (`zustand-CLAIMED`) behauptet genau dort den Bruch.
Nebenbefund: Damit ist die unbelegte Verbindung präzise benannt: Snapshot-Position → Sprite-Position, nicht die Klasse selbst.
Domäne: Render, Sim. Prio P2 · **#640**.

**DU-39 · TEILWEISE BELEGT** — Kostenpfade sind plausibel, der Engpass ist ungemessen.
Kandidaten: `furniture-atlas.ts`/`guest-rig.ts` (Texturen), `floor-material.ts` (Materialauflösung), `regionHash` (Chunk-Cache), `depth.ts` (Sortierung), `city/*` (Ambient).
Gegenprobe: `DepthStage` sortiert nur bei geänderter Tiefe — ein Engpass entsteht daher bei **vielen** Tiefenänderungen, nicht bei vielen Objekten.
Nebenbefund: Das ist eine testbare Hypothese, die niemand gemessen hat; sie ist billiger zu prüfen als ein GPU-Profil.
Domäne: Render, Performance. Prio P2 · **#651**.

**DU-40 · TEILWEISE BELEGT** — Assets kommen aus Manifest und Fallback, die Lücke ist sichtbar.
`floor-material.ts` (einzige Auflösung, stabile Fallback-ID), `wall-art.ts`, `furniture-atlas.ts`, `room-dressing.ts`, `art-tokens.ts`; Manifest über `assets:manifest`/`verify:assets`.
Gegenprobe: Nur CARPET hat eine echte Textur — alle anderen Materialien sind prozedural. „Falsches Asset lässt ein System falsch aussehen“ trifft damit strukturell zu.
Nebenbefund: Weil der Fallback stabil ist, sieht ein fehlendes Asset **absichtlich** aus — die Fehlerklasse ist im Bild nicht von Design zu unterscheiden.
Domäne: Render, Assets. Prio P2 · **#786**, **#657**.

**DU-41 · TEILWEISE BELEGT** — Die Nutzlast ist breit, die Ableitung ist der Risikopunkt.
`toSavedGame` speichert u. a. `layout`, `furniture`, `guests`, `player`, `staff`, `crates`, `stains`, `parts`, `city`, `cityLife`, `cityGrowth`, `visitors`, `journal`, `archive`, `fightBets`, `look`, `plinko`, `prngState`.
Gegenprobe: `layout` und `furniture` reisen getrennt; `size`/`zones` sind abgeleitet. Nach dem Laden kann ein Feld eine andere Bedeutung haben (z. B. `guests` vor/nach `hydrateJobState`).
Nebenbefund: Die Hydration ist die eigentliche Wahrheit — `hydrateJobState` normalisiert den Job, aber es gibt keine äquivalente Normalisierung für `guests`.
Domäne: Save, Sim. Prio P2 · **#792**.

**DU-42 · BELEGT** — Alle Grenzen sind Konstanten, keine wächst unbegrenzt.
pending 48, recent 120, relationships 200, events 32/8, memories 6, journal 240, archive, knowledge 200, `MAX_CANDIDATES` 64, `MAX_FREEZE_TICKS` 200.
Gegenprobe: `world` selbst hat keine Gesamtgrenze; `archive` und `journal` sind Ringe, aber `visitors` und `cityLife` wachsen mit der Stadt.
Nebenbefund: Der am schnellsten wachsende Datentyp im Verhältnis zum Nutzen ist `visitors`: jede Boilerplate-Erinnerung kostet Save-Bytes, ihr Nutzen ist eine Rückkehrchance.
Domäne: Save, Sim. Prio P3 · **#822**.

**DU-43 · TEILWEISE BELEGT** — Fehlerpfade existieren, die Spielerreaktion nicht.
`saveWorld` gibt `boolean` zurück; `localStorage.setItem` (`save.ts:102`); `ERR-5001` für beschädigte Importe; `transfer.ts` mit Trockenlauf.
Gegenprobe: Ob ein `false` aus `saveWorld` in der UI sichtbar wird, ist nicht belegt — ein stiller Speicherfehler ist damit möglich.
Nebenbefund: Der gefährlichste Fall ist nicht Quota, sondern ein **teilweise** geschriebener Stand: `setItem` ist atomar, aber der Aufrufer kennt das Ergebnis nicht zwingend.
Domäne: Save, UI. Prio P2 · **#792**.

**DU-44 · TEILWEISE BELEGT** — Voraussetzungen sind klar, der 200-Tick-Test fehlt.
Voraussetzungen: `prngState`, `tick`/`day`, keine Wanduhr, feste Reihenfolge, ein Stream. `living-world-multiseed.test.ts` (PASS) belegt Reproduzierbarkeit über Seeds.
Gegenprobe: Der geforderte Vergleich „Save → 200 Ticks → identische Welt/Ledger/NPC-Entscheidungen“ existiert nicht; `prng-persistence.test.ts` prüft nur den Zustand.
Nebenbefund: `cityLife` ist die längste reproduzierbare Kette (Bewegung × Entscheidung × Bedürfnis) und damit die entscheidende Komponente.
Domäne: Save, Sim, RNG. Prio P2 · **#792**.

**DU-45 · BELEGT** — v5–v11 migrieren, v3/v4 werden verworfen.
`save.ts:15/16`, `migrate.ts:46-47`; `replaySave` leitet Layout für v5–v10 aus der Vorlage ab, normalisiert Narrative/Rivalen, verwirft kaputte Einträge.
Gegenprobe: Der am wenigsten offensichtliche Verlust ist ein **normalisierter** Narrativ-/Rivalenzustand: der Spieler startet mit anderen Beziehungen, ohne dass etwas „fehlt“.
Nebenbefund: v3/v4 sind still — für einen Spieler, der seit Monaten nicht gespielt hat, ist der Unterschied zwischen „migriert“ und „verworfen“ unsichtbar.
Domäne: Save. Prio P3 · **#841**.

**DU-46 · TEILWEISE BELEGT** — Viele Gates prüfen Struktur, wenige prüfen Produktverhalten.
Struktur/Metadaten: `docs`, `catalog`, `generated`, `tree`, `redundancy`, `impact-graph`, `test-placement`, `capabilities` (Form), `assets` (Manifest). Verhalten: `tests`, `narrative`, `headless-core`, `check:loc` (indirekt).
Gegenprobe: Das grünste Gate mit der geringsten Prüftiefe ist `capabilities`: PASS bei nachweislich falschen Aussagen (#940).
Nebenbefund: Damit ist die Antwort auf „wo erzeugt grün mehr Sicherheit als gerechtfertigt“ eindeutig: Capability-Manifest und `generated` — beide prüfen Konsistenz, nicht Wahrheit.
Domäne: Qualität, Governance. Prio P1 · **#940**.

**DU-47 · WIDERSPRÜCHLICH** — Sechs Dateien, fünf Wahrheiten.
`package.json` 0.3.281; `ROADMAP.md` 0.3.267; `INVENTORY.md` 3393 vs. 3397; `ARCHITECTURE.md` 5 Profile/8/14 Gates vs. Code 8/11/15; `capabilities.json` 5 unverified vs. Baum; `TEST-CATALOG.md` veraltet (Gate rot).
Gegenprobe: Der gefährlichste Widerspruch für einen Worker ist `ARCHITECTURE.md`: er beschreibt 5 Profile und 14 Gates — wer danach arbeitet, hält `verify:integration` für den vollen Nachweis.
Nebenbefund: Damit ist die Frage „welcher Widerspruch führt zu einer veralteten Architektur“ beantwortet: die Profilbeschreibung, nicht die Versionsnummer.
Domäne: Doku, CI. Prio P1 · **#941**, **#927**.

**DU-48 · TEILWEISE BELEGT** — Ein Teil der Regeln ist mechanisch erzwungen.
Erzwungen: Determinismus (ESLint), Schichtgrenzen (`headless-core`/`tree`), Scope (`verify:scope`), Claim (Precommit), Branch-Schutz (**per API geprüft**: `enforce_admins: true`, Force-Push/Löschen verboten, **0** Pflicht-Reviews, **keine** Required-Status-Checks).
Nur Doku: „Nur Maintainer schließen“, „RELEASE done verlangt PR“, „review-waiting bei Übergabe“, „Narrative-Baustein pro Commit“.
Gegenprobe: `required_approving_review_count: 0` heißt: der Maintainer kann ohne zweite Stimme mergen — die Rollentrennung ist eine Konvention, keine Mechanik.
Nebenbefund: Genau deshalb ist #909 (Worker hat Maintainer-Aufgaben übernommen) kein Einzelfall, sondern die erwartbare Folge.
Domäne: Governance. Prio P1 · **#884**, **#909**.

**DU-49 · TEILWEISE BELEGT** — Mehrere Skripte teilen Aufgaben, aber meist mit klarer Rollentrennung.
Paare: `verify:assets` ↔ `assets:manifest` (prüfen ↔ schreiben), `verify:docs` ↔ `docs:sync` (prüfen ↔ Marker), `verify:capabilities` ↔ `capabilities.json` (prüfen ↔ Daten), `catalog` ↔ `TEST-CATALOG.md`, `verify:claims` ↔ `claim:register`.
Gegenprobe: `agent:verify` und `run-pipeline` leiten beide einen Gate-Plan ab; laut Architektur aus derselben Quelle (`pipeline-plan.mjs`) — belegt durch den gemeinsamen Import.
Nebenbefund: Die echte Doppelung ist nicht Skript-gegen-Skript, sondern **Prüfer gegen Schreiber**: `verify:*` prüft, was `sync-*` schreibt — und beide können irren, wenn die Quelle falsch ist (#927).
Domäne: CI, Governance. Prio P3 · **#875**.

**DU-50 · TEILWEISE BELEGT** — Die Kette ist definiert, das Bindeglied zur Abnahme fehlt.
Kette: Commit → `turn:finish` (Version-Bump, betroffene Tests, `verify:light`) → PR → `verify:all` → Merge → `ci-tag-release.mjs` (Tag aus `package.json`) → Release.
Gegenprobe: Zwischen Tag und „spielbarer Build“ liegt **keine** Browserabnahme und kein Artefakt-Hash; `docs/screenshots/current` ist der einzige Beleg und nicht an den Tag gebunden (#656 offen).
Nebenbefund: Damit kann eine formal erfolgreiche Auslieferung stattfinden, deren Bildstand älter ist als der Code — genau der Fall, den PR-08 verhindern soll.
Domäne: Release, alle. Prio P1 · **#656**, **#795**.

## Board-Bereinigung (Stand 2026-11-15, damals 96 offene Issues)

Verdikte: **KEEP** (aktuell, ausführbar) · **UPDATE** (aktuell, unvollständig beschrieben) · **SPLIT** (zu groß) · **MERGE** (doppelt) · **CLOSE** (erledigt/gegenstandslos) · **BLOCKED** (Blockade benannt). Jedes offene Issue erscheint genau einmal.

| Verdikt | Issues | Begründung |
| --- | --- | --- |
| KEEP (P0, Produkt) | #782 | Startpfad ohne Gerät; erste spielbare Handlung fehlt |
| KEEP (P0, Gate/Board) | #942, #941, #940, #910, #909, #864, #696, #684, #634, #913 | blockieren Nachweis, Board-Wahrheit oder Rollentrennung; #942 zuerst |
| KEEP (Produkt P2) | #810, #809, #808, #807, #805, #801, #797, #796, #795, #794, #793, #792, #791, #790, #789 | Spielschleife, Karriere, Stadt, Abnahme — jeweils eigenständig abnehmbar |
| KEEP (Render) | #786, #785, #784, #783, #780, #779, #778, #777, #757, #657, #656, #651, #650, #649, #647, #640 | Bildbelege und S2-09–S2-12; Reihenfolge R-0 → R-4 |
| KEEP (Wirtschaft/Vision) | #542, #541, #540, #538, #537, #599, #598 | Portfolio, Rechnungen, Narrative-Anbindung, Umgebungsdimensionen |
| KEEP (Infra) | #927, #895, #881, #880, #879, #877, #876, #875, #874, #869, #868, #867, #866, #865, #863, #862, #852, #845, #844, #842, #841, #840, #838, #837, #826, #822, #754, #761? | je eine konkrete mechanische Lücke |
| UPDATE | #927, #822, #864, #884, #826, #754, #809, #677 | Audit hat Messwerte ergänzt; #677 ist nach #887 der **einzige** Pin und muss das sagen; #754 braucht eine authentifizierte Zählquelle |
| MERGE | #763 + #926; #634 + #913; #888 → #937; #886 → #883/#884 | #763/#926 beschreiben dieselbe Lücke (Contract vs. Tier-System); #634/#913 beide Merge-Reihenfolge; #888 ist durch diesen Audit erledigt; #886 ist der Sammelbegriff zu #883/#884 |
| MERGE (Prompt-Incidents) | #893, #892, #891, #890, #889 | fünf Issues für eine Pflicht (Prompt-Register + Board-Beleg); #885 hat die Vereinheitlichung geschlossen — ein Issue „Prompt-Register pflegen" genügt |
| SPLIT | #684, #696 | #684 („vollständige Aufgaben-Aufteilung + mechanische Erzwingung") und #696 („einheitliche Kommunikation") sind je mehrere abnehmbare Ergebnisse |
| BLOCKED | #785, #796, #786, #798, #795 | hängen an S2-12 (#780), R-2/R-3 oder Desktop-Abnahme; Blockade ist im Issue zu benennen, nicht nur zu vermuten |
| BLOCKED (Entscheidung) | #561, #563 | Label `zustand-CLOSED` bei GitHub-State `OPEN` — Widerspruch, der eine Maintainer-Entscheidung braucht (schließen oder Label korrigieren) |
| CLOSE | — | **keine Schließung** in diesem Lauf: kein Issue hatte einen vollständigen Closeout-Beleg nach #920 |

**Nicht neu erzeugt, weil abgedeckt:** Startup/Browserbeleg (#785/#796), Wohnung (#777–#779), Render (#647–#651), Wirtschaft (#538/#540), Skills/Karriere (#801–#810). Diese Issues wurden präzisiert, nicht dupliziert.

**Label-Befund:** #852 und #822 tragen **kein** `zustand-*`-Label (2 von 96). #940/#941/#942 sind korrekt gelabelt.

## Empfohlene Merge-Reihenfolge

**Nachtrag 2026-11-18:** Wellen 0–2 sind abgearbeitet; #942, #927, #864, #782, #940, #941 und #884 sind geschlossen. Die Reihenfolge bleibt als damalige Empfehlung dokumentiert.

**Welle 0 — Nachweis reparieren (sequenziell, blockiert alles)**
1. **#942** — zwei rote Tests, Katalog, LOC. Ohne grünen `verify:fast` ist jede weitere Abnahme wertlos.
2. **#927** — `sync-generated --all`, Inventur 3397, `verify:light` grün.
3. **#864** — Board-Snapshot gegen Live-Board; danach ist der nächste Lauf informiert.

**Welle 1 — Board-Wahrheit (parallel zu Welle 2 möglich)**
4. **#940** — Capability-Manifest (Roster-Owner, wahre `testIds`, `verify-capabilities` härten).
5. **#941** — Gate-Zahlen aus `pipeline-plan.mjs` ableiten oder Zahlen entfernen.
6. **#884 + #869** — `review-waiting` am PR, mechanischer Check.

**Welle 2 — erste spielbare Handlung**
7. **#782** — Starter-Kiste und erster Gast im Startpfad.
8. **#777 → #778 → #779 → #798** — Wohnung als Raum (streng sequenziell, R-3).
9. **#780** — Stadtnetz S2-12 (nach #777–#779, weil R-2 auf R-3 folgt).

**Welle 3 — Produktvertiefung (parallel, getrennte Dateien)**
10. **#801 / #809** — Skill-Wirkleser und aktive Betriebsrollen. **Nicht parallel**, beide berühren `player-skills`/`business-*`.
11. **#763 + #926** (zusammengelegt) — eine Beziehungswahrheit.
12. **#540** — Portfolio (Save-Migration, eigener Zyklus).
13. **#538** — Rechnungen/Bank (Ledger, eigener Zyklus).

**Welle 4 — Sichtbarkeit und Release**
14. **#647 → #649 → #650 → #651 → #786** (Render-Nachweise), **#783/#784/#757/#656** (Bildsatz), **#795** (Gerät).

**Parallelisierungsregel:** gleiche Welle = getrennte Pfade. `world-store.ts`, `save.ts`, `migrate.ts`, `ledger.ts`, `contracts.ts` und `docs/INVENTORY.md` sind Einzelwriter-Pfade; zwei Lanes darauf sind ein Konflikt, kein Zufall.

## Abnahmekriterien des Goal-Issues

| Kriterium | Stand |
| --- | --- |
| Repository inventarisiert | **erfüllt** (Bestand, Gates, Board, Workflows, Branch-Schutz) |
| Commit SHA + Untersuchungsstand dokumentiert | **erfüllt** (`52f02ec`, 2026-11-15/16) |
| 50 UD-Fragen beantwortet | **erfüllt** (UD-01…UD-50) |
| 50 DU-Fragen beantwortet | **erfüllt** (DU-01…DU-50) |
| Jede Antwort mit Evidenz | **erfüllt** (Datei/Symbol/Test oder Messung) |
| Jede Frage mit Gegenprobe/Grenze | **erfüllt** (Feld „Gegenprobe") |
| Jeder Nebenbefund dokumentiert | **erfüllt** (Feld „Nebenbefund") |
| Nicht implementierte Anforderungen sichtbar | **erfüllt** (5 × NICHT IMPLEMENTIERT) |
| Fehlende Nachweise mit Aufgaben abgedeckt | **teilweise** — #840 bündelt mehrere Nachweislücken |
| Board vollständig abgeglichen | **erfüllt** (96 Issues klassifiziert) |
| Doppelte Issues konsolidiert | **offen** — MERGE-Verdikte sind beantragt, nicht ausgeführt (Maintainer-Akt) |
| Veraltete Issues nachweislich behandelt | **teilweise** (#561/#563 brauchen eine Entscheidung) |
| Alle offenen Issues mit begründeter Priorität | **teilweise** — 24 Issues ohne `prio-*` (Area-Roadmap-Items) |
| Neue Aufgaben mit Akzeptanzkriterien | **erfüllt** (#940/#941/#942) |
| Abhängigkeiten und Merge-Reihenfolge dokumentiert | **erfüllt** (Welle 0–4) |
| Domänen vollständig repräsentiert | **erfüllt** (A1–A10, B1–B10) |
| Doku und Board verweisen aufeinander | **erfüllt** (#937 ↔ `docs/AUDIT.md`) |
| Priorisierte Umsetzungsliste existiert | **erfüllt** |

**Das Goal-Issue bleibt offen**, bis die MERGE-Verdikte ausgeführt, #561/#563 entschieden und die fehlenden `prio-*`-Labels gesetzt sind.

**Nachtrag 2026-11-18:** Goal-Issue #937 ist geschlossen; die mit MERGE verdikteten Issues (#763/#926, #634/#913, #888, #886) sind es ebenfalls. Offen bleiben die Maintainer-Entscheidungen zu #561/#563 (Label `zustand-CLOSED` bei GitHub-State `OPEN`) und die `prio-*`-Lücken.

## Verbleibende Risiken

1. **Der Vor-PR-Nachweis war am 15.11. rot** (#942, #927) — **erledigt am 2026-11-18:** beide Issues sind geschlossen, `pnpm run verify` (quick, inkl. Suite) und `verify:release` laufen auf `a8f6f6fd` grün.
2. **`board:sync --check` erkannte am 15.11. keinen veralteten Kopf** (#864) — **erledigt:** `boardDrift` akzeptiert die Closeout-Relation `head == main^`; offen bleibt nur die Live-Lesbarkeit. Ohne `gh`-Token oder bei Rate-Limit meldet der Lauf `UNKNOWN` und keinen grünen Stand.
3. **Die Rollentrennung ist Konvention, nicht Mechanik**: `required_approving_review_count: 0`, keine Required-Checks (API-Beleg). #909 ist die Folge, nicht die Ausnahme.
4. **`service` und `cardDealing` versprechen Wirkung ohne Leser** (UD-07) — sichtbarer Fortschritt ohne mechanische Folge.
5. **Ein Immobilienportfolio ist strukturell unmöglich** (`player.property` Singular) — Expansion würde eine Save-Migration erzwingen.
6. **Zeit ist kostenlos** (UD-30) — jede Balance-Aussage ohne Zeitkosten ist unvollständig.
7. **Kein 200-Tick-Replay-Test** (UD-45/DU-44) — Determinismus ist behauptet, nicht für Save/Load bewiesen.
8. **Bildstand und Code sind nicht gebunden** (#656) — ein Release kann formal korrekt und ungesehen sein.

## Nächster ausführbarer Schritt

**Nachtrag 2026-11-18:** Kein Nachweis-Issue blockiert mehr. #942 (rote Tests) und #782 (erste spielbare Handlung) sind gemergt, der Vor-PR-Nachweis ist grün; der letzte rote Punkt auf `main` war `verify:commit-msg --head` und wird durch den Merge dieser Lane mit dem PR-Body als Commit-Body geheilt. Ausführbar bleiben **#684** (P0, mechanische Erzwingung des Issue-Boards) sowie die Doku-Schulden #982, #984, #998 und #1100.


## Doku-Belege: Issue #980 — AUDIT-100 P1-Einträge

Ergänzung durch Issue #980. Die nachfolgenden AUDIT-100-Einträge (alle P1, Status TEILWEISE oder WIDERSPRÜCHLICH) besitzen nun einen nachweisbaren Doku-Beleg. Widersprüche sind als solche dokumentiert und auf das zugehörige Issue mit Akzeptanzkriterien verwiesen.

- **UD-01 Spielkreislauf** — Beleg: Startpfad `new-game.ts` → `scene-commands.ts` → `city-encounter.ts`; Tagesende abgedeckt durch `first-evening.test.ts` (Eröffnung → Kiste → Gast → Buchung → Tagesende). Offener Gegenstand: Stadt- und Arbeitsstationen sind nicht an den Tagesabschluss gekoppelt → dokumentiert als offener Punkt, verweisend auf #780 und #810.
- **UD-07 Skills** — Beleg: mechanische Wirkleser auf `main` belegt für `cleaning` (`floor-work.ts:71`) und `repair` (`actions.ts:64`); `service` und `cardDealing` haben auf `main` keinen Wirkleser (einziger Leser `business-active-work.ts:197` ist untrackter WIP, #809). `skillEffect()` (`player-skills.ts:65`) liefert Strings, keinen Effekt.
- **UD-18 Gedächtnis** — Beleg: `NpcMemory` (`city-life-types.ts:60`), `Visitor`-Erinnerungen (max. 6), `narrative/relationships.ts` (Kanten, Limit 200). Widerspruch: drei Gedächtnismodelle ohne gemeinsamen Schreibvertrag; eine Begegnung kann im einen, nicht im anderen Modell landen. Dokumentiert über #763.
- **UD-30 Ressourcen** — Beleg: Zeit über `world.tick` fortgeschrieben in `tick.ts`; Ruf `world.reputation` ohne Verfall; Teile `world.parts` knapp. Befund: Zeit hat keine Opportunitätskosten (Warten ist immer gratis) → nicht bewertet, offener wirtschaftlicher Hebel (#810).
- **UD-37 Aktionsmenü** — Beleg: `src/ui/__tests__/action-card.test.tsx` existiert und deckt die Karte ab. Widerspruch: `docs/capabilities.json` führt `actions.radial-menu` / `actions.dropdown-sheet` als „Testdatei fehlt noch“ (`testIds: []`). Dokumentiert über #940; die Schwelle (6/7 Radial→Sheet) ist offen.
- **UD-46 Capabilities** — Beleg: `verify:capabilities` = PASS (13 Fähigkeiten, 8 aktiv, 5 unverified); `unverified`-Begründungen sind durch den Baum widerlegt (`action-card.test.tsx` existiert, `nav-edges.test.ts` existiert); Owner sind Legacy. Manifest ist „grün und falsch“. Dokumentiert über #940.
- **UD-49 Doku** — Beleg: `INDEX.md` und `ARCHITECTURE.md` nennen gleichzeitig unterschiedliche Gate-Zahlen („15“, „fünf Profile“, „acht“, „vierzehn“, „fünfzehn/sechzehn“); Code: 16 Required / 11 Light / 8 Profile. Widerspruch: vier Gate-Zahlen gleichzeitig auf demselben Commit. Dokumentiert über #941.
- **UD-50 Produktreife** — Beleg: Exit-Kriterien verteilt (`verify:all` 16 Gates, S5-09 bespielbare Stadt, PR-08/09/10, S5-08 APK). Kein einzelnes „Produkt reif“-Gate. Größte fehlende Abnahme: S2-12 (#780) → Stadtnetz nicht nachweisbar, daher „bespielbare Stadt“ nicht erfüllbar (#780, #795).
- **DU-16 Speicher-Sync** — Beleg: `city-life-memory.ts` (`CityResidentState`/`cityLife`), `Visitor`-Erinnerungen (max. 6), `narrative/relationships.ts` (Kanten, 200). Widerspruch: drei Speicher ohne gemeinsame Schreibregel; eine Begegnung kann im einen Modell landen und im anderen fehlen (NPC „erinnert“ Streit, Beziehung bleibt unverändert). Dokumentiert über #763.

Alle Einträge verweisen auf ein zugehöriges Issue mit Akzeptanzkriterien; Widersprüche sind dokumentiert, nicht stillschweigend aufgelöst.

## Doku-Belege: Issue #981 — AUDIT-100 P2-Einträge (Batch B)

Ergänzung durch Issue #981. Die nachfolgenden AUDIT-100-Einträge (Batch B, Status TEILWEISE oder WIDERSPRÜCHLICH) besitzen nun einen nachweisbaren Doku-Beleg. Widersprüche sind als solche dokumentiert und auf das zugehörige Issue mit Akzeptanzkriterien verwiesen.

- **UD-02 Motivation** — Beleg: `player-job-catalog.ts` (acht Jobs mit `requiredSkill`), `player-job-promotion.ts`, `payDailyWage` (`player-jobs.ts:100`); kein Geldzufluss ausserhalb des Casinos (jeder Job über Hauskonto oder `EXTERNAL_WORLD`) → offener zweiter Verdienstpfad (#801, #803).
- **UD-03 Ziele** — Beleg: fünf Ziele angelegt (Casino-Ausbau, Immobilie, Karriere, E-Sport, Ruf); ein Wechsel zwischen Zielen ist nirgends modelliert (#810).
- **UD-04 Versprechen** — Beleg: „Kisten schleppen“ hängt an S1-06 (#782, offen); „Anrufe & Nachrichten“ ohne Sim-Ereignis (#782, #797); README markiert Fiktion sauber (#782, #797).
- **UD-05 Druck** — Beleg: Erschöpfung erreichbar (Miete `goal.ts`, `HAUS_SCHULDEN` via `openLiability`, `injuryTicks`, Hunger), aber kein Konkurs-/Endzustand (#538).
- **UD-06 XP** — Beleg: `SKILL_XP_SOURCES` (`player-skills.ts:82`) zentral registriert; kein benannter Vergabepfad (`trainSkill`/`addSkillXp` nicht auffindbar) (#801).
- **UD-10 Konkurrenz** — Beleg: Priorisierung nur für NPCs (`city-life-score.ts`, `city-life-tiebreak.ts`); Spieler-Entscheidungslogik absichtlich offen (#810).
- **UD-11 NPC-Kette** — Beleg: zwei Identitätsmodelle (`city-life-*` vs. `visitors`); Synchronisation quellengebunden, nicht bei jeder Begegnung (#763).
- **UD-13 Ortsgraph** — Beleg: drei Orte-Quellen (Netz, Venues, Szenen) ohne gemeinsamen Test; S2-12 offen (#780).
- **UD-14 Navigation** — Beleg: Regeln getestet, Engpässe nicht (kein Stresstest an Tür/Kreuzung) (#840).
- **UD-15 Bevölkerung** — Beleg: vier Bevölkerungsbegriffe ohne gemeinsame Zählung (#822).
- **UD-20 Content** — Beleg: Leser registriert, Szenenkontext offen; `documentation`-Pool verzerrt jede Content-Menge-Aussage (#541).
- **UD-21 Bereiche** — Beleg: ein Konto, eine Besuchermenge; Unterschiede nur Öffnungszeit/Preis (#810, #540).
- **UD-22 Personal** — Beleg: Qualifikation ja, Bewertung nein (S3-10 offen) (#810).
- **UD-24 Events** — Beleg: zwei Quotenmodelle, keine gemeinsame Event-Instanz (S3-09 offen) (#787).
- **UD-25 Betrieb** — Beleg: aktive Betriebsrollen nur als untrackter WIP (`business-active-work.ts`, #809); auf `main` läuft Betrieb passiv (#809).
- **UD-27 Schulden** — Beleg: Tilgung nur aus Überschuss über `HOUSE_FLOAT` (#538).
- **UD-29 Waren** — Beleg: Getränke mit Bestand/Kreislauf; Deko und Geräte zustandslos ohne Bestand (#809).
- **UD-32 RTP** — Beleg: RTP-Messung (Monte-Carlo) nicht im Regelprofil; Klasse `statistics` läuft nicht in light/quick/fast (#789, #840).
- **UD-34 Mods** — Beleg: Wirkungen zentral aufgelöst (`resolveModEffects`, `installMod`); Kombinationen ungemessen; EXTRA_REEL hat zwei Wirkungen ohne gemeinsamen Test (#840).
- **UD-38 Assets** — Beleg: nur CARPET hat eine echte Manifest-Textur, Rest prozedural mit stabilem Fallback (#647, #786).
- **UD-39 Viewports** — Beleg: Layout-Tests grün, Abnahmetests im Vollauf rot (`worldStore.businessWork`, WIP #809) (#840, #795).
- **UD-40 Renderkosten** — Beleg: 2,42 MB ist Notiz, kein Gate; `verify:assets` prüft Manifest, nicht Bytes (#651).
- **UD-41 Save-Umfang** — Beleg: `toSavedGame` breit, Aufnahme von `narrative`/`rivals` nicht belegt (#792).
- **UD-42 Wachstum** — Beleg: Grenzen bekannt, keine Messung über 1/5/10/20 Tage (#840).
- **UD-45 Replay** — Beleg: Voraussetzungen benannt (`prngState`, keine Wanduhr, feste Reihenfolge); Save → 200 Ticks → identisch fehlt als Test (#792).
- **UD-47 Testarten** — Beleg: Katalog 436 Dateien / 423 Regellauf / 13 Mechanik; keine Domäne×Beweisklasse-Matrix (#840).
- **UD-48 Last** — Beleg: Langlast vorbereitet (`test:mechanics` 13, `soak` 100 000 Ticks), nicht gefahren (#789).
- **DU-02 Commands** — Beleg: Commands zentral über `world-store.ts`; keine Command→Leser-Inventur (#840).
- **DU-38 CityActorSync** — Beleg: Klasse existiert, Lebenszyklus getestet; Positions-/Richtungs-Sync nicht belegt (#640).

Alle Einträge verweisen auf ein zugehöriges Issue mit Akzeptanzkriterien; Widersprüche sind dokumentiert, nicht stillschweigend aufgelöst.

