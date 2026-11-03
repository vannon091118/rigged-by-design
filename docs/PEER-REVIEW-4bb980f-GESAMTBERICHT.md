# Konsolidierter Peer-Review-Report — Commit `4bb980f`

**Repository:** Rigged by Design (Vite + React 19 + TypeScript + PixiJS 8 Casino-Sim)  
**Branch:** `review-4bb980f`  
**Commit:** `4bb980f` (origin/main)  
**AGENTS.md:** v0.3.85 | 2026-11-03 02:15 UTC  
**Save-Format:** v9 (`vcoin.casino.v9`), Migration v5–v8, v3/v4 verworfen  
**NAR-Status:** NAR-00–11 erledigt; **NAR-12 in PR Check**; **NAR-13–17 in Arbeit**

---

## 1. Ausgangslage

Der Working Tree war sauber. `pnpm run agent:context` meldete: Baum sauber, keine Änderungen, 10 Gates bereit (Cache 0/10). Alle 4 Agenten arbeiteten auf demselben Stand `4bb980f` mit akkumulierendem Kontext.

---

## 2. Die 4 Perspektiven im Überblick

| # | Perspektive | Report | Kernurteil |
|---|---|---|---|
| 1 | Spiel-Integrität (Security-lite) | Integriert in diesen Bericht | Ledger, RNG, Determinismus, Headless-Core, Save/Migration konform. Keine blockierenden Befunde. |
| 2 | Software Architektur | Integriert in diesen Bericht | Durchgehend konform mit AGENTS.md. 3 Beobachtungen (B-1–B-3). |
| 3 | Junior Dev / Maintainability | Integriert in diesen Bericht | Alle statischen Gates grün. 131 Testdateien. Beobachtungen M1–M5. |
| 4 | Product / End User | Integriert in diesen Bericht | Spielfluss stimmig, Fairness spürbar, Narrative technisch weit aber unsichtbar. Beobachtungen O-1–O-8. |

---

## 3. Konsolidierte Befunde (alle direkt im Code verifiziert)

| Bereich | Befund | Schweregrad | Evidenz |
|---|---|---|---|
| **Ledger / Geld** | `MINTING_ACCOUNT = 'EXTERNAL_WORLD'` einzige Münzquelle/Senke. Doppelte Buchhaltung. Bilanz = 0. `addVC`/`subVC`/`mulVC` reine Integer-Rechenhilfen ohne Geldschöpfung. | Konform | `ledger-integrity.ts:7`, `ledger.ts`, `vacoin.ts` |
| **RNG** | Mulberry32, zwei Namespaces (`gameplay`/`presentation`), `assertGameplayRng` in `tickWorld`/`playRound`. Bias ≤ 9.000 bps. Kartenschuh ohne Zurücklegen. Einzige echte Entropie: `entropySeed()`. | Konform | `streams.ts:29`, `tick.ts:108`, `round.ts:55`, `weighted.ts:5`, `shoe.ts:25-50` |
| **Determinismus** | Keine nicht-deterministischen Quellen in `src/core/` oder `scripts/` außer dokumentierte Ausnahmen (`performance.now` in 3 Render-Dateien, `getRandomValues` in `streams.ts`, Zeitstempel/CI-Tooling). | Konform | `eslint.config.mjs` |
| **Headless-Core** | `src/core/` ohne Browser-/UI-/Store-Importe. `src/render` importiert aus `src/store` nur `import type { GameView }`. | Konform | grep: keine Treffer in `src/core/` |
| **Save / Migration** | `SAVE_VERSION = 9`, `KEY = 'vcoin.casino.v9'`, LEGACY v5–v8, OLD v3/v4 werden gelöscht. PRNG-Zustand wird fortgeführt (kein Re-Seed). Fail-Closed bei korrupten Saves. | Konform | `save.ts:8-14`, `repair.ts:9`, `migrate.ts` |
| **Architektur** | `world-store` einziger Owner von Welt/Ledger/PRNG/Save. UI liest nur Snapshots, sendet Commands. | Konform | `world-store.ts:1-162` |
| **Testvertrag** | `@test-target` und `@error-code` Headers auf allen Testdateien. Jede `it`/`test` eigenes `expect`. Keine festen `new Prng(...)`-Literalseeds. | Konform | `verify:test-quality` PASS (131 Testdateien) |
| **LOC** | Alle Dateien innerhalb Budget. 41 in Hot Zone. 5 existierende `// @loc-exception:` stimmen mit `LEGACY_LOC` überein. | Warnung | `check:loc` OK |

**Korrektur:** Agent 4 schrieb "Bias ≤ 9,00 bps (0,9 %)" — korrekt ist `MAX_BIAS_BPS = 9_000` (90 %). Agent 1 gab es korrekt an.

---

## 4. Beobachtungen (keine Gate-Verstöße)

| ID | Beschreibung | Schweregrad | Quelle |
|---|---|---|---|
| B-1 / M2 | Drei Core-Testdateien importieren aus `src/store/save` — Test-Kopplung an Store-Schicht. | Niedrig–Mittel | Agent 2 + 3 |
| B-2 / M1 / O-7 | `world-store.ts` erzeugt `new WorldStore()` beim Modul-Import (Singleton mit Import-Nebenwirkung). | Mittel | Agent 2 + 3 + 4 |
| B-3 / M3 / O-8 | Temporäres Dual-System: `demand.ts` neben `narrative/events/`. `trigger-evaluate` noch nicht im Tick. | Mittel | Agent 2 + 3 + 4 |
| M4 | 41 Dateien in der Hot Zone (4 über 240 Zeilen). | Niedrig | Agent 3 |
| M5 | Feste PRNG-Seeds in RNG-internen Tests (mit Variable, nicht Literal). | Niedrig | Agent 3 |
| O-1 | NAR-12: Trigger-Evaluator existiert, wird aber nicht im Tick aufgerufen. | Hoch | Agent 4 |
| O-2 | NAR-13: `demand.ts` in Narrative-Event-Engine migrieren. | Hoch | Agent 4 |
| O-3 | NAR-14: UI-Popup für Narrative-Choices fehlt. | Mittel | Agent 4 |
| O-4 | Audit: Pity-Entladungen heben RTP Startautomat auf 99,15 %. | Mittel | Agent 4 |
| O-5 | Audit: Schulden ohne Tilgungspfad, `PLAYER_CASH` ohne Ausgabepfad, Sucht steuert nichts. | Mittel | Agent 4 |
| O-6 | Audit: Einsatz skaliert nie mit Persona-Budget. | Mittel | Agent 4 |

---

## 5. Offen (NAR-Status)

| NAR | Status | Relevanz |
|---|---|---|
| NAR-00 bis NAR-11 | Erledigt | Grundlagen bis Composer |
| **NAR-12** | **In PR Check** | Trigger-Auswahl im Tick |
| **NAR-13 bis NAR-17** | **In Arbeit** | Demand-Migration, autonome Rivalen, Soak, Orchestrierung |

---

## 6. Empfohlene nächste Schritte

1. **NAR-12 abschließen** (PR Check): Trigger-Evaluator in den Tick einbinden.
2. **NAR-13 vorantreiben**: `demand.ts` in die Narrative-Event-Engine überführen (endet Dual-System B-3).
3. **NAR-14**: UI-Popup für Narrative-Choices bauen.
4. **Audit-Befunde O-4 bis O-6**: Pity-RTP prüfen, Tilgungspfad für Schulden, Ausgabepfad für `PLAYER_CASH`, Einsatz-Skalierung mit Persona.
5. **Hot-Zone-Dateien** bei Änderungen unter Hot Zone reduzieren (M4).