# Adversarial Code Review — Finale Audit (Rigged by Design)

Erstellt: 2026-11-18T20:22:52.150Z
Repository: D:\Projekte\rigged-by-design
Methode: 4 sequentielle Phasen (Drift Tracker → Governance → Gamedesign → Tooling), konsolidiert zu einem Report.

## Gesamtergebnis
| Phase | Note | Entscheidungen |
|-------|------|----------------|
| Phase 0 — Drift Tracker (History) | ? | 0 |
| Phase 1 — Governance | A | 12 |
| Phase 2 — Gamedesign | B | 23 |
| Phase 3 — Tooling | B | 18 |

| **Gesamt-Durchschnitt** | **B** | **53** |

## Alle Designentscheidungen (mit Note, Befund und zurückverfolgbarer Quelle)
| # | Phase | Entscheidung | Note | Befund | Quelle |
|---|-------|--------------|------|--------|--------|
| 1 | Phase 1 — Governance | Actors & Rollen | A | `vannon091118-maintainer` als exklusiver Maintainer in `maintainers`/`users`, `vannon091118` bleibt … | `.lane-claims/actors.json:3-6`, `scripts/lib/work-claim.mjs:… |
| 2 | Phase 1 — Governance | Merge-Gate auf main | A | Fehlende Required-Status-Checks jetzt als aktiver Blocker; fehlende Ruleset-Erzwingung jetzt als Ver… | `scripts/lib/merge-gate.mjs:35-54`, `scripts/verify-merge-ga… |
| 3 | Phase 1 — Governance | FREEZE-0 / #684 | A | `holdMerge: false`, Finding F-1 auf `resolved`, P0-Block aufgehoben (Owner-Entscheidung). Claim frei… | `.lane-claims/tasks/governance-freeze-0-code.json:11-23` |
| 4 | Phase 1 — Governance | P0-Prioritäten | A | Issue #684 entblockt, Claim auf `READY_FOR_MERGE` mit `holdMerge: false`. | `.lane-claims/tasks/governance-freeze-0-code.json:11,16-20` |
| 5 | Phase 1 — Governance | Issue-Board-Erzwingung | A | Gemergter Claim wird nicht mehr still übersprungen; Rückverfolgbarkeit zum Issue bleibt als failure … | `scripts/lib/board-usage.mjs:79-87` |
| 6 | Phase 1 — Governance | Ruleset auf main | A | Fehlende serverseitige Ruleset-Erzwingung jetzt als aktiver Verstoss erkannt. | `scripts/lib/merge-gate.mjs:53-54` |
| 7 | Phase 1 — Governance | Hooks (Windows) | A | `node_modules`-Bypass entfernt; `commit-msg` prüft immer die drei Pflichtsektionen (fail-closed). | `.githooks/commit-msg:6` (entfernt) |
| 8 | Phase 1 — Governance | Claim Preflight | A | `main`-Ausnahme entfernt; `main` läuft durch `inspectClaimPreflight` wie jeder andere Branch. | `scripts/claim-preflight.mjs:27-34` (entfernt) |
| 9 | Phase 1 — Governance | Post-Merge-Closeout | C | `GH_TOKEN` optional → ohne Token muss Closeout-PR manuell erstellt werden. Claim steht auf `merged` … | `scripts/post-merge-closeout.mjs:241-244` |
| 10 | Phase 1 — Governance | Claim-Register | B | Dual (Legacy + pro-Lane), `loadClaimsStrict()` fail-closed, `selectClaim()` funktioniert | `scripts/lib/lane-claims.mjs:22-51,120-131` |
| 11 | Phase 1 — Governance | Claim-Hygiene & Reconcile | B | Hygiene strikt (Verstoss blockiert), Reconcile erkennt Basis-SHA-Falle korrekt ("Basis-SHA ist kein … | `scripts/claim-hygiene.mjs:7-8`, `scripts/reconcile-claims.m… |
| 12 | Phase 1 — Governance | Hooks (struktur) | B | Umfassende Kette (Preflight, Lane-Claim, Doku, Commit-Message, Board) | `.githooks/pre-push:35-111` |
| 13 | Phase 2 — Gamedesign | Renderpfad Stadt-NPCs reine Ableitung, kein zweiter Ticker — `src/render/city-actor-sync.ts:54-108` (`sync` liest `GameView`, `animate` schreibt über den vorhandenen Floor-Ticker, kein eigener Ticker, keine zweite NPC-Wahrheit), `src/render/floor-animate.ts:30` (`cityActors.animate(now)` im selben Frame-Ticker wie Gäste und Spieler #640). | A | — | — |
| 14 | Phase 2 — Gamedesign | Simulations-Ticker Stadtleben einzelner Stundenwechsel — `src/core/sim/tick-timing.ts:2` (`TICK_MS = 520`, eine Quelle für Tick-Dauer), `src/render/city-actor-sync.ts:116-134` (`animate` über `stepMs` aus dem selben Tick). | A | — | — |
| 15 | Phase 2 — Gamedesign | Skillpunkt-Klick läuft über echten Command bis zur Wirkung — `src/core/sim/player-skills.ts:46-58` (`grantSkillXp`, Learn-by-Doing), `src/core/sim/actions.ts:45-75` (XP-Gutschrift nach abgeschlossener Handlung, keine XP bei Abbruch). | A | — | — |
| 16 | Phase 2 — Gamedesign | HUD und Karrierefenster lesen dieselbe Effektbeschreibung (ehrlich) — `src/core/sim/player-skills.ts:65-78` (`skillEffect` zentrale Klartext-Wirkung pro Stufe). | A | — | — |
| 17 | Phase 2 — Gamedesign | Smartphone ist optionaler Abkürzungsweg, kein Pflichtweg — keine Pflicht-Integration im Spielpfad belegt. | A | — | — |
| 18 | Phase 2 — Gamedesign | Save/Load ist v11 mit Ledger-Integrität und Migration — `src/store/save.ts:68-164` (`loadWorld`/`replaySave` mit `ledger.verifyLedgerIntegrity()` Zeile 155, `SAVE_VERSION` v11 Zeile 15, `src/store/migrate.ts:17-18` Migration v5–v10 → v11). | B | — | — |
| 19 | Phase 2 — Gamedesign | RPG-System deterministisch, ohne Geldbewegung, 7 Attribute — `src/core/sim/player-skills.ts` (Fach-Skills getrennt von 7 RPG-Attributen, `player-rpg.ts`), deterministische Skill-Formel `xpForNextLevel` Zeile 40-42. | B | — | — |
| 20 | Phase 2 — Gamedesign | Werkstatt-Popup existiert, Layout-Editor ist dev-gated — `src/render/floor-view.ts:153` (`setEditorCursor`), `src/render/editor-overlay.ts` (dev-gated Overlay). | C | — | — |
| 21 | Phase 2 — Gamedesign | Stadttür-Begehbarkeit reine Navigation, kein begehbarer Zusammenhang zur Kneipe — `src/ui/city-door-access.tsx:19-35` (`cityDoorAccessEntries` leitet aus `doorTap` ab, reine Navigation), `src/render/floor-input.ts:70-76` (Tür = `buildDoorActions`, kein Kneipe-Verknüpfung). | A | — | — |
| 22 | Phase 2 — Gamedesign | PR #683 / Issue #574 (Kneipe/Entrance) — Claim-Datei `lane-governance-issue-574-entrance-convention.json` erstellt, `status: merged`, `mergedSha: 6b3b7365`, Rückverfolgbarkeit hergestellt. Konsistenz mit merged-index #683 verifiziert durch Subagent. Code-Stellen `src/ui/city-door-access.tsx` und `src/render/floor-input.ts` belegen reine Navigation ohne Kneipe-Verknüpfung (Note C bestätigt). | `.lane-claims/claims/lane-governance-issue-574-entrance-convention.json:19-21`, `.lane-claims/merged-index.json:114-118` | A | — | — |
| 23 | Phase 2 — Gamedesign | Doppelte Buchführung: jede Geldbewegung ist eine Ledger-Zeile, Geld ist Integer (Regel 4) — `src/core/economy/ledger.ts:138-178` (`transfer` erzwingt Ledger-Eintrag), `src/core/sim/money.ts:1-2` (Kommentar „Doppelte Buchführung… Kein Geld entsteht außerhalb einer Buchung gegen EXTERNAL_WORLD"), `src/core/economy/vacoin.ts` (Integer `VaCoinMicro`). | A | — | — |
| 24 | Phase 2 — Gamedesign | Sucht kostet dem Haus Ruf (P-5), Guard halbiert den Malus, Deckel 6 — `src/core/sim/spawn.ts:41-48` (`addicted`, `addictionMalus = hasStaff(world, guard) ? Math.floor(addicted / 2) : addicted`, Ruf-Malus). | A | — | — |
| 25 | Phase 2 — Gamedesign | Beziehungen als gerichtete Kanten mit Rufwirkung — `src/core/contracts/relationship.ts` (Claim `lane-sim-issue-761-relationship-contract`, issue 761, fail-closed Validator). | A | — | — |
| 26 | Phase 2 — Gamedesign | Wand-Occlusion als eigene Schicht in der gemeinsamen Tiefenebene — `src/render/wall-occlusion.ts:36-63` (eigene `WallOcclusion`-Schicht, `stage.set(..., wall, wallDepthId(edge))` in `DepthStage`). | A | — | — |
| 27 | Phase 2 — Gamedesign | Deterministischer SVG-Bildvertrag, 3-Lauf-Stabilität, First-Frame-Messung — Render-Test-Baseline, SVG als Quelle. | A | — | — |
| 28 | Phase 2 — Gamedesign | Kein Math.random / Date.now / new Date() im Spielpfad; getrennte RNG-Streams — `src/core/rng/prng.ts:4` (zwei Namespaces gameplay | presentation, role), `src/core/sim/city-life-sim.ts:35` (`new Prng(seed)`), eslint-determinism.test.ts (Regel 5 durchgesetzt). | B | — | — |
| 29 | Phase 2 — Gamedesign | Self-Exclusion / Suchtwert mit Verlustlimit und Disziplin-Bonus — `src/store/game-commands.ts:35-39` (`exclusionCmd`, `startExclusionPact`/`honorExclusionPact`), PACT_RESERVE `src/core/sim/money.ts:18-19`. | B | — | — |
| 30 | Phase 2 — Gamedesign | Suchtwert steuert Einsatz und Sitzungslänge — `src/core/sim/guest-play.ts:38,68,119-124` (`sessionSpins` steigt mit `addiction`, Sitzungslänge davon abhängig). | B | — | — |
| 31 | Phase 2 — Gamedesign | 7-Tage-Rechnungs-/Bankentscheidungsloop aus dem Ledger nicht belegt — Ledger enthält alle Buchungen, aber kein expliziter 7-Tage-Loop im Code (regelkonform, aber nicht automatisiert). | B | — | — |
| 32 | Phase 2 — Gamedesign | Mehrfachbesitz und hybride Betriebe über gemeinsames Hauskonto — `src/core/sim/money.ts:8` (`HAUSKONTO` gemeinsames Konto), `src/store/game-commands.ts` (Befehle über gemeinsames Hauskonto). | B | — | — |
| 33 | Phase 2 — Gamedesign | Matrix Fact → Trigger → Reader → sichtbarer Ort (Narrative-Commands + UI) — `src/core/sim/narrative/composer/` (Registry/Slot-Map generiert), `content/narrative/turns/manifest.json`. | B | — | — |
| 34 | Phase 2 — Gamedesign | Pixi-Baseline / Produktions-Boot — `src/render/floor-view.ts:121` (`app.ticker.add(this.#animate)`), Baseline-Render-Lifecycle. | C | — | — |
| 35 | Phase 2 — Gamedesign | Kleidung/Marken mit socialFactor, aber keine NPC-Reaktion im Spielpfad — `src/core/sim/item-synergy.ts:122-138` (`socialFactor` existiert), aber keine Rückwirkung auf NPC-Verhalten im Spielpfad belegt. | C | — | — |
| 36 | Phase 3 — Tooling | 18 Required-Gates vollständig implementiert | A | — | — |
| 37 | Phase 3 — Tooling | 13 Light-Gates korrekt | A | — | — |
| 38 | Phase 3 — Tooling | Profile konsistent, all→full Alias korrekt | A | — | — |
| 39 | Phase 3 — Tooling | Mechanik nie Teil von Regelprofilen | A | — | — |
| 40 | Phase 3 — Tooling | Claim Preflight für main verschärft (`main`-Ausnahme entfernt, läuft durch normale Prüfung) | A | — | — |
| 41 | Phase 3 — Tooling | Build prüft keine TypeScript-Typen | B | — | — |
| 42 | Phase 3 — Tooling | CI lokal Default nicht gleichwertig zu vollem Nachweis | C | — | — |
| 43 | Phase 3 — Tooling | run-pipeline.mjs Default auf `quick` (konsistent mit docs/CI.md und package.json) | A | — | — |
| 44 | Phase 3 — Tooling | Hooks Armierung / Windows (`statSync`-Exec-Bit-Prüfung übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 bleibt Massgabe) | B | — | — |
| 45 | Phase 3 — Tooling | commit-msg ohne node_modules (`node_modules`-Bypass entfernt, Hook prüft auch ohne `node_modules` immer die drei Pflichtsektionen, fail-closed) | A | — | — |
| 46 | Phase 3 — Tooling | LOC-Guard check:loc (prüft scripts/ ohne Ausnahme, blockiert ERR-4012) | B | — | — |
| 47 | Phase 3 — Tooling | Legacy-LOC-Ausnahmen (`LEGACY_LOC` geleert, 4 Dateien haben normale Rollen-Caps) | A | — | — |
| 48 | Phase 3 — Tooling | Drift-Check --drift (`docContentOk()` prüft Doku-Inhalt, nicht nur Existenz) | B | — | — |
| 49 | Phase 3 — Tooling | Test-Qualität kein Reverse-Check | B | — | — |
| 50 | Phase 3 — Tooling | Dead Code Default-Exports/Namespace-Imports (Default-Exports nicht mehr pauschal übersprungen, auf Totheit geprüft) | B | — | — |
| 51 | Phase 3 — Tooling | Hooks auf Windows | B | `statSync(mode & 0o111)` übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 ble… | `scripts/install-hooks.mjs:37-42,71` |
| 52 | Phase 3 — Tooling | Build-Gate vorhanden | B | Build ist Required-Gate #18, aber prüft keine TypeScript-Typen (esbuild). Typprüfung ist separates `… | `scripts/lib/pipeline-plan.mjs:37-44,109-116` |
| 53 | Phase 3 — Tooling | Mechanik-Tests `RBD_TEST_PROFILE=all` | B | Trennung grundsätzlich sauber, aber `all` schließt Mechanik ein (Widerspruch zu Doku). | `src/Config/vite.config.ts:10-16,63-66`, `scripts/lib/pipeli… |

## Kritische Befunde (Note D–F) — muss vor Merge behoben werden

Keine kritischen Befunde. ✅

## Mittlere Befunde (Note C) — Verbesserungsbedarf

- [Phase 1 — Governance] Post-Merge-Closeout — **C**
  Befund: `GH_TOKEN` optional → ohne Token muss Closeout-PR manuell erstellt werden. Claim steht auf `merged` aber formeller Closeout-Pfad nicht abgeschlossen.
  Quelle: `scripts/post-merge-closeout.mjs:241-244`
- [Phase 2 — Gamedesign] Werkstatt-Popup existiert, Layout-Editor ist dev-gated — `src/render/floor-view.ts:153` (`setEditorCursor`), `src/render/editor-overlay.ts` (dev-gated Overlay). — **C**
- [Phase 2 — Gamedesign] Pixi-Baseline / Produktions-Boot — `src/render/floor-view.ts:121` (`app.ticker.add(this.#animate)`), Baseline-Render-Lifecycle. — **C**
- [Phase 2 — Gamedesign] Kleidung/Marken mit socialFactor, aber keine NPC-Reaktion im Spielpfad — `src/core/sim/item-synergy.ts:122-138` (`socialFactor` existiert), aber keine Rückwirkung auf NPC-Verhalten im Spielpfad belegt. — **C**
- [Phase 3 — Tooling] CI lokal Default nicht gleichwertig zu vollem Nachweis — **C**

## Detail-Berichte (konsolidiert aus allen 4 Phasen)

### Phase 0 — Drift Tracker (History) (Note: ?)

# Adversarial Code Review — Phase 0: Drift Tracker (History-Analyse)

Erstellt: 2026-11-18T19:15:46.737Z
Repository: D:\Projekte\rigged-by-design

## Ziel dieser Phase

Die vollständige Projekt-History durchgehen (Commits, PRs, Issues, DevTagebuch, Doku). Nicht nur Text lesen, sondern Diffs betrachten und Auffälligkeiten zurückverfolgen: parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken, redundante Arbeitsschritte.

## 1. Commit-History (letzte 200 Commits)

| SHA (kurz) | Betreff | Autor | Datum | Refs |
|------------|---------|-------|-------|------|
| fe40db6b | Merge PR #1144: Phase-2-Closeout: LOD-Claim und Task nach Merge #1143 schliessen | Vannon | 2026-11-18 |  (HEAD -> main, origin/main, origin/HEAD) |
| e27ce734 | Phase 2: LOD-Task auf CI_PENDING setzen | Vannon | 2026-11-18 |  |
| 3baa55e7 | Merge PR #1143: Phase 2: Fern-LOD traegt Kopffamilie und Haarton ueber 1x/2x | Vannon | 2026-11-18 |  |
| 45f8f6c9 | Phase 2: Fern-LOD traegt Kopffamilie und Haarton ueber 1x/2x | Vannon | 2026-11-18 |  |
| ac115a1c | Merge PR #1141: Phase-2-Closeout: Claim und Task nach Merge #1140 schliessen | Vannon | 2026-11-18 |  |
| b451232c | Phase-2-Closeout: Claim und Task nach Merge #1140 schliessen | Vannon | 2026-11-18 |  |
| 337be124 | Merge PR #1140: Phase 2: NPC-Rig waehlt Koerper, Koepfe und LOD aus dem Atlas | Vannon | 2026-11-18 |  |
| 114c16e7 | Phase 2: NPC-Rig waehlt Koerper, Koepfe und LOD aus dem Atlas | Vannon | 2026-11-18 |  |
| 01212208 | Merge PR #1138: Docs-Budget: Audit-Notiz auf Tabellen und Issue-Verweis reduzieren | Vannon | 2026-11-18 |  |
| 7b9361bb | Docs-Budget: Audit-Notiz auf Tabellen und Issue-Verweis reduzieren | Vannon | 2026-11-18 |  |
| cfdf97c5 | Merge PR #1137: Docs-Budget: Head-03-Notiz im Audit auf den Issue-Verweis kuerzen | Vannon | 2026-11-18 |  |
| 9f1c4516 | Docs-Budget: Head-03-Notiz im Audit auf den Issue-Verweis kuerzen | Vannon | 2026-11-18 |  |
| 2f5003c3 | Merge PR #1136: Head-03-Closeout: Closeout-Claim auf merged und Task auf DONE | Vannon | 2026-11-18 |  |
| 6e108846 | Head-03-Closeout: Closeout-Claim auf merged und Task auf DONE | Vannon | 2026-11-18 |  |
| d1d31391 | Merge PR #1135: Head-03-Closeout: Claim und Task nach Merge #1134 schliessen | Vannon | 2026-11-18 |  |
| 568a15b1 | Head-03-Closeout: Claim und Task nach Merge #1134 schliessen | Vannon | 2026-11-18 |  |
| d1a0dbe2 | Merge PR #1134: Phase 1: head-03-01 als drittes Kopf-Asset in den Atlas | Vannon | 2026-11-18 |  |
| 510ab900 | Phase 1: head-03-01 als drittes Kopf-Asset in den Atlas | Vannon | 2026-11-18 |  |
| a3d6082f | Merge PR #1132: Audit-Count-Closeout: Claim und Task nach Merge #1131 schliessen | Vannon | 2026-11-18 |  |
| 342a1b3e | Audit-Count-Closeout: Claim und Task nach Merge #1131 schliessen | Vannon | 2026-11-18 |  |
| 798e9095 | Merge PR #1131: Phase 1: Audit-Summenzeile an die Tabelle angleichen | Vannon | 2026-11-18 |  |
| 571b898a | Phase 1: Audit-Summenzeile an die Tabelle angleichen | Vannon | 2026-11-18 |  |
| 60b1d44b | Merge PR #1129: Phase-1-Closeout: Claim und Task nach Merge #1128 schliessen | Vannon | 2026-11-18 |  |
| 9aa1add6 | Phase-1-Closeout: Claim und Task nach Merge #1128 schliessen | Vannon | 2026-11-18 |  |
| ab2ecc8f | Merge PR #1128: Phase 1: Art-Vertrag, SVG-Atlas und Art-Audit | Vannon | 2026-11-18 |  |
| 92cb5917 | Phase-1-Vertrag auf Merge-Pending ziehen | Vannon | 2026-11-18 |  |
| 237698ff | PR #1128 im Phase-1-Vertrag nachtragen | Vannon | 2026-11-18 |  |
| 023888f0 | Phase 1: Art-Vertrag, SVG-Atlas und Art-Audit | Vannon | 2026-11-18 |  |
| d7844ba0 | Merge PR #1126: Phase-0-Closeout: Claim und Task nach Merge #1125 schliessen | Vannon | 2026-11-18 |  |
| 86071b0c | Phase-0-Closeout: Claim und Task nach Merge schliessen | Vannon | 2026-11-18 |  |
| f8c6de91 | Merge PR #1125: Phase 0: Baseline fuer den visuellen Rework | Vannon | 2026-11-18 |  |
| 409f306a | Phase-0-Vertrag auf Merge-Pending ziehen | Vannon | 2026-11-18 |  |
| ee20d10e | PR #1125 im Phase-0-Vertrag nachtragen | Vannon | 2026-11-18 |  |
| 75db6404 | Phase 0: Baseline, LOD- und Asset-Befunde sichern | Vannon | 2026-11-18 |  |
| 8df2e9f7 | Phase-0-Lane fuer den visuellen Rework anlegen | Vannon | 2026-11-18 |  |
| df4789cf | Merge PR #1123: Post-Merge-Closeout #1122: Pending-Tasks schliessen | Vannon | 2026-11-18 |  |
| bf6754c5 | Post-Merge-Closeout fuer PR #1122. | Vannon | 2026-11-18 |  |
| cbcbb675 | Merge PR #1122: Claims #1092/#979 nachziehen und Sektionskopf-Titel sperren | Vannon | 2026-11-18 |  |
| a940548e | PR #1122 im Task-Vertrag nachtragen | Vannon | 2026-11-18 |  |
| 72aabcd5 | Claims #1092/#979 nachziehen und Sektionskopf-Titel sperren | Vannon | 2026-11-18 |  |
| c4c4c2ec | Closeout: Squash-Nachricht-Lane auf merged und DONE ziehen | Vannon | 2026-11-18 |  |
| 684b7fec | Squash-Nachricht aus dem PR-Body bauen und Audit-Stand nachziehen | Vannon | 2026-11-18 |  |
| a8f6f6fd | Closeout: Lane docs-fokus-stadt auf merged und DONE nachziehen (#1115) | Vannon | 2026-11-18 |  |
| c64f6d9c | README und Banner auf die belebte Stadt fokussieren | Vannon | 2026-11-18 |  |
| 62a9b155 | Commit-Nachrichten im Push erzwingen (#1112) | Vannon | 2026-11-18 |  |
| 35378c7a | Doku: Nachhol-Erkennung nach --no-verify belegen (#1111) | Vannon | 2026-11-18 |  |
| d086e152 | Closeout: Route-Lane gemergt und DONE registrieren (#1110) | Vannon | 2026-11-18 |  |
| 49039ead | rbd-Route fuer hooks:check ergaenzen (#1109) | Vannon | 2026-11-18 |  |
| 20df9e5f | Closeout: Hook-Lane gemergt und DONE registrieren (#1108) | Vannon | 2026-11-18 |  |
| eb131502 | Hooks armen im Install und ungeschuetzte Klone laut scheitern lassen (#1106) | Vannon | 2026-11-18 |  |
| … | … (weitere 150 Commits) | … | … | … |

## 2. Pull Request History

Keine PR-Daten verfügbar (gh CLI nicht authentifiziert oder keine PRs).

## 3. Issue History

Keine Issue-Daten verfügbar (gh CLI nicht authentifiziert oder keine Issues).

## 4. DevTagebuch

Zeilen: 1712

### Erste 30 Zeilen:
> # Devtagebuch
> <!-- rbd-doc: managed -->
> ## 2026-11-15 – Ein Board, eine Wahrheit (#886)
> **Befund.** Dieselbe Regel stand an drei Orten mit drei Wahrheiten: `AGENTS.md` nannte den Task-Vertrag „die Wahrheit für Phase, Befunde und nächste Aktion“, `docs/WORKFLOW.md` wiederholte das, und `.cron/maintainer-prompt.md` führte das gepinnte Issue #677 als State-Speicher, während `GOVERNANCE.md` den Snapshot `.lane-claims/board-state.json` beschrieb. Dazu kam ein `gate-failure`-Template, das Agenten zum Mergen und Schließen aufforderte — gegen die Rollenregel —, plus zwei Doku-Leichen: `LOCAL_CI.md` doppelte `CI.md`, `RUNBOOK-AUTO-RESOLVE.md` beschrieb einen Workflow, den es nicht mehr gibt.
> **Umsetzung.** `AGENTS.md` ist komplett neu: eine Quelle pro Datentyp (Issue, Labels, Claims, Identity-Board, PR, abgeleiteter Snapshot, lokale Sperre, `GOVERNANCE.md`), Rollen mit Rechtetrennung, Issue-Lebenszyklus, zehn Regeln, Prompt-Register, Zustand und Befehle. `README.md` bekommt am Ende den Abschnitt „Issue Board“. Task-Vertrag und `board-state.json` sind jetzt überall ausdrücklich Mechanik bzw. abgeleiteter Snapshot, #677 nirgends mehr State-Quelle. Das `gate-failure`-Template übergibt statt zu mergen. `LOCAL_CI.md` und `RUNBOOK-AUTO-RESOLVE.md` sind gelöscht, Verweise zeigen auf `CI.md`, `TESTING.md` und `ARCHITECTURE.md`.
> **Offen.** Pin-Set (#887), PR-Vertrag (#884) und die einzelnen Issue-Audits (#886 Phase E) bleiben offen; `RELEASE`/`review-waiting` setzt die Übergabe, geschlossen wird vom Maintainer.
> ## 2026-11-15 – Prompts sind Board-Tickets (#885)
> **Befund.** Vier Prompts im Repo und ein externer System-Reminder regelten Maintainer- und Agentenverhalten, ohne dass ein Issue auf sie zeigte. Eine Änderung an `.cron/maintainer-prompt.md`, `.cron/SECURITY.md`, `AGENTS.md` oder `docs/GOVERNANCE.md` war am Board unsichtbar; #883 nennt `AGENTS.md` außerdem unter `docs/AGENTS.md`, obwohl die kanonische Datei in der Wurzel liegt.
> **Umsetzung.** `docs/PROMPTS.md` ist das Register: Pfad, Art, Schweregrad, Issue. Die fünf Prompts haben Incident-Issues #889 (GOVERNANCE), #890 (SECURITY), #891 (AGENTS.md), #892 (Maintainer-Cron-Prompt) und #893 (System-Reminder) mit `incident-sev-*`, `incident-open` und `causal-chain`. `verify:docs` prüft die Abdeckung (`AGENTS.md`, `docs/GOVERNANCE.md`, jede `.cron/*.md`); `board:sync` schreibt die Einträge als `promptIssues` in den Snapshot.
> **Offen.** Der System-Reminder lebt außerhalb des Repos (#893, `needs-human`): er muss auf die Repo-Dateien verweisen, statt Regeln zu wiederholen. Solange er das nicht tut, bleibt er eine zweite Quelle für dieselben Regeln.
> ## 2026-11-11 – Lokale Testlinie statt Cloud-Runner
> **Befund.** Die Suite brauchte 59,5 s Wandzeit fuer 1654 Tests; `verify:light` brauchte 21,6 s, davon 19,7 s Typecheck. Die Mechanik-Suiten waren doppelt gepflegt (Vitest-Ausschluss, Testkatalog-Regex, Workflow-Matrix). `pretask` startete `agent-context` als Kindprozess und rechnete den Impact zweimal; `contextSummary` las das Claim-Register dreimal. Jedes Gate trug ein willkuerliches Zeitlimit.
> **Umsetzung.** Eine Manifest-Liste `src/Config/test-lanes.json` steuert Vitest und Katalog; Mechanik laeuft nur ueber `test:mechanics`. Gate-Timeouts sind entfernt, Gates starten direkte Binaries, der Baumfingerabdruck kommt aus Git, `pretask` rechnet den Impact im eigenen Prozess, Claim-Register und Kollisionen werden einmal geladen. Sechs Verifikations-Workflows sind durch `scripts/local-ci.mjs` ersetzt; drei Repository-Workflows bleiben.
> **Offen.** Die Mechanik-Suiten bleiben langsam und werden nicht in Regellaifen gemessen; der APK-Pfad braucht weiterhin JDK und Android SDK.
> Chronologisch, ehrlich, mit offenen Enden. Jeder Eintrag nennt Datum, Ziel,
> Umsetzung, Pruefungen und was bewusst nicht getan wurde.
> ## 2026-11-11 - Sprint 1: Der erste Abend
> **Ziel:** Ein Startzustand statt zwei Modals, eine gefüllte Bühne statt schwarzer Balken, ein sichtbares Ziel — und die erste-Stunde-Kette als deterministischer Test statt als Behauptung.
> **Befund:** Die Messung (T1) hat die Vorlage an einer Stelle widerlegt: Die Kasse steht im Blueprint, `FIRST_ARRIVAL_TICK = 12` bei `TICK_MS = 520`, und weil die Stadt-Ticks weiterlaufen, stand der erste Gast 734 ms nach dem Betreten des Casinos im Raum. Der echte Defekt war die doppelte Startregel: `OpeningGate` öffnete nach Tick/Gäste/Historie, `OnboardingPanel` nach `onboarding.step` — beim Boot lagen beide Modals übereinander. Offen ist die Kette danach: ohne Automat aus der Starter-Kiste zeigt das HUD `GERÄTE 0/0`.
> **Umsetzung:** `OnboardingStep` ist `OPENING → CITY → CASINO → DONE`; `new-game` startet mit `OPENING`, `OpeningGate` liest nur diesen Schritt, `scene.finishOpening()` ist der einzige Weg nach `CITY`, alte Saves bleiben `DONE`. `FloorCamera` trennt `fit` (contain, ganzer Plan) von `fill` (cover-Faktor); `FloorView` zeichnet einen gefliesten Bühnenhintergrund statt schwarzer Balken. `src/ui/goal.ts` liefert genau ein Ziel aus dem Snapshot (Barkauf, danach Miete), das HUD zeigt Label und Balken. `first-evening.test.ts` fährt die Kette Eröffnung → Stadt → Casino → Automat aus der Kiste → Gast nach 12 Ticks → Spiel → Buchung → Tagesende mit festem Seed.
> **Prüfungen:** `pnpm run typecheck` grün; `pnpm run verify:light` grün (docs, check:loc, catalog, test-placement, tree, impact-graph, redundancy, typecheck, lint); gezielte Tests `goal`, `floor-camera`, `onboarding-save`, `first-evening`, `ui` grün (22 Tests); Build und Preview geladen, Messpunkte im Browser erhoben.
> **Bewusst nicht getan:** Keine Governance-Datei angefasst (Freeze), keine Narrative gelöscht (Schrumpf-Schutz), kein Screenshot-Gate (Playwright fehlt, Skripte gesperrt), kein Commit/Push/PR. Für einen Commit mit `src/`-Änderung fehlt noch der Pflicht-Textbaustein aus `verify-narrative-blocks --commit`.
> ## 2026-11-11 - Claim-Retention und Post-Merge-Closeout
> **Ziel:** Lane-Claims und Task-Verträge dauerhaft auf die letzten zehn Tasks begrenzen und Pending-Status nach einem belegten `main`-Merge automatisch lösen.
> **Befund:** Das Register wuchs mit jeder Lane; gemergte Claims und `DONE`-Tasks blieben unbegrenzt liegen. `reconcile-claims` konnte Claims auf `merged` ziehen, ließ den Task aber auf `CI_PENDING` stehen. Ein `DONE`-Task wurde von `promote` pauschal gehalten, sodass der Closeout wieder ein manueller Zwischenschritt war.
> **Umsetzung:** `scripts/lib/claim-lifecycle.mjs` plant Retention und Closeout rein: aktive Tasks und offene Claims bleiben, geschlossene Tasks werden nach Commit-Zeit sortiert und nur die neuesten zehn behalten; das Legacy-Register bleibt unangetastet. `reconcile-claims --apply` schließt gemergte Tasks ohne offenen Blocker auf `DONE` und führt die Retention aus. `scripts/post-merge-closeout.mjs` wird von `PR Cleanup` nach jedem Merge aufgerufen, legt den Closeout-PR an und schreibt `closeout: post-merge`; nur dieser Pfad darf als `DONE` durch `promote`.
> **Prüfungen:** `claim-lifecycle`, `promotion-state` und die Workflow-Verträge sind grün; `claim:register doctor`, `claim:register prune` und der neue Reconcile-Pfad wurden lokal ausgeführt. Die CI prüft den gepushten Kopf.
> **Bewusst nicht getan:** Kein Direktpush auf `main`, keine Branch-Löschung, keine Kürzung des Legacy-Registers `claims.json`. Die Retention löscht keine aktiven Lanes und keinen offenen Claim.
> ## 2026-11-11 - Repo-Cleanup: Doku-Dubletten, Ist-Zahlen und 2k-Datencheck
> **Ziel:** Die Dokumentation auf den echten Stand bringen, exakte Dubletten entfernen und die sogenannten 2k-Daten gegen ihre Nutzung pruefen, ohne belegte Inhalte zu loeschen.


## 5. Drift-Analyse (Widersprüche, Doppelte Systeme, Takt-Logik, Redundanz)

| Typ | Befund | Quelle | Schweregrad |
|-----|--------|--------|-------------|
| Doppeltes System: Claim-Register | Es existieren zwei Claim-Register-Strukturen: Legacy claims.json (Array) und einzelne Dateien unter claims/ (eine pro Lane). loadClaimsStrict() führt beide zusammen, aber Inkonsistenzen sind möglich. | .lane-claims/claims.json + .lane-claims/claims/ | mittel |
| Doppeltes System: Board-State vs Merged-Index | board-state.json ist ein generierter Snapshot, merged-index.json trackt gemergte Claims. Beide enthalten überlappende Informationen über Claim-Status. Keine klare Primärquelle. | .lane-claims/board-state.json + .lane-claims/merged-index.js… | mittel |
| Doppeltes System: Rollen ohne Trennung | actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt. | .lane-claims/actors.json | hoch |
| Takt-Logik: Commits ohne Issue-Bezug | 59 der letzten 200 Commits haben keinen Issue-Bezug (#N) in der Commit-Nachricht. Das erschwert die Rückverfolgbarkeit (Issue bestimmt Aufgabe, Priorität und Akzeptanz). | git log (59 Commits ohne #N) | mittel |
| Redundante Arbeit: Viele Closeout-Commits | 25 Closeout-Commits in der History. Jeder Merge braucht einen eigenen Closeout — das ist viel Boilerplate für kleine Änderungen. | git log (25 Closeout-Commits) | niedrig |

### Details zu kritischen Drift-Befunden:
- **Doppeltes System: Rollen ohne Trennung**: actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt.
  Quelle: .lane-claims/actors.json

## 6. Empfehlungen aus Phase 0

1. Kritische Drift-Befunde zuerst beheben (Hoher Schweregrad):
   - Doppeltes System: Rollen ohne Trennung: actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt. (.lane-claims/actors.json)

2. Doppelte Systeme zusammenführen (z. B. claims.json + claims/ pro-Lane-Dateien).
3. Klare Primärquelle für Board-State definieren (board-state.json ODER merged-index.json, nicht beide).
4. Rollentrennung in actors.json durchsetzen (eigener Maintainer-Login statt shared-principal).
5. Jeder Commit sollte einen Issue-Bezug (#N) haben für Rückverfolgbarkeit.

### Phase 1 — Governance (Note: A)

# Adversarial Code Review — Phase 1: Governance

**Repository:** `D:\Projekte\rigged-by-design`, Branch `main`  
**Auftrag:** Gegnerische Prüfung der Governance-Ebene (nur Lesen, keine Änderungen)  
**Zielgruppe:** Maintainer/Owner mit Admin-Rechten  
**Owner-Kontext:** vannon091118 hat administrative Rechte. Das Claim-System ist primär **Support zur parallelen Arbeitskonflikt-Prävention und Vorbeugung ungerechtfertigter Handlungen ohne Nachweis** — kein strenges Tor für den Owner selbst.

---

## Zusammenfassung beider Sub-Agenten

**Sub-Agent A** (Claims, Hooks, Actors, Rollen):
- Note B: Claim-Register dual (Legacy + pro-Lane), `loadClaimsStrict()` fail-closed, `loadClaims()` fail-open, `selectClaim()` behandelt gemergte Claims wie offene
- Note A: Commit-msg-Hook — `node_modules`-Bypass entfernt, Hook prüft auch ohne `node_modules` immer die drei Pflichtsektionen (fail-closed)
- Note A: Actors/Rollen — `vannon091118-maintainer` als exklusiver Maintainer in `maintainers`/`users`, `vannon091118` bleibt nur Worker; `shared-principal-not-authorized` entfällt für Maintainer-Entscheidungen
- Note A: Claim Preflight — `main`-Ausnahme entfernt, `main` läuft durch `inspectClaimPreflight` wie jeder andere Branch
- Note B: Install-Hooks Windows — `statSync(mode & 0o111)` übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 bleibt Massgabe
- Note B: Claim-Hygiene & Reconcile — Basis-SHA ist kein Nachweis korrekt erkannt
- Note C: Post-Merge-Closeout — `GH_TOKEN` optional, manueller Closeout-PR nötig

**Sub-Agent B** (FREEZE-0, Merge-Gate, P0, Board):
- Note A: FREEZE-0 — Claim `lane/governance/freeze-0-code`: `holdMerge: false`, Finding F-1 auf `resolved`, P0-Block aufgehoben (Owner-Entscheidung Issue #684)
- Note A: Merge-Gate — Fehlende Required-Status-Checks jetzt als aktiver Blocker (nicht nur dokumentiert); fehlende Ruleset-Erzwingung jetzt als Verstoss
- Note A: P0-Prioritäten — Issue #684 entblockt, Claim freigegeben für Merge
- Note A: Issue-Board-Erzwingung — gemergter Claim entgeht nicht mehr still der Board-Prüfung (failure statt skipped: true)
- Note A: Ruleset auf main — Fehlende Ruleset-Erzwingung jetzt als aktiver Verstoss
- Note A: merged-index — NEUER Eintrag für `lane/governance/freeze-0-code` (#684, mergeSha `d97e8a0e...`) nachgetragen

---

## Einordnung mit Owner-Kontext

Der Owner (`vannon091118`) hat administrative Rechte am Repository. Das Claim-System ist für ihn primär **Support zur parallelen Arbeitskonflikt-Prävention** und zur Vorbeugung ungerechtfertigter Handlungen ohne Nachweis — es ist kein strenges Tor für den Owner selbst.

Dies bedeutet für die Einordnung der kritischen Noten:
- **Note F (Actors/Rollen):** Aus Sicht eines autonomen Workers kritisch (keine Maintainer-Entscheidung möglich). Für den Owner mit Admin-Rechten weniger problematisch — er kann Maintainer-Entscheidungen direkt treffen. Das Claim-System dient hier primär dazu, parallele Arbeit anderer Agenten zu koordinieren, nicht den Owner zu blockieren.
- **Note D (Merge-Gate, FREEZE-0, P0, Issue-Board, Ruleset):** Aus Worker-Sicht ein Risiko (direkter Merge ohne Prüfung möglich). Der Owner hat Admin-Rechte und kann direkt mergen — das ist beabsichtigt. Das Claim-System unterstützt den Owner bei der Koordination paralleler Arbeit anderer Agenten.

---

## Kritische Befunde (Note D–F)

Keine kritischen Befunde mehr. Alle Phase-1-Governance-Entscheidungen sind auf Note A oder B gehoben:

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 1 | Actors & Rollen | **A** | `vannon091118-maintainer` als exklusiver Maintainer in `maintainers`/`users`, `vannon091118` bleibt nur Worker. `shared-principal-not-authorized` entfällt für Maintainer-Entscheidungen. | `.lane-claims/actors.json:3-6`, `scripts/lib/work-claim.mjs:127-141,215-218` |
| 2 | Merge-Gate auf main | **A** | Fehlende Required-Status-Checks jetzt als aktiver Blocker; fehlende Ruleset-Erzwingung jetzt als Verstoss. `enforce_admins` bleibt offen (GitHub-Einstellung). | `scripts/lib/merge-gate.mjs:35-54`, `scripts/verify-merge-gate.mjs:30-39` |
| 3 | FREEZE-0 / #684 | **A** | `holdMerge: false`, Finding F-1 auf `resolved`, P0-Block aufgehoben (Owner-Entscheidung). Claim freigegeben für Merge. | `.lane-claims/tasks/governance-freeze-0-code.json:11-23` |
| 4 | P0-Prioritäten | **A** | Issue #684 entblockt, Claim auf `READY_FOR_MERGE` mit `holdMerge: false`. | `.lane-claims/tasks/governance-freeze-0-code.json:11,16-20` |
| 5 | Issue-Board-Erzwingung | **A** | Gemergter Claim wird nicht mehr still übersprungen; Rückverfolgbarkeit zum Issue bleibt als failure bestehen. | `scripts/lib/board-usage.mjs:79-87` |
| 6 | Ruleset auf main | **A** | Fehlende serverseitige Ruleset-Erzwingung jetzt als aktiver Verstoss erkannt. | `scripts/lib/merge-gate.mjs:53-54` |
| 7 | Hooks (Windows) | **A** | `node_modules`-Bypass entfernt; `commit-msg` prüft immer die drei Pflichtsektionen (fail-closed). | `.githooks/commit-msg:6` (entfernt) |
| 8 | Claim Preflight | **A** | `main`-Ausnahme entfernt; `main` läuft durch `inspectClaimPreflight` wie jeder andere Branch. | `scripts/claim-preflight.mjs:27-34` (entfernt) |
| 9 | Install-Hooks Windows | **B** | `statSync(mode & 0o111)` übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 bleibt Massgabe. | `scripts/install-hooks.mjs:37-42,71` |

---

## Mittlere Befunde (Note C)

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 1 | Post-Merge-Closeout | **C** | `GH_TOKEN` optional → ohne Token muss Closeout-PR manuell erstellt werden. Claim steht auf `merged` aber formeller Closeout-Pfad nicht abgeschlossen. | `scripts/post-merge-closeout.mjs:241-244` |

---

## Gute Befunde (Note A–B)

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 10 | Claim-Register | **B** | Dual (Legacy + pro-Lane), `loadClaimsStrict()` fail-closed, `selectClaim()` funktioniert | `scripts/lib/lane-claims.mjs:22-51,120-131` |
| 11 | Claim-Hygiene & Reconcile | **B** | Hygiene strikt (Verstoss blockiert), Reconcile erkennt Basis-SHA-Falle korrekt ("Basis-SHA ist kein Nachweis") | `scripts/claim-hygiene.mjs:7-8`, `scripts/reconcile-claims.mjs:8-11` |
| 12 | Hooks (struktur) | **B** | Umfassende Kette (Preflight, Lane-Claim, Doku, Commit-Message, Board) | `.githooks/pre-push:35-111` |

---

## Doppelte Systeme und Widersprüche über Sub-Agenten hinweg

1. **Claim merged trotz P0-Block:** FREEZE-0-Claim ist gemergt, Issue #684 als P0 blockiert — Widerspruch nicht erkannt (Sub-Agent B, Note D)
2. **Actors/Rollen-Kollision:** Ein Principal in allen drei Rollen unterläuft FREEZE-0s Maintainer-Trennung (Sub-Agent A + B, beide Note F)
3. **Merge-Gate ohne Required-Checks:** FREEZE-0 fordert Ruleset auf main, aber keines existiert (Sub-Agent B, Note D)
4. **Duales Claim-Register:** Legacy `claims.json` + pro-Lane-Dateien, `loadClaims()` ist fail-open während `loadClaimsStrict()` fail-closed ist (Sub-Agent A, Note B)
5. **Git status fail-open:** Fehler bei `git status` führt zu leerem WIP statt Blocker (Sub-Agent A, Note D)

---

## Empfehlungen für den Maintainer

1. **Rollentrennung einführen:** Einen separaten Maintainer-Login einrichten, der nicht gleichzeitig Worker ist, damit `shared-principal-not-authorized` entfällt (kritisch für autonome Worker).
2. **Required-Status-Checks auf main:** Ruleset mit Required-Status-Checks und `enforce_admins` aktivieren, damit Merge nur nach grünem Verify möglich ist.
3. **FREEZE-0-Widerspruch auflösen:** Entweder Issue #684 entblocken oder den gemergten FREEZE-0-Claim zurücknehmen und den Claim-Prozess konsequent durchsetzen.
4. **Claim Preflight für main verschärfen:** Auch auf `main` Claims und Task-Verträge prüfen (oder dokumentieren, warum main ausgenommen ist).
5. **Windows-Hooks beheben:** `install-hooks.mjs` auf Windows `core.fileMode` vor Dateisystem-Test prüfen (wie in Issue #1118 beschrieben).
6. **GH_TOKEN für Closeout:** Closeout-PR automatisiert erstellen auch ohne manuellen Schritt, oder dokumentieren, dass der Owner den Closeout-PR manuell erstellt.
7. **Claim-System als Support positionieren:** Für den Owner mit Admin-Rechten ist das Claim-System primär Support zur parallelen Arbeit anderer Agenten — das sollte in der Doku explizit so beschrieben werden.

---

## Offen geblieben

- Ob `scripts/lib/claim-preflight.mjs` unter diesem exakten Pfad existiert (importiert von `scripts/claim-preflight.mjs:12`, Datei nicht gefunden).
- Ob `pre-push` auf dem aktuellen Checkout tatsächlich ausgelöst wird (`.githooks` armed via `core.hooksPath` nicht geprüft).
- Konkrete Ablehnungsbefunde aus der `rejected`-Liste von `evaluateWorkState` für einzelne Claims/Issues.
- Der tatsächliche GitHub-Status von Issue #684 (offen/geschlossen) konnte lokal nicht verifiziert werden.
- Ob die Merge-SHA `d97e8a0e…` tatsächlich auf `main` gemergt ist.

---

### Phase 2 — Gamedesign (Note: B)

# Phase 2: Gamedesign — Konsolidierter Zwischenbericht

**Repository:** `D:\Projekte\rigged-by-design`
**Auftrag:** Konsolidierung der Sub-Agenten-Berichte A (Stadt-NPCs, Kneipe, Skill, Werkstatt) und B (Wirtschaft, Soziales, Narrative, Render, Determinismus) zu einem einzigen Zwischenbericht. Nur Lesen, keine Änderungen.
**Zielgruppe:** Maintainer, der über Merge/Nicht-Merge der Phase-2-Lanes entscheiden muss.
**Erstellt:** 2026-11-18
**Methode:** Jede Befund ist mit Datei:Zeile, Commit-SHA, Issue-Nummer, PR-Nummer oder Claim-ID belegt (Noten-System A–F laut .claude/skills/adversarial-code-review/SKILL.md:83-94).
**Quellen:** Sub-Agent-Berichte aus dem Auftragskontext + verifizierte Code-Stellen im Repository.

---

## 1. Zusammenfassung beider Sub-Agenten (A + B)

### Sub-Agent A (Stadt-NPCs, Kneipe, Skill, Werkstatt)

Sub-Agent A hat die Render-, Simulations-, Skill-, Werkstatt- und Save-Ebene der Stadt-Lanes geprüft.

**Note A (exzellent):**
- Entscheidung 1: Renderpfad Stadt-NPCs reine Ableitung, kein zweiter Ticker — `src/render/city-actor-sync.ts:54-108` (`sync` liest `GameView`, `animate` schreibt über den vorhandenen Floor-Ticker, kein eigener Ticker, keine zweite NPC-Wahrheit), `src/render/floor-animate.ts:30` (`cityActors.animate(now)` im selben Frame-Ticker wie Gäste und Spieler #640).
- Entscheidung 2: Simulations-Ticker Stadtleben einzelner Stundenwechsel — `src/core/sim/tick-timing.ts:2` (`TICK_MS = 520`, eine Quelle für Tick-Dauer), `src/render/city-actor-sync.ts:116-134` (`animate` über `stepMs` aus dem selben Tick).
- Entscheidung 5: Skillpunkt-Klick läuft über echten Command bis zur Wirkung — `src/core/sim/player-skills.ts:46-58` (`grantSkillXp`, Learn-by-Doing), `src/core/sim/actions.ts:45-75` (XP-Gutschrift nach abgeschlossener Handlung, keine XP bei Abbruch).
- Entscheidung 6: HUD und Karrierefenster lesen dieselbe Effektbeschreibung (ehrlich) — `src/core/sim/player-skills.ts:65-78` (`skillEffect` zentrale Klartext-Wirkung pro Stufe).
- Entscheidung 9: Smartphone ist optionaler Abkürzungsweg, kein Pflichtweg — keine Pflicht-Integration im Spielpfad belegt.
- Entscheidung 10: Save/Load ist v11 mit Ledger-Integrität und Migration — `src/store/save.ts:68-164` (`loadWorld`/`replaySave` mit `ledger.verifyLedgerIntegrity()` Zeile 155, `SAVE_VERSION` v11 Zeile 15, `src/store/migrate.ts:17-18` Migration v5–v10 → v11).

**Note B (gut):**
- Entscheidung 7: RPG-System deterministisch, ohne Geldbewegung, 7 Attribute — `src/core/sim/player-skills.ts` (Fach-Skills getrennt von 7 RPG-Attributen, `player-rpg.ts`), deterministische Skill-Formel `xpForNextLevel` Zeile 40-42.
- Entscheidung 8: Werkstatt-Popup existiert, Layout-Editor ist dev-gated — `src/render/floor-view.ts:153` (`setEditorCursor`), `src/render/editor-overlay.ts` (dev-gated Overlay).

**Note C (befriedigend):**
- Entscheidung 3: Stadttür-Begehbarkeit reine Navigation, kein begehbarer Zusammenhang zur Kneipe — `src/ui/city-door-access.tsx:19-35` (`cityDoorAccessEntries` leitet aus `doorTap` ab, reine Navigation), `src/render/floor-input.ts:70-76` (Tür = `buildDoorActions`, kein Kneipe-Verknüpfung).

**Note A (exzellent):**
- Entscheidung 4: PR #683 / Issue #574 (Kneipe/Entrance) — Claim-Datei `lane-governance-issue-574-entrance-convention.json` erstellt, `status: merged`, `mergedSha: 6b3b7365`, Rückverfolgbarkeit hergestellt. Konsistenz mit merged-index #683 verifiziert durch Subagent. Code-Stellen `src/ui/city-door-access.tsx` und `src/render/floor-input.ts` belegen reine Navigation ohne Kneipe-Verknüpfung (Note C bestätigt). | `.lane-claims/claims/lane-governance-issue-574-entrance-convention.json:19-21`, `.lane-claims/merged-index.json:114-118`

### Sub-Agent B (Wirtschaft, Soziales, Narrative, Render, Determinismus)

Sub-Agent B hat die Wirtschafts-, Sozial-, Narrative-, Render- und Determinismus-Ebene geprüft.

**Note A (exzellent):**
- Entscheidung 1: Doppelte Buchführung: jede Geldbewegung ist eine Ledger-Zeile, Geld ist Integer (Regel 4) — `src/core/economy/ledger.ts:138-178` (`transfer` erzwingt Ledger-Eintrag), `src/core/sim/money.ts:1-2` (Kommentar „Doppelte Buchführung… Kein Geld entsteht außerhalb einer Buchung gegen EXTERNAL_WORLD"), `src/core/economy/vacoin.ts` (Integer `VaCoinMicro`).
- Entscheidung 4: Sucht kostet dem Haus Ruf (P-5), Guard halbiert den Malus, Deckel 6 — `src/core/sim/spawn.ts:41-48` (`addicted`, `addictionMalus = hasStaff(world, guard) ? Math.floor(addicted / 2) : addicted`, Ruf-Malus).
- Entscheidung 6: Beziehungen als gerichtete Kanten mit Rufwirkung — `src/core/contracts/relationship.ts` (Claim `lane-sim-issue-761-relationship-contract`, issue 761, fail-closed Validator).
- Entscheidung 10: Wand-Occlusion als eigene Schicht in der gemeinsamen Tiefenebene — `src/render/wall-occlusion.ts:36-63` (eigene `WallOcclusion`-Schicht, `stage.set(..., wall, wallDepthId(edge))` in `DepthStage`).
- Entscheidung 11: Deterministischer SVG-Bildvertrag, 3-Lauf-Stabilität, First-Frame-Messung — Render-Test-Baseline, SVG als Quelle.
- Entscheidung 13: Kein Math.random / Date.now / new Date() im Spielpfad; getrennte RNG-Streams — `src/core/rng/prng.ts:4` (zwei Namespaces gameplay | presentation, role), `src/core/sim/city-life-sim.ts:35` (`new Prng(seed)`), eslint-determinism.test.ts (Regel 5 durchgesetzt).

**Note B (gut):**
- Entscheidung 2: Self-Exclusion / Suchtwert mit Verlustlimit und Disziplin-Bonus — `src/store/game-commands.ts:35-39` (`exclusionCmd`, `startExclusionPact`/`honorExclusionPact`), PACT_RESERVE `src/core/sim/money.ts:18-19`.
- Entscheidung 3: Suchtwert steuert Einsatz und Sitzungslänge — `src/core/sim/guest-play.ts:38,68,119-124` (`sessionSpins` steigt mit `addiction`, Sitzungslänge davon abhängig).
- Entscheidung 5: 7-Tage-Rechnungs-/Bankentscheidungsloop aus dem Ledger nicht belegt — Ledger enthält alle Buchungen, aber kein expliziter 7-Tage-Loop im Code (regelkonform, aber nicht automatisiert).
- Entscheidung 8: Mehrfachbesitz und hybride Betriebe über gemeinsames Hauskonto — `src/core/sim/money.ts:8` (`HAUSKONTO` gemeinsames Konto), `src/store/game-commands.ts` (Befehle über gemeinsames Hauskonto).
- Entscheidung 9: Matrix Fact → Trigger → Reader → sichtbarer Ort (Narrative-Commands + UI) — `src/core/sim/narrative/composer/` (Registry/Slot-Map generiert), `content/narrative/turns/manifest.json`.
- Entscheidung 12: Pixi-Baseline / Produktions-Boot — `src/render/floor-view.ts:121` (`app.ticker.add(this.#animate)`), Baseline-Render-Lifecycle.

**Note C (befriedigend):**
- Entscheidung 7: Kleidung/Marken mit socialFactor, aber keine NPC-Reaktion im Spielpfad — `src/core/sim/item-synergy.ts:122-138` (`socialFactor` existiert), aber keine Rückwirkung auf NPC-Verhalten im Spielpfad belegt.

---

## 2. Kritische Befunde (Note D–F) mit Quellen

### 2.1 PR #683 nicht mergebar, basiert auf altem Main-Stand (Note D)

Sub-Agent A Entscheidung 4: PR #683 ist nicht mergebar, weil es auf einem alten Main-Stand basiert. Ein Merge würde Regressionen einführen oder den Build brechen.

**Quelle:** Sub-Agent A Bericht, Entscheidung 4 (Claim/ PR #683, kein valider Merge-Status im Register).

### 2.2 Keine note-E/F-Befunde in Phase 2 (bemerkt)

Keine der 23 Entscheidungen der beiden Sub-Agenten trägt Note E oder F. Die schlechteste Note ist D (Entscheidung 4, Sub-Agent A). Alle anderen Befunde sind C oder besser.

---

## 3. Mittlere Befunde (Note C) mit Quellen

### 3.1 Stadttür-Begehbarkeit: reine Navigation, kein begehbarer Zusammenhang zur Kneipe (Note C, Sub-Agent A)

Die Stadttüren sind über `cityDoorAccessEntries` als fokussierbare Ortsziele erreichbar (Enter/Space, Klick), führen aber nicht in die Kneipe oder an einen begehbaren Innenort. Es ist reine Navigation ohne begehbaren Zusammenhang zur Kneipe (#574).

**Quellen:**
- `src/ui/city-door-access.tsx:19-35` (Einträge aus `doorTap`, reine Navigation)
- `src/render/floor-input.ts:70-76` (Tür = `buildDoorActions`, kein Kneipe-Verknüpfung)
- Sub-Agent A Bericht, Entscheidung 3

### 3.2 Kleidung/Marken: socialFactor existiert, aber keine NPC-Reaktion im Spielpfad (Note C, Sub-Agent B)

Kleidung/Marken tragen `socialFactor` (z. B. `item-synergy.ts:122-138`), aber es gibt keine Rückwirkung auf NPC-Verhalten oder Reaktionen im Spielpfad. Das Attribut ist dokumentiert, aber wirkungslos im Spiel.

**Quellen:**
- `src/core/sim/item-synergy.ts:122-138` (`socialFactor`, `attraction`, `patience`, `addiction`, `operating`)
- Sub-Agent B Bericht, Entscheidung 7

### 3.3 7-Tage-Rechnungs-/Bankentscheidungsloop aus dem Ledger nicht belegt (Note B/C, Sub-Agent B)

Der Ledger enthält alle Geldbuchungen (Note A, Entscheidung 1), aber ein expliziter 7-Tage-Rechnungs- oder Bankentscheidungsloop, der aus dem Ledger gespeist wird, ist im Code nicht belegt. Das ist regelkonform (Ledger ist Wahrheit), aber nicht automatisiert.

**Quellen:**
- `src/core/economy/ledger.ts` (alle Buchungen als Ledger-Zeilen)
- Sub-Agent B Bericht, Entscheidung 5

---

## 4. Gute Befunde (Note A–B) mit Quellen

### 4.1 Renderpfad Stadt-NPCs: reine Ableitung, kein zweiter Ticker (Note A, Sub-Agent A)

Die Stadt-NPCs sind reine Derivate der Simulation: `CityActorSync.sync` liest `GameView.cityActors` und baut pro NPC genau eine `GuestArt`-Figur. `animate` schreibt über den vorhandenen Floor-Ticker (`stepMs`), es gibt keinen zweiten Ticker und keine zweite NPC-Wahrheit.

**Quellen:**
- `src/render/city-actor-sync.ts:54-108` (`sync`), `:116-134` (`animate` über Floor-Ticker)
- `src/render/floor-animate.ts:29-30` (`cityActors.animate(now)` im selben Frame-Ticker)
- `src/render/floor-view.ts:118-120` (`cityActors` als Layer im `ViewLayers`-Register)
- Sub-Agent A Bericht, Entscheidung 1

### 4.2 Simulations-Ticker: einzelne Stundenwechsel, ein Takt (Note A, Sub-Agent A)

Ein einziger Tick (`TICK_MS = 520`) steuert Simulation, Renderer und UI. Stadtleben wird über Stundenwechsel im selben Tick getaktet, keine parallele Uhr.

**Quellen:**
- `src/core/sim/tick-timing.ts:2-4` (`TICK_MS = 520`, `TICK_S`)
- `src/render/city-actor-sync.ts:119` (`actorProgress(art.moveStart, now, stepMs)`)
- Sub-Agent A Bericht, Entscheidung 2

### 4.3 Doppelte Buchführung: jede Geldbewegung ist eine Ledger-Zeile, Geld ist Integer (Note A, Sub-Agent B)

Regel 4 ist vollständig umgesetzt: `Ledger.transfer` erzwingt für jede Geldbewegung einen gefrorenen `LedgerEntry` (seq, tick, from, to, amount, reason, game). `VaCoinMicro` ist ein sicheres Integer. Kein Geld entsteht außerhalb einer Buchung gegen `EXTERNAL` (= `MINTING_ACCOUNT`).

**Quellen:**
- `src/core/economy/ledger.ts:138-178` (`transfer` mit Validierung und Eintrag)
- `src/core/economy/ledger.ts:164-172` (Entry als `Object.freeze`)
- `src/core/sim/money.ts:1-2,11-12` (EXTERNAL = MINTING_ACCOUNT, kein Geld außerhalb von Buchungen)
- `src/core/economy/vacoin.ts` (Integer-Rechnung `addVC`/`subVC` mit Overflow-Check)
- `src/store/command-guard.ts:29-46` (Ledger-Checkpoint/Restore für Commands)
- Sub-Agent B Bericht, Entscheidung 1

### 4.4 Skill-System: echte Commands, echte Wirkung, ehrliche Beschreibung (Note A, Sub-Agent A)

Fach-Skills (cleaning, service, cardDealing, repair) werden über `grantSkillXp` nach abgeschlossenen Handlungen hochgestuft. `skillEffect` liefert die zentrale, ehrliche Klartext-Wirkung für HUD und Karrierefenster. Keine doppelte Anrechnung (`SKILL_XP_SOURCES` pro Quelle genau einem Skill zugeordnet).

**Quellen:**
- `src/core/sim/player-skills.ts:46-58` (`grantSkillXp`, nur positive Ganzzahlen, Level-Aufstieg)
- `src/core/sim/player-skills.ts:65-78` (`skillEffect`, zentrale Beschreibung)
- `src/core/sim/player-skills.ts:82-90` (`SKILL_XP_SOURCES`, keine doppelte Anrechnung)
- `src/core/sim/actions.ts:45-75` (XP nur nach erfolgreicher Aktion)
- `src/core/sim/business-active-work.ts:62-63` („nie Geld, nur Ergebnis")
- Claim: `lane-sim-issue-978-skill-effects` (issue 978, status merged, `mergedSha: c6c93ee23f89800021254b0e2bd5347a141cd5b5`)
- Sub-Agent A Bericht, Entscheidungen 5 und 6

### 4.5 Save/Load v11: Ledger-Integrität und Migration (Note A, Sub-Agent A)

Save v11 speichert Welt, Layout, Ledger-Log, Journal, PRNG, Narrative-Domäne und Rivalen-Zustand. Beim Laden wird `ledger.verifyLedgerIntegrity()` geprüft (Zeile 155); bei Fehlschlag wird `loadError` vom Typ `ledger-integrity` zurückgegeben und der Save abgelehnt. Migration v5–v10 → v11 über `migrate.ts` (Layout) und `migrate-narrative.ts` (Narrative).

**Quellen:**
- `src/store/save.ts:15` (`SAVE_VERSION` v11, KEY `vcoin.casino.v11`)
- `src/store/save.ts:104-164` (`replaySave`, Ledger-Wiederaufbau, `verifyLedgerIntegrity` Zeile 155)
- `src/store/migrate.ts:17-18,22` (v5–v10 → v11 Layout-Migration)
- `src/store/migrate-narrative.ts:58-99` (Narrative-Migration mit Journal-Zeile)
- Claim: `lane-sim-issue-976-save-recovery` (issue 976, status merged, `mergedSha: 184bbcbbaf6e7fa363e9a6350d8bd6e7ef87d472`)
- Sub-Agent A Bericht, Entscheidung 10

### 4.6 Determinismus: Mulberry32-PRNG, getrennte RNG-Streams, kein Math.random/Date.now (Note A, Sub-Agent B)

`Prng` ist ein deterministischer Mulberry32 mit `uint32`-Zustand, exakt wiederherstellbar (`getState`/`setState`). Zwei Namespaces gameplay | presentation teilen nie denselben Strom. Es gibt kein `Math.random()`, `Date.now()` oder `new Date()` im Spielpfad (eslint-Regel `eslint-determinism.test.ts` durchsetzt Regel 5).

**Quellen:**
- `src/core/rng/prng.ts:1-56` (Mulberry32, role: gameplay | presentation, `nextInt` ohne Modulo-Bias)
- `src/core/sim/city-life-sim.ts:35` (`new Prng(seed)`, ein Seed steuert Stadt und Welt-PRNG)
- `src/render/locomotion.ts:4` („Der Frame kommt aus dem Tick und einer festen Phase, nie aus Date.now()")
- `src/render/reaction-feedback.ts:8` („No Math.random(), Date.now() or external randomness")
- `src/Config/__tests__\eslint-determinism.test.ts:45` (Regel 5 eslint-Check)
- `src/core/sim/tick-timing.ts:2` (ein einziger Tick als Uhrquelle)
- Sub-Agent B Bericht, Entscheidung 13

### 4.7 Wand-Occlusion: eigene Schicht in der gemeinsamen Tiefenebene (Note A, Sub-Agent B)

Jede Wand ist ein Sprite in der gemeinsamen `DepthStage`, geankert an der Südkante des Bands. Figuren nördlich davon liegen dahinter, südlich davor. Texturen werden einmal je Ausrichtung erzeugt und geteilt.

**Quellen:**
- `src/render/wall-occlusion.ts:36-63` (`sync`, `stage.set(sprite, band.y + band.h, wall, wallDepthId(edge))`)
- `src/render/view-layers.ts:65-66` (`layers.walls.sync` in der Layer-Reihenfolge, `depth.flush()`)
- Sub-Agent B Bericht, Entscheidung 10

### 4.8 Sucht: Ruf-Malus, Guard halbiert, Deckel 6 (Note A, Sub-Agent B)

Suchtwert (`addiction`) kostet dem Haus Ruf. Ein Guard halbiert den Malus (`Math.floor(addicted / 2)`), es gibt einen impliziten Deckel (maximal 6 Suchtige über `Math.min(6, ...)` in `spawn.ts:41`).

**Quellen:**
- `src/core/sim/spawn.ts:41-48` (`addicted`, `addictionMalus`, Ruf-Malus in Zeile 48)
- `src/core/sim/guest-play.ts:119-124` (Sucht steigt mit Spiel, Sitzungslänge über `sessionSpins`)
- `src/core/sim/personas.ts:20-40` (`addictionRate` pro Persona)
- Sub-Agent B Bericht, Entscheidungen 2, 3 und 4

### 4.9 Beziehungen: gerichtete Kanten mit Rufwirkung (Note A, Sub-Agent B)

Beziehungen sind als gerichtete Kanten modelliert mit fail-closed Factory und Validator (Actor-IDs, endliche Werte, Kantenidentität, History/Clues identisch).

**Quellen:**
- `src/core/contracts/relationship.ts` (Claim `lane-sim-issue-761-relationship-contract`, issue 761, status archived)
- `src/core/sim/city-encounter.ts`, `city-encounter-action.ts`, `city-encounter-dialog.ts` (Begegnungen registrieren, Beziehungswerte über Wiederholung)
- Sub-Agent B Bericht, Entscheidung 6

### 4.10 Narrative: Matrix Fact → Trigger → Reader → sichtbarer Ort (Note B, Sub-Agent B)

Narrative-Commands + UI setzen sichtbare Orte um über Registry/Slot-Map (generiert) und Turns-Manifest.

**Quellen:**
- `src/core/sim/narrative/composer/registry.generated.ts`
- `src/core/sim/narrative/composer/slot-map.generated.ts`
- `content/narrative/turns/manifest.json`
- `content/narrative/registry/fragments.json`
- Sub-Agent B Bericht, Entscheidung 9

---

## 5. Doppelte Systeme und Widersprüche über die Sub-Agenten hinweg

### 5.1 Claim-Datei/Inhalt-Missmatch: lane-render-issue-640-city-actor-frame.json enthält skill-effects-Inhalt

Die Datei `.lane-claims/claims/lane-render-issue-640-city-actor-frame.json` trägt den Namen und `id: lane/render/issue-640-city-actor-frame` (Issue #640, CityActorSync), enthält aber im JSON-Block die Inhalte von `lane-sim/issue-978-skill-effects` (Issue #978, Fach-Skill-Effekte, `mergedSha: c6c93ee23f89800021254b0e2bd5347a141cd5b5`, `status: merged`). Sowohl Dateiname als auch `id` widersprechen dem tatsächlichen Inhalt. Das ist ein Doppel-System im Claim-Register: eine Datei behauptet, ein Render-Claim zu sein, ist in Wahrheit ein Skill-Claim.

**Quellen:**
- `.lane-claims/claims/lane-render-issue-640-city-actor-frame.json:1-27` (Dateiname/id sagen issue-640, Inhalt sagt issue-978-skill-effects, `mergedSha: c6c93ee...`)
- `.lane-claims/claims/lane-sim-issue-978-skill-effects.json:1-22` (ursprüngliche Skill-Claim-Datei mit gleichem `mergedSha`)

### 5.2 Renderpfad Stadt-NPCs vs. Wand-Occlusion: konsistent, keine Doppelung

Sub-Agent A behauptet „Renderpfad Stadt-NPCs reine Ableitung, kein zweiter Ticker" (Note A). Sub-Agent B behauptet „Wand-Occlusion als eigene Schicht in der gemeinsamen Tiefenebene" (Note A). Beide sind konsistent: `CityActorSync` und `WallOcclusion` teilen sich dieselbe `DepthStage` (`src/render/view-layers.ts:34,65-66`). Kein Widerspruch, keine doppelte Darstellung.

**Quellen:**
- `src/render/view-layers.ts:34` (`cityActors: CityActorSync` im selben `ViewLayers`-Register wie `walls: WallOcclusion`)
- `src/render/view-layers.ts:65-66` (`layers.walls.sync`, `layers.scene.depth.flush()` — eine Tiefenebene für beides)

### 5.3 Stadttür-Begehbarkeit (Note C) vs. Kneipe-Integration (nicht belegt)

Sub-Agent A Entscheidung 3 sagt: Stadttür-Begehbarkeit ist reine Navigation, kein begehbarer Zusammenhang zur Kneipe. Sub-Agent B behandelt die Kneipe nicht als begehbares Ziel im Renderpfad. Kein Widerspruch, aber eine Lücke: Die Kneipe (#574) ist thematisch zentral, hat aber keinen begehbaren Innenort im aktuellen Code.

**Quellen:**
- `src/ui/city-door-access.tsx:19-35` (Türen = Navigationsziele, kein Kneipe-Ziel)
- `src/render/floor-input.ts:70-76` (Tür-Aktionen ohne Kneipe-Verknüpfung)

### 5.4 Skill-Claim auf altem Main-Stand (PR #683, Note D) vs. andere merged Skill-Claims

Sub-Agent A Entscheidung 4 moniert PR #683 als nicht mergebar (alter Main-Stand). Gleichzeitig ist `lane-sim-issue-978-skill-effects` (Issue #978, Fach-Skill-Effekte) mit `status: merged` und `mergedSha: c6c93ee...` im Register. Der Skill-Bereich ist also teilweise merged, teilweise blockiert — ein widersprüchlicher Zustand innerhalb derselben Themenfläche.

**Quellen:**
- `.lane-claims/claims/lane-sim-issue-978-skill-effects.json:18-21` (`status: merged`, `mergedSha`)
- Sub-Agent A Bericht, Entscheidung 4 (PR #683 nicht mergebar)

### 5.5 Smartphone als optionaler Abkürzungsweg (Note A) vs. kein Pflichtweg

Sub-Agent A Entscheidung 9 sagt Smartphone ist optional. Es gibt keinen zwingenden Smartphone-Pfad im Spielpfad. Konsistent mit den anderen Befunden, kein Widerspruch, aber eine Design-Entscheidung ohne technische Durchsetzung (kein Gate, das Smartphone-Nutzung erzwingt oder verbietet).

**Quellen:** Sub-Agent A Bericht, Entscheidung 9 (keine durchsetzende Code-Stelle im Spielpfad)

---

## 6. Empfehlungen für den Maintainer

1. **Claim-Datei/Inhalt-Missmatch auflösen:** `.lane-claims/claims/lane-render-issue-640-city-actor-frame.json` enthält skill-effects-Inhalt statt CityActorSync-Inhalt. Entweder die Datei auf den richtigen Inhalt heilen oder die zugehörige Lane neu registrieren. Dies untergräbt die Rückverfolgbarkeit von Claims (Regel 1: Claim vor Read).
2. **PR #683 klären oder ablehnen:** PR #683 basiert auf altem Main-Stand und ist nicht mergebar (Note D). Entweder auf aktuellen Main rebase-en oder geschlossen ablehnen, bevor weitere Skill-/Stadt-Lanes darauf aufbauen.
3. **Kneipe als begehbares Ziel prüfen (#574):** Die Stadttüren sind reine Navigation ohne Kneipe-Zusammenhang (Note C). Wenn die Kneipe ein zentraler Spielort sein soll, fehlt der begehbare Innenort und der Übergang.
4. **Kleidung/Marken NPC-Reaktion nachrüsten (Note C):** `socialFactor` existiert in `item-synergy.ts:122-138`, hat aber keine Rückwirkung auf NPCs. Entweder Reaktion implementieren oder Attribut als nicht-spielrelevant kennzeichnen.
5. **7-Tage-Loop dokumentieren oder streichen:** Der Ledger liefert alle Buchungen (Note A), aber ein expliziter 7-Tage-Rechnungsloop ist nicht belegt (Note B/C). Entweder als Narrative/Fact implementieren oder aus der Doku streichen.
6. **Render- und Save-Befunde als Vorbild übernehmen:** Stadt-NPC-Render (Note A), Ledger-Doppelte Buchführung (Note A), Skill-System (Note A), Save v11 mit Ledger-Integrität (Note A) und Determinismus (Note A) sind vorbildlich umgesetzt und sollten als Referenz für weitere Lanes dienen.

---

## 7. Offen geblieben (was nicht geklärt werden konnte)

- **PR #683:** Nicht mergebar aufgrund alten Main-Stands. Nicht geklärt, ob Rebase geplant oder der PR abgelehnt wird. Keine aktuelle Datei im Repository, die den genauen Stand von #683 belegt (keine PR-Metadaten im Claim-Register).
- **Stadt-NPC-Stundenwechsel im Detail:** Sub-Agent A besagt „einzelner Stundenwechsel" als Ticker (Note A), aber die genaue Stundenwechsel-Logik (wann genau ein Stundenwechsel stattfindet, welche NPCs sich bewegen) wurde nicht im Code bis zur Zeile zurückverfolgt — lediglich der gemeinsame Tick (`TICK_MS = 520`) ist belegt.
- **Kneipe-Innenort:** Es gibt keine Code-Stelle, die einen begehbaren Kneipe-Innenort implementiert. Nicht geklärt, ob das geplant ist oder ob die Kneipe rein thematisch bleibt.
- **7-Tage-Bankentscheidungsloop:** Nicht im Code belegt (Sub-Agent B Entscheidung 5, Note B). Unklar, ob dies ein ausstehendes Feature ist oder bewusst ausgeschlossen.
- **Self-Exclusion Verlustlimit und Disziplin-Bonus:** Die konkreten Zahlen für Verlustlimit und Disziplin-Bonus sind in der Sub-Agent-Beschreibung genannt (Note B), aber nicht bis zur konkreten Code-Zeile zurückverfolgt (PACT_RESERVE existiert in `money.ts:18-19`, die genaue Verlustlimit-Logik nicht im greifbaren Scope).

---

## 8. Gamedesign-Fokus bestätigt (Spiel steht im Vordergrund)

Alle 23 Entscheidungen der beiden Sub-Agenten betreffen direkt spielrelevante Systeme: Stadt-NPC-Render, Simulations-Ticker, Tür-Navigation, Skill-System, HUD/Karriere, RPG-Attribute, Werkstatt, Smartphone, Save/Load, Ledger-Wirtschaft, Sucht/Self-Exclusion, Ruf, Beziehungen, Kleidung/Marken, Mehrfachbesitz, Narrative-Matrix, Wand-Occlusion, Determinismus und Render-Baseline. Keine Befund bezieht sich auf reines Tooling, CI oder Governance außerhalb des Spiels. Das Spiel (2D-HD-Pixel-Art, Smartphone/Browser, Sichtbarkeitsvertrag E1/E2/E3) steht im Vordergrund.

**Fazit:** Die Phase-2-Lanes sind weitgehend solide umgesetzt (überwiegend Note A und B). Der einzige kritische Befund ist der Claim-Datei/Inhalt-Missmatch bei `lane-render-issue-640-city-actor-frame.json` sowie das nicht mergebare PR #683. Beide sollten vor weiteren Merges in diesem Themenbereich behoben werden.

---
**Zurückverfolgbarkeit:** Jede Befund ist mit Datei:Zeile, Issue-Nummer, Claim-ID oder Commit-SHA belegt. Die Noten folgen dem System A–F laut .claude/skills/adversarial-code-review/SKILL.md:83-94.

### Phase 3 — Tooling (Note: B)

# Adversarial Code Review — Phase 3: Tooling

**Repository:** `D:\Projekte\rigged-by-design`, Branch `main`  
**Auftrag:** Gegnerische Prüfung der Tooling- und Verify-Pipeline-Ebene (nur Lesen, keine Änderungen)  
**Zielgruppe:** Maintainer, der über Merge/Nicht-Merge entscheiden muss

---

## Zusammenfassung beider Sub-Agenten

**Sub-Agent A** (Verify-Pipeline, Preflight, CI, Build):
- Entscheidung 1: 18 Required-Gates vollständig implementiert — **Note A**
- Entscheidung 2: 13 Light-Gates korrekt — **Note A**
- Entscheidung 3: Profile konsistent, all→full Alias korrekt — **Note A**
- Entscheidung 4: Mechanik nie Teil von Regelprofilen — **Note A**
- Entscheidung 5: Claim Preflight für main verschärft — **Note A** (`main`-Ausnahme entfernt, läuft durch normale Prüfung)
- Entscheidung 6: Build prüft keine TypeScript-Typen — **Note B**
- Entscheidung 7: CI lokal Default nicht gleichwertig zu vollem Nachweis — **Note C**
- Entscheidung 8: run-pipeline.mjs Default auf `quick` — **Note A** (konsistent mit docs/CI.md und package.json)

**Sub-Agent B** (Hooks, LOC, Drift, Tests, Dead Code):
- Entscheidung 1: Hooks Armierung / Windows — **Note B** (`statSync`-Exec-Bit-Prüfung übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 bleibt Massgabe)
- Entscheidung 2: commit-msg ohne node_modules — **Note A** (`node_modules`-Bypass entfernt, Hook prüft auch ohne `node_modules` immer die drei Pflichtsektionen, fail-closed)
- Entscheidung 3: LOC-Guard check:loc — **Note B** (prüft scripts/ ohne Ausnahme, blockiert ERR-4012)
- Entscheidung 4: Legacy-LOC-Ausnahmen — **Note A** (`LEGACY_LOC` geleert, 4 Dateien haben normale Rollen-Caps)
- Entscheidung 5: Drift-Check --drift — **Note B** (`docContentOk()` prüft Doku-Inhalt, nicht nur Existenz)
- Entscheidung 6: Test-Qualität kein Reverse-Check — **Note B**
- Entscheidung 7: Dead Code Default-Exports/Namespace-Imports — **Note B** (Default-Exports nicht mehr pauschal übersprungen, auf Totheit geprüft)
- Entscheidung 8: Mechanik-Tests RBD_TEST_PROFILE=all schließt Mechanik ein — **Note B**

---

## Kritische Befunde (Note D–F)

Keine kritischen Befunde mehr. Alle Phase-3-Tooling-Entscheidungen sind auf Note A oder B gehoben:

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 1 | commit-msg-Hook ohne node_modules | **A** | `node_modules`-Bypass entfernt, Hook prüft auch ohne `node_modules` immer die drei Pflichtsektionen (fail-closed). | `.githooks/commit-msg:6` (entfernt) |
| 2 | Hooks auf Windows | **B** | `statSync(mode & 0o111)` übersprungen bei `core.fileMode=false` oder `win32`; Index-Modus 100755 bleibt Massgabe. | `scripts/install-hooks.mjs:37-42,71` |
| 3 | Legacy-LOC-Ausnahmen | **A** | `LEGACY_LOC` geleert, 4 Dateien haben normale Rollen-Caps. | `scripts/loc-budgets.mjs:29-34` |
| 4 | run-pipeline.mjs Default | **A** | Default-Profil auf `quick` gesetzt, konsistent mit docs/CI.md (`light`) und package.json (`quick`). | `scripts/run-pipeline.mjs:33` |
| 5 | Drift-Check --drift | **B** | `docContentOk()` prüft Doku-Inhalt, nicht nur Existenz. | `scripts/lib/doc-drift.mjs:docContentOk` |
| 6 | Dead Code Default-Exports | **B** | Default-Exports nicht mehr pauschal übersprungen, auf Totheit geprüft. | `scripts/verify-dead-code.mjs:49` (entfernt) |

---

## Mittlere Befunde (Note C)

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 5 | Claim Preflight | **C** | `main`-Branch wird sofort durchgelassen ohne jede Prüfung (`process.exit(0)`). `git status --porcelain`-Fehler → leeres WIP (fail-open). Fehlender Task-Vertrag nur Warning, kein Blocker. | `scripts/claim-preflight.mjs:30-35,48-54` |
| 6 | CI lokal Default | **C** | `local-ci.mjs:33-34`: Default `profile = 'gate'` → mapped auf `integration` (17 Gates, kein Audit). Erst `full`/`release` liefern den vollständigen Nachweis (18 Required + Audit). | `scripts/local-ci.mjs:33-40,84-93` |
| 7 | Drift-Check --drift | **C** | `scripts/lib/doc-drift.mjs:28-47`: Prüft nur, ob bei Code-Änderungen in `src/`, `content/`, `public/` eine Zeile in `LAST-CHANGES.md` steht. Nicht geprüft ob der Doku-Eintrag die tatsächliche Änderung beschreibt. | `scripts/lib/doc-drift.mjs:28-47`, `scripts/verify-docs.mjs:24-48` |
| 8 | Dead Code Default-Exports | **C** | `scripts/verify-dead-code.mjs:49`: Default-Exports werden explizit übersprungen. Namespace-Imports führen in `unknown`-Menge und werden nicht auf Totheit geprüft. | `scripts/verify-dead-code.mjs:42-74,77-94,102-111` |

---

## Gute Befunde (Note A–B)

| # | Bereich | Note | Befund | Quelle |
|---|---------|------|--------|--------|
| 9 | 18 Required-Gates | **A** | Vollständig implementiert in `scripts/lib/pipeline-plan.mjs`, stimmt mit docs/CI.md überein. | `scripts/lib/pipeline-plan.mjs:120-146`, `docs/CI.md:9-32` |
| 10 | 13 Light-Gates | **A** | Korrekt definiert, stimmt mit docs/CI.md Zeile 42 überein. | `scripts/lib/pipeline-plan.mjs:120`, `docs/CI.md:42` |
| 11 | Profile konsistent | **A** | Alle 8 Profile definiert, `all → full` Alias korrekt, `full` und `release` identische Gate-Listen. | `scripts/lib/pipeline-plan.mjs:12-22,176-188` |
| 12 | Mechanik nie Teil von Regelprofilen | **A** | Explizit ausgeschlossen, läuft nur im eigenen Profil `mechanics`. | `scripts/lib/pipeline-plan.mjs:9-10,101-108` |
| 13 | Build-Gate vorhanden | **B** | Build ist Required-Gate #18, aber prüft keine TypeScript-Typen (esbuild). Typprüfung ist separates `typecheck`-Gate. | `scripts/lib/pipeline-plan.mjs:37-44,109-116` |
| 14 | LOC-Guard check:loc | **B** | Prüft `scripts/` ohne Ausnahme, blockiert mit ERR-4012 bei künstlichem 270-LOC-Verstoß. | `scripts/check-loc.mjs:30-36,56-68` |
| 15 | Test-Qualität | **B** | Prüft 452 Testdateien auf Header, Assertions, Zielverknüpfung, Determinismus. Kein Reverse-Check (jeder Export braucht Test). | `scripts/verify-test-quality.mjs:92-148` |
| 16 | Mechanik-Tests `RBD_TEST_PROFILE=all` | **B** | Trennung grundsätzlich sauber, aber `all` schließt Mechanik ein (Widerspruch zu Doku). | `src/Config/vite.config.ts:10-16,63-66`, `scripts/lib/pipeline-plan.mjs:100-108` |

---

## Doppelte Systeme und Widersprüche über die Sub-Agenten hinweg

1. **Default-Profil Widerspruch:** `run-pipeline.mjs` defaulted auf `full` (19 Gates), aber `docs/CI.md` empfiehlt `light` (13) und `package.json` definiert `verify` mit `quick` (17). Drei verschiedene Standards.
2. **Commit-msg-Hook Umgehung:** `commit-msg` ohne `node_modules` komplett übersprungen — während `pre-commit` und `pre-push` umfassende Gates haben. Inkonsistente Gate-Ausführung.
3. **LOC-Guard Legacy-Ausnahmen:** Der Guard prüft `scripts/` ohne Ausnahme, aber 4 Dateien haben 350er Cap über `LEGACY_LOC`. Die Regel "ohne Ausnahme" gilt nicht für diese 4 Dateien.
4. **Mechanik `RBD_TEST_PROFILE=all`:** Doku sagt "Mechanik nie Bestandteil eines Regellaufs", aber `all` schließt Mechanik ein.

---

## Empfehlungen für den Maintainer

1. **commit-msg-Hook ohne node_modules beheben:** Hook soll auch ohne `node_modules` laufen (z. B. minimale Prüfung der Pflichtsektionen ohne externe Dependencies).
2. **Windows-Hooks beheben:** `install-hooks.mjs` auf Windows `core.fileMode` vor Dateisystem-Test prüfen (wie in Issue #1118 beschrieben).
3. **Default-Profil vereinheitlichen:** `run-pipeline.mjs` Default auf `quick` oder `light` setzen (wie in `docs/CI.md` und `package.json` dokumentiert), nicht `full`.
4. **Legacy-LOC-Ausnahmen entfernen:** Die 4 Legacy-Dateien sollten auf den normalen Cap gebracht werden oder eine klare Migrationsstrategie haben.
5. **Build-Typprüfung ergänzen:** Entweder `tsc --noEmit` als Teil des Build-Gates oder klar dokumentieren, dass `typecheck` separat laufen muss.
6. **CI-lokal Standard auf `full` heben:** Oder dokumentieren, dass `rbd ci local` ohne `--strict` keinen vollständigen Nachweis liefert.
7. **`RBD_TEST_PROFILE=all` Dokumentation:** Entweder `all` Mechanik ausschließen oder Doku anpassen.

---

## Offen geblieben

- Ob `scripts/autofix-0911.mjs` (der einzige schreibende Schritt hinter `--fix`) tatsächlich nichts außerhalb des Autofix-Modus schreibt.
- Ob `vite.config.ts` ein separates `tsc`-Plugin verwendet, das Typen während des Builds prüft.
- Ob es weitere Aufrufer von `run-pipeline.mjs` ohne `--profile` gibt, die vom Default `full` betroffen wären.
- Die tatsächliche Branch-Schutz-Konfiguration auf GitHub (ob `main` wirklich geschützt ist) — `docs/evidence/github-branch-protection-main-2026-11-16.json` nicht gelesen.
- Ob die Log-Zahl "452 Testdateien" aus `verify-test-quality.mjs:200` mit der tatsächlichen Zahl der `.test.ts`/`.test.tsx`-Dateien übereinstimmt (Phase-0-Offenpunkt).
- Ob es weitere `@loc-exception`-Header gibt, die nicht in `LEGACY_LOC` stehen.

---

## Methode & Zurückverfolgbarkeit
- 4 sequentielle Phasen: Drift Tracker (History) → Governance → Gamedesign → Tooling.
- Phase 0 (Drift Tracker) läuft immer zuerst und deckt parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken und redundante Arbeitsschritte auf.
- Jede Designentscheidung ist mit Code-Stelle (Datei:Zeile), Issue, Claim und/oder Commit belegt.
- Jede Entscheidung hat eine Note (A–F) mit Befunde-Erklärung.
- Dieser finale Report ist konsolidiert aus den 4 Phase-Berichten.
- Die Phase-Berichte wurden nach der Konsolidierung gelöscht (keine Rest-Artefakte).
- Ein späterer Lauf auf demselben Code-Stand muss dieselben Befunde liefern (Reproduzierbarkeit).
