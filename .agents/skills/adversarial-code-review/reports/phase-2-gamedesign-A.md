# Phase 2 (Gamedesign) — Zwischenbericht Sub-Agent A

**Fokusbereiche:** Stadt-NPCs (#640), Kneipe (#574 / PR #683), Skill-System (#654/#653/#978), Determinismus.
**Repo:** D:\Projekte\rigged-by-design · Branch `lane/governance/audit-fixes-2026-11-18`

---

## Zusammenfassung

| Bereich | Entscheidungen | Kritischste Note |
|---|---:|---|
| NPC-Rig (Körpervarianten, Kopffamilien, LOD) | 5 | A |
| Kneipe / Eingangskonvention | 4 | A |
| Skill-System-Implementierung | 4 | B |
| Determinismus (Spielpfad) | 4 | A |
| **Gesamt** | **17** | **A** |

Es gibt **keine D/F-Befunde**. Die geprüften Entscheidungen sind durchweg deterministisch, seed-stabil und getestet. Die beiden B-Noten betreffen Klarheit/Dokumentation (doppeltes Skill-System, Gebäude-ID-Inkonsistenz zwischen Preset und Test), nicht die Korrektheit.

---

## 1. NPC-Rig — Körpervarianten, Kopffamilien, LOD

### 1.1 Körpervarianten aus dem Charakter-Atlas (seed-stabil, gemischt)

**Note: A**

`rigPartsFor(seed)` in `src/render/rig-parts.ts:42–50` wählt pro Seed eine Kombination aus Torso (8 Varianten), Arm (14), Bein (15), Schuhwerk (14). Ein 32-Bit-Mixer (`mix`, Zeile 29–34) sorgt dafür, dass benachbarte Namen nicht dieselben Gliedmaßen tragen. Auswahl ist seed-stabil (`rigPartsFor(42) === rigPartsFor(42)`) und deckt alle deklarierten Varianten ab.

**Befunde:**
- Alle 4 Bauteile liegen als Frames im Charakter-Atlas und im Manifest; Test `rig-parts.test.ts` prüft 128 Seeds und jede deklarierte Variante (Zeile 32–61).
- Kein Zufall im Spielpfad; Auswahl rein aus Seed + Hash.

**Quelle:** `src/render/rig-parts.ts:42–50` · Test `src/render/__tests__/rig-parts.test.ts` · Claim `lane-governance-visual-phase2-npc-rig.json` (Issue 1139, merged, SHA `337be124e5...`).

### 1.2 Kopffamilien (3 Familien, head-03 als dritte Familie im Gast-Pool)

**Note: A**

`HEAD_TEXTURES` in `src/render/guest-parts.ts:40–48` listet 19 Kopftexturen (9× head-01, 9× head-02, 1× head-03-01.svg). `headTextureFor(seed)` (Zeile 50–52) weist jedem Gast seed-stabil einen Kopf zu; `headTextureForSeedOrFamily` (Zeile 61–63) bevorzugt die Spieler-Familie aus dem Look. `headFamilyFor` (Zeile 55–58) extrahiert die Familie aus dem Pfad.

**Befunde:**
- `head-03-01.svg` hängt hinten an; bestehende Gäste behalten ihren Kopf, nur der neue Bucket bekommt Familie 3 (Kommentar Zeile 37–38).
- Alle drei Familien im Gast-Pool abgedeckt (Test `rig-parts.test.ts:63–69`).

**Quelle:** `src/render/guest-parts.ts:40–63` · Test `src/render/__tests__/rig-parts.test.ts:63–69` · Claim `lane-governance-visual-phase2-lod-heads.json` (Issue 1142, merged).

### 1.3 LOD: Detail-/Silhouetten-Umschaltung am Rig

**Note: A**

`GuestRig` in `src/render/guest-rig.ts:26–147` unterhält `detail` (gezeichnete Figur), `pin` (Fern-Pin) und `lod` (Silhouette-Container). `setDetail(next)` (Zeile 92–99) blendet Figur/Pin/LOD um; Namensschild bleibt sichtbar nur bei Detail. `FloorCameraRig.updateLod()` (Zeile 74–81) steuert den Wechsel über `cam.detail`.

**Befunde:**
- Test `guest-rig-detail.test.ts` verifiziert Pin/LOD-Anzeige bei `setDetail(false)` und Rückkehr bei `setDetail(true)`.
- Kein zweiter Ticker; Render liest aus dem Floor-Ticker (kein doppelter Takt).

**Quelle:** `src/render/guest-rig.ts:83–99` · Test `src/render/__tests__/guest-rig-detail.test.ts` · `src/render/floor-camera-rig.ts:74–81`.

### 1.4 Deterministische Posen aus Tick + Phase

**Note: A**

`poseFor(state, nowMs, phase)` in `src/render/rig-pose.ts:27–87` rechnet jede Pose rein aus Zeit und Phase; keine Zufallsquelle. `actorStateFor` (Zeile 106–131) mappt Weltzustand auf Animationszustand (an einem Ort, Floor und Tests urteilen gleich). Kampf-/Verletzungsposen (`hurt`, `fight`) haben Vorrang vor allem anderen.

**Befunde:**
- Gleiche Zeit + gleiche Phase = gleiche Pose (Test `rig.test.ts:11–13`).
- `Math.sin`/`Math.abs`/`Math.floor`/`Math.imul` sind erlaubt (keine Entropie); eslint determinism lock erfasst nur `Math.random`/`Date.now`/`performance.now`.

**Quelle:** `src/render/rig-pose.ts:27–131` · Test `src/render/__tests__/rig-test.ts` · `src/render/__tests__/rig-combat.test.ts`.

### 1.5 Kopf-Textur vs. gezeichneter Schädel (mountHead)

**Note: A**

`mountHead` in `src/render/guest-head.ts:37–57` blendet den gezeichneten Schädel aus und legt Pixel-Kopf oder Textur-Sprite darüber. Porträt nutzt `pixelHead`, Gast nutzt `headTextureForSeedOrFamily`. Editor und Spieler lesen dieselben `LOOK_HAIR_RECTS` (Zeile 26–30).

**Quelle:** `src/render/guest-head.ts:22–57` · `src/render/rig-parts.ts:26–35`.

---

## 2. Kneipe / Eingangskonvention (#574, PR #683)

### 2.1 Kneipe als begehbarer Innenort mit Öffnungszeiten

**Note: A**

`bld_kiez_pub` ("Kiezkneipe Zum Anker") in `src/core/sim/building.ts:132–142`: `kind: 'PUB'`, `operatingHours: { openHour: 16, closeHour: 4 }` (Nachtbetrieb über Mitternacht), `locked: false`, `interiorLayoutId: 'layout_kiez_pub'`. `isBuildingOpen` (Zeile 46–62) behandelt Über-Mitternacht-Betrieb korrekt (`openHour > closeHour` → `normalizedHour >= openHour || normalizedHour < closeHour`). `canActorEnterBuilding` (Zeile 68–86) prüft Eigentümer/Mieter/Schlüssel, dann `locked`, dann Öffnungszeiten.

**Befunde:**
- Öffnungszeiten 16–4 decken den PUB-Intent (ab 19 Uhr) ab.
- `isBuildingOpen(pub, 19)` → `true` (Vertikal-Slice-Test `living-world-vertical-slice.test.ts:90`).

**Quelle:** `src/core/sim/building.ts:132–142, 46–86` · Claim `lane-governance-issue-574-entrance-convention.json` (Issue 574, PR #683, merged SHA `6b3b7365`).

### 2.2 Eingangskonvention: Türen auf H-Kante des Grundrisses, nie auf der Fahrbahn

**Note: A**

`CITY_PRESET_BUILDINGS` in `src/core/sim/building.ts:119–163`: alle Türen auf der Nordzeile-Fassadenkante (`y + h = 12`), z. B. Kneipe-Eingang `{x: 24, y: 12}`. `placeOfBuilding` in `src/core/sim/city-npc-shift.ts:66–73` mappt Gebäude-IDs auf Orte (KIEZ → `bld_kiez_pub`, MARKT → `bld_corner_shop`, CASINO → `bld_casino_grand`, HOME → `bld_player_home`), unbekannte Ziele fail-closed auf `null`. `cityBuildingWalls` in `src/core/sim/city-exterior.ts:58–75` lässt genau die Eingangskante offen.

**Befunde:**
- Test `city-building-entrances.test.ts` (Kommentar Zeile 8–9) referenziert explizit "#574": Vor #574 stand die Kneipentür auf der Hauptstraße statt auf dem Gehweg; jetzt liegt jede Tür auf einer H-Kante des eigenen Grundrisses, keine auf der Fahrbahn, alle in Gehweg-/Vorplatz-Zonen, Nordzeile auf gemeinsamer Fassade.
- `placeEntrance` in `src/core/sim/city-life-movement.ts:70–78` liefert die Tür des Gebäudes als Zielkachel; `routeTo` geht zur nächsten freien Kachel, wenn die Tür versperrt ist (kein Teleport).

**Quelle:** `src/core/sim/building.ts:132–139` · `src/core/sim/city-exterior.ts:58–75, 111–116` · `src/core/sim/city-life-movement.ts:70–104` · Test `src/core/sim/__tests__/city-building-entrances.test.ts` · Claim `lane-governance-issue-574-entrance-convention.json`.

### 2.3 Schichtzuordnung an der Kneipe (kuratiert + generisch)

**Note: A**

`CITY_SLOTS` in `src/core/sim/city-npc-shift.ts:26–30`: kuratierter Slot `slot_pub_host` (Wirtin, Rita, 16–24) an `bld_kiez_pub`. `slotForBuilding` (Zeile 93–108) vergibt generische Schichten aus `SHIFT_WINDOWS` (Kneipe: [[16,24],[17,23],[18,24],[16,22]]) an Index modulo Fensteranzahl. `inShift` (Zeile 119–124) behandelt Über-Mitternacht-Schichten.

**Quelle:** `src/core/sim/city-npc-shift.ts:26–30, 76–80, 93–124`.

### 2.4 Inkonsistenz: Gebäude-ID `bld_kiez_pub` (Preset) vs. `bld_pub_01` (Tests)

**Note: B**

Das Preset-Gebäude heißt `bld_kiez_pub` (`building.ts:132`). Die Vertikal-Slice- und Kontinuität-Tests erzeugen jedoch eine eigene `bld_pub_01` ("Kiezkneipe Zum Nagel" / "Zur Goldenen Mütze") mit eigenen Koordinaten (`living-world-vertical-slice.test.ts:81–89`, `city-life-continuity.test.ts:56–63`). Das ist funktional nicht kritisch (Tests bauen eigene Gebäude), aber es gibt keine einzelne kanonische Kneipen-Gebäude-ID, die Preset und Tests teilen.

**Empfehlung:** Eine kanonische Kneipen-ID festlegen und in Tests wiederverwenden (Dokumentations-/Klarheitsmaßnahme, kein Bug).

**Quelle:** `src/core/sim/building.ts:132` vs. `src/core/sim/__tests__/living-world-vertical-slice.test.ts:81` vs. `src/core/sim/__tests__/city-life-continuity.test.ts:56`.

---

## 3. Skill-System-Implementierung (#654/#653/#978)

### 3.1 Fach-Skills: vier Learn-by-Doing-Skills, validiert, linearer XP-Aufstieg

**Note: A**

`player-skills.ts:11–96`: `PlayerSkillId = 'cleaning' \| 'service' \| 'cardDealing' \| 'repair'`. `newPlayerSkills()` startet alle auf Level 1 / 0 XP. `grantSkillXp` (Zeile 46–58) akzeptiert nur positive Ganzzahlen, bucht XP, steigt auf bei Erreichen der Schwelle (`xpForNextLevel` linear: 100 + (level−1)·50), trägt Rest-XP über. `SKILL_XP_SOURCES` (Zeile 82–90) ordnet jede XP-Quelle exakt einem Skill zu (keine doppelte Anrechnung); `skillIdForSource` prüft Zuordnung.

**Befunde:**
- Test `player-skills.test.ts` deckt Initialisierung, Validierung (0, -5, 3.5 → kein Fortschritt), Reproduzierbarkeit, Levelaufstieg, Rest-XP-Übertrag, Quellen-Mapping, Effekte, Labels, Schwellen.
- `skillEffect` (Zeile 65–78) nennt konkrete In-Spiel-Wirkung ohne erfundene Boni (z. B. `cardDealing` behauptet keine Gewinnchance — entspricht Issue #978).

**Quelle:** `src/core/sim/player-skills.ts` · Test `src/core/sim/__tests__/player-skills.test.ts` · Claim `lane-sim-issue-978-skill-effects.json` (Issue 978, merged SHA `c6c93ee23f...`).

### 3.2 Karriere-Ansicht der Fach-Skills

**Note: A**

`player-career-skills.ts:22–34`: `careerSkills(world)` liefert alle vier Fach-Skills mit Level, XP, `xpToNext`, Effekt als `CareerSkill[]` für das Charakterfenster. Getrennt von `player-career.ts`, damit die Hot-Zone-Datei unter dem Logik-Budget bleibt.

**Quelle:** `src/core/sim/player-career-skills.ts`.

### 3.3 Doppel-Skill-System: Fach-Skills (player-skills) vs. 7 RPG-Attribute (player-rpg / hud)

**Note: B**

Es existieren zwei nebeneinanderstehende Skill-Systeme:
1. Fach-Skills (`player-skills.ts`: cleaning/service/cardDealing/repair, Learn-by-Doing).
2. Sieben RPG-Attribute (`player-rpg.ts`, `hud-labels.ts` `SKILLS`, HUD `spendSkillCmd` → `spendSkillCmd` in `store/venue-commands.ts`) mit Leveln, unspentPoints, Effekten wie `cleaningReach`, `maintenanceGain`, `luckInjuryFactor`.

Beide werden im HUD/Charakterfenster angezeigt. Das ist nicht widersprüchlich, aber doppelt gepflegt und für neue Entwickler nicht sofort unterscheidbar ("Fach-Skill" vs. "RPG-Attribut").

**Quelle:** `src/core/sim/player-skills.ts` vs. `src/core/sim/player-rpg.ts` · `src/ui/hud-labels.ts` · Test `src/ui/__tests__/skill-path.test.tsx` / `skill-tooltips.test.tsx`.

### 3.4 Skill-Effekte entsprechen den tatsächlichen Produktionswirkungen (#978)

**Note: A**

`skillEffect` nennt nur implementierte Wirkungen (Reinigungsradius, Gaststimmung, Geduld, Ersatzteilersparnis). Tooltip-Test (`skill-tooltips.test.tsx:55–84`) prüft, dass PER/TEC/LCK nur implementierte Wirkungen nennen und keine erfundenen Versprechen (Queue, Dreck, Mod, Reparatur, Jackpot, RNG).

**Quelle:** `src/core/sim/player-skills.ts:65–78` · Test `src/ui/__tests__/skill-tooltips.test.tsx` · Claim `lane-sim-issue-978-skill-effects.json`.

---

## 4. Determinismus (kein Math.random / Date.now / new Date() im Spielpfad)

### 4.1 eslint-Determinismus-Sperre über alle `src/**` Dateien

**Note: A**

`src/Config/eslint.config.mjs:84–130`: `no-restricted-properties` + `no-restricted-syntax` blockieren `Math.random`, `Date.now`, `performance.now`, `new Date()`, computed Keys, Namespace-Umwege (`globalThis.Math`, `window.Math`), Aliase, Destructuring, `getRandomValues`, `randomUUID`. `linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' }` (Zeile 95) — kein Kommentar darf eine Regel abschalten. Drei Pacing-Stellen (`floor-view.ts`, `floor-props.ts`, `music.ts`) dürfen `performance.now` lesen; alles andere unter `src/render` bleibt gesperrt. Die eine Entropie-Quelle ist `src/core/rng/streams.ts` (`entropySeed()`).

**Quelle:** `src/Config/eslint.config.mjs:14–169`.

### 4.2 Realer ESLint-Test der Sperre (computed Keys, Namespaces, Aliase, Destructuring)

**Note: A**

`src/Config/__tests__/eslint-determinism.test.ts` führt einen echten ESLint-Lauf gegen Probe-Code durch und prüft, dass alle verbotenen Varianten (Math computed, globalThis/window computed, Date computed, destructured, Alias) ≥1 Regel melden, während unkritische Nutzung (`Math.max`, `PI`-Destructuring, `entropySeed()`) durchgeht.

**Quelle:** `src/Config/__tests__/eslint-determinism.test.ts`.

### 4.3 Keine Treffer für Math.random / Date.now / new Date() im gesamten src

**Note: A**

Grep über `src` liefert **0 Treffer** für `Math.random`, `Date.now`, `new Date()`. Zufall und Zeit kommen ausschließlich aus dem geseedeten Prng (`src/core/rng/prng.ts`, Mulberry32) und aus `world.tick` / `world.day`. Präsentation und Gameplay nutzen getrennte RNG-Streams (`src/core/rng/streams.ts`).

**Quelle:** `src/core/rng/prng.ts`, `src/core/rng/streams.ts` · Grep `src` = 0 Treffer.

### 4.4 Deterministische Text-Auswahl (FNV-1a, kein RNG)

**Note: A**

`cityText` / `cityNightText` in `src/core/sim/city-model.ts:71–86` wählen Texte per FNV-1a-Hash über den sortierten Fragment-Pool; identischer Ort + identische Aktion = identischer Text, ohne RNG.

**Quelle:** `src/core/sim/city-model.ts:54–86`.

---

## Kritische Befunde (D/F)

**Keine.** Alle 17 geprüften Entscheidungen erhielten A oder B. Die Schwachstellen sind B-Noten (Klarheit/Dokumentation), keine Korrektheitsmängel:

1. **B** — Doppel-Skill-System (Fach-Skills vs. 7 RPG-Attribute) ist doppelt gepflegt (`player-skills.ts` vs. `player-rpg.ts` / `hud-labels.ts`).
2. **B** — Keine einzelne kanonische Kneipen-Gebäude-ID zwischen Preset (`bld_kiez_pub`) und Tests (`bld_pub_01`).

---

## Rückverfolgbarkeit (Auswahl)

| Entscheidung | Datei:Zeile | Commit / Issue / PR / Claim |
|---|---|---|
| Körpervarianten rigPartsFor | `src/render/rig-parts.ts:42–50` | Claim `lane-governance-visual-phase2-npc-rig.json` (Issue 1139, merged SHA `337be124e5...`) |
| Kopffamilien headTextureFor | `src/render/guest-parts.ts:40–63` | Claim `lane-governance-visual-phase2-lod-heads.json` (Issue 1142, merged) |
| LOD setDetail | `src/render/guest-rig.ts:83–99` | — |
| Deterministische Posen | `src/render/rig-pose.ts:27–131` | — |
| Kneipen-Gebäude + Öffnungszeiten | `src/core/sim/building.ts:132–142, 46–86` | Claim `lane-governance-issue-574-entrance-convention.json` (Issue 574, PR #683, SHA `6b3b7365`) |
| Eingangskonvention (Tür auf H-Kante) | `src/core/sim/city-exterior.ts:58–75` | Test `city-building-entrances.test.ts` (bez. #574) |
| Fach-Skills + XP | `src/core/sim/player-skills.ts:11–96` | Claim `lane-sim-issue-978-skill-effects.json` (Issue 978, SHA `c6c93ee23f...`) |
| eslint Determinismus-Sperre | `src/Config/eslint.config.mjs:84–130` | Test `eslint-determinism.test.ts` |

**Bericht:** `D:\Projekte\rigged-by-design\.claude\skills\adversarial-code-review\reports\phase-2-gamedesign-A.md`
**Entscheidungen:** 17 · **Kritischste Note:** A · **Keine D/F-Befunde.**
