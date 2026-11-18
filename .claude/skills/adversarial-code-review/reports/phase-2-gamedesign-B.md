# Phase 2 Gamedesign — Zwischenbericht B (Adversarial Code Review)

**Sub-Agent:** B (Fokus: Wirtschaft #527/#538, Narrative #541, Backlog-Order #563, Determinismus)  
**Repo:** `D:\Projekte\rigged-by-design`  
**Branch:** `lane/governance/audit-fixes-2026-11-18`  
**Datum:** 2026-11-18

---

## Bewertungsmaßstab

Jede geprüfte Designentscheidung erhält eine Note **A–F**.  
A = vorbildlich, konsistent, durchgesetzt · B = solide, kleine Lücken · C = akzeptabel, dokumentiert, aber schwache Durchsetzung · D = kritisch, Inkonsistenz/Doppelung, driftgefährdet · F = versagt, offen bypassbar.

Zu jeder Note gibt es eine Befunde-Erklärung und eine zurückverfolgbare Quelle (Datei:Zeile, Commit-SHA, Issue #, PR #, Claim-ID). Fokus: Integer-Ledger (VaCoinMicro), double-entry bookkeeping, RNG (Mulberry32 gameplay/presentation), Narrative-Status-Grenzen, Backlog-Priorisierung, Wirtschaft (Bar, Club, Arena, Wetten). Kritische Befunde (D/F) werden gesondert hervorgehoben.

---

## Geprüfte Designentscheidungen

### D1 — Integer-Ledger: VaCoinMicro branded integer (src/core/economy/vacoin.ts)

**Note: A**

**Befunde:**  
Geld wird ausschließlich als `VaCoinMicro` (brandeder `number`, 1 VC = 10_000 Mikro-Einheiten) geführt. `fromVC` rundet kaufmännisch, `addVC`/`subVC` werfen bei Überlauf, `mulVC` rechnet exakt per BigInt mit Floor zugunsten der Bank. `canAfford` erlaubt niemals negative Deckung. Es gibt keine Float-Geldwerte im Spielpfad. Tests decken 0.1+0.2=0.3000 exakt ab (`src/core/economy/__tests__/economy.test.ts:14-19`).

**Quelle:** `src/core/economy/vacoin.ts:5-92`; `src/core/economy/__tests__/economy.test.ts:14-19`

**Bewertung:** Vorbildlich. Integer-Geld ist konsistent durchgesetzt; kein Float-Leck im Kern sichtbar.

---

### D2 — Double-entry bookkeeping (src/core/economy/ledger.ts, ledger-integrity.ts)

**Note: A**

**Befunde:**  
Jeder Geldfluss ist eine Ledger-Buchung `from -> to` gegen `EXTERNAL_WORLD` (Minting-Konto). Geld entsteht oder verschwindet nur durch eine Buchung gegen das Außenwelt-Konto. `Ledger.transfer` berechnet beide neuen Salden vollständig vor der Mutation (subVC + addVC vor `this.#balances.set`) → atomar, kein Seq-Fortschritt bei Fehler. Einträge sind `Object.freeze`. Bilanzprüfung via Replay gegen `verifyBalanceSheet` (Summe aller Konten = 0). Verbindlichkeitskonten (`openLiability`) dürfen negativ stehen statt zu kappen.

**Quelle:** `src/core/economy/ledger.ts:138-178`; `src/core/economy/ledger-integrity.ts:35-68`; `src/core/economy/__tests__/ledger-atomicity.test.ts`; `src/core/economy/__tests__/ledger-checkpoint.test.ts`

**Bewertung:** Sehr stark. Double-entry ist durchgesetzt, atomar, replay-sicher. Ledger-Halt (`src/store/ledger-halt.ts`) sichert den ersten Fehler und verhindert Folgefehler.

---

### D3 — Tick-Guard: inkrementelle Bilanzprüfung pro Tick (src/core/economy/ledger-tick-guard.ts, src/store/world-tick.ts)

**Note: A**

**Befunde:**  
`assertLedgerBalanced` läuft nach jedem `tickWorld` / `tickActionQueue`. Bei Bruch wird die teure `diagnose()` einmal aufgerufen und in den Fehler geschrieben; der Tick bleibt unverändert. `WorldTick.run()` ruft `advanceWorld` und hält bei Fehler dauerhaft an (nur `reset()` gibt frei). Kein zweiter Lauf auf inkonsistentem Zustand.

**Quelle:** `src/core/economy/ledger-tick-guard.ts:38-57`; `src/store/world-tick.ts:57-69`; `src/store/__tests__/ledger-tick-balance.test.ts`

**Bewertung:** Fail-closed, korrekt. Der Tick-Guard ist eine starke Grenze gegen Ledger-Korruption.

---

### D4 — RNG: Mulberry32 mit gameplay/presentation-Namespaces (src/core/rng/prng.ts, streams.ts, gameplay-entry-points.ts)

**Note: A**

**Befunde:**  
`Prng` ist ein deterministischer Mulberry32 (uint32-Zustand, exakt wiederherstellbar). Zwei Namespaces: `gameplay` bewegt Welt/Spiel, `presentation` (Partikel, Sound, UI-Effekte) wird nie gespeichert und bewegt keinen Spielzustand. `assertGameplayRng()` wirft, wenn ein non-gameplay-Strom Spielzustand ziehen würde. `GAMEPLAY_RNG_ENTRY_POINTS` listet versioniert alle öffentlichen Gameplay-Grenzmodule (sim.tickWorld, sim.advanceToNextDay, games.playRound); ein Test schlägt fehl, sobald eine exportierte Funktion mit Prng-Parameter in der Liste fehlt. `entropySeed()` nutzt `crypto.getRandomValues` nur beim Laufanlegen; danach ist alles geseedet und wiederholbar.

**Quelle:** `src/core/rng/prng.ts:1-56`; `src/core/rng/streams.ts:1-34`; `src/core/rng/gameplay-entry-points.ts:32-59`; `src/core/rng/__tests__/gameplay-entry-role.test.ts`; `src/store/__tests__/determinism.test.ts`

**Bewertung:** Vorbildlich. Trennung Gameplay/Presentation ist durchgesetzt, entry points versioniert und getestet. Determinismus-Test bestätigt: gleicher Seed → gleicher Verlauf/Export, Export stempelt Welt nicht Uhr.

---

### D5 — RNG: Weighted Distribution & pickWeighted (src/core/rng/weighted.ts)

**Note: B**

**Befunde:**  
`buildDistribution` baut Gewichte einmalig auf, Bias ist hart auf `MAX_BIAS_BPS = 9_000` (10×) begrenzt, Deadzones auf Gewicht 0, jede Einzelchance bleibt unter 1. `rollNumber` zieht einen Wert; `chance` stammt aus derselben Verteilung wie die Ziehung. `pickWeighted` sucht zyklisch ohne zusätzlichen PRNG-Verbrauch, akzeptiert optionalen Filter, gibt `null` ohne Kandidat. Keine offensichtliche Manipulation zwischen angezeigter Chance und Ziehung.

**Quelle:** `src/core/rng/weighted.ts:47-130`; CLAUDE.md: Claim `lane/integrity/03-ledger` umfasst `src/core/rng/weighted.ts` (merged)

**Bewertung:** Solide. Bias ist begrenzt und transparent. Kleine Lücke: `MAX_BIAS_BPS` ist ein hart codierter Konstantenwert ohne Konfigurationspfad für externe Anpassung.

---

### D6 — Save/Load v11 mit Ledger-Integrität (src/store/save.ts, save-format.ts, migrate.ts)

**Note: A**

**Befunde:**  
Save v11 serialisiert Welt + Ledger-Log + PRNG + Narrative-Domäne + Rivalen-Zustand (`SAVE_VERSION = 11`). Beim Laden wird der Ledger komplett re-gespielt (`ledger.transfer` pro Entry), dann `ledger.verifyLedgerIntegrity()` — bei Bruch wird der Save mit `ledger-integrity`-Fehler verworfen, nicht geladen. Legacy v5–v10 werden migriert, v3/v4 verworfen. Schuldbuchungen dürfen beim Replay nicht als Unterdeckung gelten (`openLiability(DEBT_ACCOUNT)` vor dem Replay). PRNG-Zustand wird mit gespeichert und wiederhergestellt (`prngState`).

**Quelle:** `src/store/save.ts:104-165`; `src/store/save-format.ts:8-78`; `src/store/__tests__/save-migration.test.ts`; `src/store/__tests__/prng-persistence.test.ts`

**Bewertung:** Stark. Ledger-Integrität wird beim Laden erzwungen, PRNG-Persistenz sichert Determinismus über Sitzungen hinweg.

---

### D7 — Narrative-Status-Grenzen (src/core/sim/narrative/boundary.ts, event-scheduler.ts, facts.ts)

**Note: C**

**Befunde:**  
`processNarrativeBoundaryDetailed` ist der einzige Verbraucher der Fact-Queue: Ledger-Facts, Geräte-/Lager-Facts, Event-Wartung, Wissensalterung, dann `drainFacts` → `applyMemories`/`applyRelationshipFacts`/`pushRecent`. Keine Rekursion, höchstens ein Durchlauf pro Boundary-Aufruf. Der Boundary ist die einzige Stelle, an der Narrative auf Weltzustand/Ledger reagiert ("narrative from state boundaries only"). Allerdings: Kontext-Hooks für Narrative sind nicht belegt — Issue #541 hängt an #733 (Abnahme 2/4 veraltet, Ersatz-Bausteine fehlen). Die Narrative-Lane (`lane/content/narrative`) ist `archived`, nicht merged.

**Quelle:** `src/core/sim/narrative/boundary.ts:25-45`; `src/core/sim/narrative/event-scheduler.ts`; board-state.json:694 ("541: OFFEN · Kontext-Hooks nicht belegt; hängt an #733"); `.lane-claims/claims.json` (lane/content/narrative: archived)

**Bewertung:** Akzeptabel, aber die Narrative-Grenzen sind dokumentiert, nicht vollständig durchgesetzt (Kontext-Hooks offen, Lane archiviert statt abgeschlossen).

---

### D8 — Narrative-Event-Definitionen (src/core/sim/narrative/events/definitions/*.ts)

**Note: B**

**Befunde:**  
14 Event-Templates sind zentral im `index.ts` registriert, ungültige Definitionen werden fail-closed herausgefiltert (`isEventTemplate`). Jedes Template hat `priority`, `scope`, `participantRoles`, `contentSlots`, `choices` mit Anforderungen/Kosten/Effekten, `expiresInTicks`, `cooldownTicks`, `maxOccurrences`. Effekte sind auf `ADJUST_RELATIONSHIP` / `SET_FLAG` beschränkt, keine direkten Ledger-Mutationen aus Event-Definitionen. Beispiele: `AMBIENT_BAR_TALK` (Bar, Priorität 20), `VISITOR_CONFLICT` (Priorität 80, maxOccurrences 1), `TURNIER_ABEND` (Engine-Demand, keine Choices).

**Quelle:** `src/core/sim/narrative/events/definitions/index.ts:18-32`; `src/core/sim/narrative/events/definitions/ambient-bar-talk.ts`; `src/core/sim/narrative/events/definitions/visitor-conflict.ts`; `src/core/sim/narrative/events/definitions/tournament-night.ts`

**Bewertung:** Solide. Templates sind deklarativ, keine Geld-Mutationen aus Narrative heraus. Keine offensichtliche "versteckte Wirtschaft" in Event-Definitionen.

---

### D9 — UI-Wirtschaft: BetConsole, HudMoney (src/ui/bet-console.tsx, hud-money.tsx)

**Note: B**

**Befunde:**  
`BetConsole` rendert Jetons, Autospin, Spin-Knopf; "ZU WENIG BARGELD" blockiert bei `blocked`. Keine direkte Ledger-Logik im UI — UI liest `bets`/`bet` als Props und ruft Callbacks auf. `HudMoney` zeigt Betrag, Kasse, Offen, Schuld, Pact, Tagesziel; `debt` blendet die Schuld-Zeile nur bei offener Schuld ein. Beides ist reine Präsentationsschicht, liest von Core, schreibt Commands.

**Quelle:** `src/ui/bet-console.tsx:15-42`; `src/ui/hud-money.tsx:20-56`

**Bewertung:** Solide. UI ist sauber vom Ledger getrennt, keine direkte Geldmanipulation im UI.

---

### D10 — Wirtschaft: Fremdes Spielen, Wetten, Risiko-Karten (src/store/foreign-play.ts, core/sim/money.ts)

**Note: C**

**Befunde:**  
`foreign-play.ts` bucht Einsätze (`foreignBet`) und Gewinne (`foreignWin`) über den Ledger gegen `EXTERNAL`, Risiko-Karten verdoppeln oder buchen zurück, Journal-Einträge und XP werden vergeben. `recordExclusionPlay`/`recordExclusionWin` registrieren Sucht-relevante Spieleinsätze. `payOrBorrow` in `money.ts` bucht Betriebskosten als Verbindlichkeit statt zu kappen, wenn die Kasse nicht deckt. Allerdings: Die Wirtschaft ist fragmentiert über `foreign-play.ts`, `money.ts`, `venue-commands.ts`, `service-commands.ts`. Es gibt keine zentrale Wirtschafts-Sicht; Bar/Club/Arena/Wetten sind nicht als eigene Domäne mit klaren Grenzen modelliert.

**Quelle:** `src/store/foreign-play.ts:1-161`; `src/core/sim/money.ts:102-132` (payOrBorrow); `src/store/venue-commands.ts`; `src/store/service-commands.ts`

**Bewertung:** Akzeptabel, aber fragmentiert. Keine zentrale Wirtschafts-Domäne; Bar/Club/Arena/Wetten-Verteilung und -Grenzen sind nicht explizit dokumentiert.

---

### D11 — Backlog-Priorisierung #563 (board-state.json, closedAsLivingDocument)

**Note: D — KRITISCH**

**Befunde:**  
Issue #563 (Backlog-Order) ist als `closedAsLivingDocument` geschlossen mit der Begründung: "Backlog-Order dupliziert GOVERNANCE.md 'Maintainer-Prioritäten (kanonisch)' und war seit 751edc66 veraltet." Das bedeutet: Es gibt kein separates, aktuelles Backlog mehr; die Prioritäten leben nur in `GOVERNANCE.md` und `board-state.json`. Beide sind abgeleitete Zustände, die driften können (vgl. Phase-1-Befunde D4/D5 zu Dualregistern). Es gibt keine durchsetzbare Backlog-Order als eigenständige Instanz.

**Quelle:** `.lane-claims/board-state.json:664` (closedAsLivingDocument: 563); `.lane-claims/board-state.json:161-168` (Issue #563, status OK, letzter Scan 2026-11-14); Commit `751edc66` (Veraltung)

**Bewertung (kritisch):** Backlog-Order wurde zugunsten von Dokumenten aufgelöst, die selbst Drift unterliegen (Phase-1: D4 claims/ vs claims.json, D5 merged-index vs board-state). Keine eindeutige, durchsetzbare Priorisierungsinstanz mehr.

---

### D12 — Wirtschaft #527: Pakt/Suchtwert global vs. fremdspielbegrenzt (board-state.json)

**Note: D — KRITISCH**

**Befunde:**  
Issue #527 ist blockiert (`blockedIssues`, Grund: "Produktentscheidung Pakt/Suchtwert (User) offen"). Die Produktentscheidung — ob Pakt/Suchtwert global oder nur fremdspielbegrenzt gilt — ist offen. Im Code existiert `recordExclusionPlay` nur aus `src/store/foreign-play.ts` (fremdes Spiel). Es gibt keine globale Sucht-Wert-Erfassung für eigenes Spiel. Die Zuweisung (Shinon [A2]) hat keinen Arbeits-Claim, 2× erinnert, sonst Maintainer-Entscheidung.

**Quelle:** `.lane-claims/board-state.json:671,690` (blocker 527, decision 527); `.lane-claims/board-state.json:88-90` (blockedIssues); `src/store/foreign-play.ts:164` (recordExclusionPlay nur aus foreign-play)

**Bewertung (kritisch):** Offen gebliebene Produktentscheidung blockiert die Wirtschaft; Sucht-Wert ist nur partiell (fremdspiel) erfasst, nicht global. Inkonsistenz zwischen Intention (global?) und Implementierung (nur fremdspiel).

---

### D13 — Wirtschaft #538: 7-Tage-Rechnungszyklus (board-state.json)

**Note: D — KRITISCH**

**Befunde:**  
Issue #538 ist offen: "kein 7-Tage-Rechnungszyklus: grep invoice|weekly in src = 0 Treffer". Es gibt keinen Rechnungs- oder Wochenzyklus im Code. Betriebskosten (`payOrBorrow`) werden ad-hoc als Verbindlichkeit gebucht, aber kein regelmäßiger 7-Tage-Zyklus mit Rechnungsstellung.

**Quelle:** `.lane-claims/board-state.json:692` (decision 538); `.lane-claims/board-state.json:121-128` (Issue #538, status OK)

**Bewertung (kritisch):** Ein angekündigter Wirtschaftszyklus (7-Tage-Rechnung) ist nicht implementiert. Die Wirtschaft läuft ohne periodische Abrechnung.

---

### D14 — Determinismus-Erzwingung (eslint-determinism, store/__tests__/determinism.test.ts)

**Note: A**

**Befunde:**  
CLAUDE.md: "Rule: no Math.random/Date.now/new Date() in game path (enforced by eslint-determinism.test.ts)". Der Determinismus-Test (`src/store/__tests__/determinism.test.ts`) bestätigt: gleicher Seed + gleiche Ticks = gleicher Verlauf + gleicher Export; Export hängt an der Welt, nicht an der Wanduhr. `entropySeed()` nutzt Krypto nur einmal beim Laufanlegen.

**Quelle:** `CLAUDE.md` (Determinismus); `src/store/__tests__/determinism.test.ts:8-53`; `src/core/rng/streams.ts:13-21` (entropySeed)

**Bewertung:** Vorbildlich. Determinismus ist getestet und durch eslint determinism erzwungen.

---

## Kritische Befunde (D / F)

| # | Entscheidung | Note | Kernproblem | Quelle |
|---|-------------|------|-------------|--------|
| K1 | D11 — Backlog-Order #563 | **D** | Backlog aufgelöst in GOVERNANCE.md/board-state.json, die selbst driften; keine durchsetzbare Priorisierungsinstanz | `board-state.json:664`; Commit `751edc66` |
| K2 | D12 — Wirtschaft #527 | **D** | Pakt/Suchtwert global vs. fremdspielbegrenzt offen; Sucht nur fremdspiel erfasst; kein Arbeits-Claim | `board-state.json:671,690`; `foreign-play.ts` |
| K3 | D13 — Wirtschaft #538 | **D** | 7-Tage-Rechnungszyklus nicht implementiert (grep invoice|weekly = 0) | `board-state.json:692` |
| K4 | D7 — Narrative #541 | **C** (näher an D) | Kontext-Hooks nicht belegt, hängt an #733; Narrative-Lane archiviert | `board-state.json:694`; `claims.json` (lane/content/narrative: archived) |

Keine Note F festgestellt.

---

## Zusammenfassung

- **Anzahl geprüfter Entscheidungen:** 14 (D1–D14)
- **Kritischste Note:** D (drei kritische Befunde K1–K3 bei Backlog-Order #563, Wirtschaft #527, Wirtschaft #538; D7 näher an D)
- **Dateipfad des Berichts:** `D:\Projekte\rigged-by-design\.claude\skills\adversarial-code-review\reports\phase-2-gamedesign-B.md`

Die stärksten Stellen sind das Integer-Ledger mit double-entry bookkeeping (D1, D2, beide A), der Tick-Guard mit fail-closed-Verhalten (D3, A), der Mulberry32-RNG mit gameplay/presentation-Trennung und versionierten Entry Points (D4, D5, A/B) sowie Save/Load v11 mit Ledger-Integrität und PRNG-Persistenz (D6, A). Determinismus ist getestet und durch eslint erzwungen (D14, A).

Die kritischen Befunde konzentrieren sich auf die Wirtschaft: nicht umgesetzte Produktentscheidungen (#527 Pakt/Suchtwert, #538 7-Tage-Rechnungszyklus) und die aufgelöste Backlog-Order (#563), die nun auf driftgefährdete Dokumente ausgelagert ist. Die Narrative-Grenzen (D7, #541) sind dokumentiert, aber nicht vollständig durchgesetzt (Kontext-Hooks offen, Lane archiviert).