# Contract: world-time v1.0

**Contract-ID:** `world-time`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/world-time`  
**Basis-SHA:** `734b1b6` (lane/contracts/actor-id)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/actor-id` (Contract 1)

## Zweck

WorldTime, Calendar-Bezug und TimeDomain-Schlüssel. Die Spielwelt tickt deterministisch: `world.tick` inkrementiert sich um 1 pro `tickWorld()`, `world.day` inkrementiert sich alle `TICKS_PER_DAY` Ticks. Alle zeitlichen Referenzen im Spiel (Event-Fristen, Cooldowns, Gast-Zustände, Job-Tage) basieren auf `world.tick`/`world.day`, niemals auf der Uhrzeit.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `world-time` | Der Contract-Namespace selbst |
| `TICK_MS` | Dauer eines Ticks in Millisekunden (520 ms) |
| `TICKS_PER_DAY` | Ticks pro Simulations-Tag (600) |

## Invarianten

1. **Einzelne Zeitquelle:** `world.tick` ist die einzige Uhr im Spiel; kein `Date.now()`, `performance.now()` oder `new Date()` in Spielpfaden.
2. **Monoton steigend:** `world.tick` erhöht sich um genau 1 pro `tickWorld()`-Aufruf, nie zurückgesetzt außer bei `newGame()`.
3. **Tage aus Ticks:** `world.day` = `Math.floor(world.tick / TICKS_PER_DAY)`.
4. **Deterministisch:** Gleiche `world.tick` liefert immer dieselbe Zeit (keine echte Uhrzeit).
5. **Actor-ID-Referenzen:** Alle zeitlichen Events referenzieren Actor-IDs aus dem `actor-id` Contract.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/world-time` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue TimeDomain-Schlüssel können hinzugefügt werden. Änderungen an `TICK_MS` oder `TICKS_PER_DAY` sind breaking und erfordern Version 2.0 mit Save-Migration.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte TimeDomain-Schlüssel können als `deprecated` markiert bleiben, funktionieren aber weiter.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Save-Format enthält `world.tick` und `world.day`; Migration konvertiert alte Tick-Werte.

## Consumer

Alle Domain-Lanes, die Zeit referenzieren: `lane/contracts/domain-event`, `lane/contracts/relationship`, `lane/contracts/factor`, `lane/contracts/save`, sowie alle Game-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/world-time.test.ts`.
