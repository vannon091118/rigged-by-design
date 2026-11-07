# Contract: actor-id v1.0

**Contract-ID:** `actor-id`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/actor-id`  
**Basis-SHA:** `9070cba`  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`

## Zweck

Dauerhafte Actor-ID und Referenzregeln. Jeder Akteur im Spiel (Gast, Besucher, Mitarbeiter, Rivale, Spieler) erhält eine stabile, unveränderliche ID, die über Sessions, Saves und Ticks hinweg konsistent bleibt. Actor-IDs sind die Grundlage für alle gerichteten Relationships, Domain-Events und Facts.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `actor-id` | Der Contract-Namespace selbst |

Actor-IDs folgen dem Muster: `<domäne>_<sequenz>` (z. B. `guest_42`, `rival_7`, `player_1`). Sie sind strings, keine Zahlen, um Domänen-Trennung zu gewährleisten.

## Invarianten

1. **Einmalig vergeben:** Eine Actor-ID wird genau einmal erstellt und nie wiederverwendet.
2. **Unveränderlich:** Eine Actor-ID ändert sich nie über den Lebenszyklus eines Akteurs hinweg.
3. **Domänen-getrennt:** Präfixe (`guest_`, `rival_`, `visitor_`, `staff_`, `player_`) verhindern Kollisionen zwischen Akteurstypen.
4. **Referenz-integrität:** Jede Reference auf eine Actor-ID muss auf eine existierende ID zeigen (fail-closed bei Auflösungsfehlern).

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/actor-id` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Actor-IDs können hinzugefügt werden, bestehende IDs ändern sich nicht. Version 2.0 würde nur dann breaking sein, wenn das ID-Format selbst geändert wird.

## Upgrade-/Deprecation-Strategie

- Deprecation: Eine Actor-ID kann als `deprecated` markiert werden, bleibt aber auflösbar.
- Removal: Nie (Actor-IDs sind dauerhaft).
- Migration: Nicht erforderlich (IDs sind unveränderlich).

## Consumer

Alle Domain-Lanes, die Akteure referenzieren: `lane/contracts/world-time`, `lane/contracts/domain-event`, `lane/contracts/relationship`, `lane/contracts/factor`, `lane/contracts/save`.

## Vertragstest

Siehe `src/core/contracts/__tests__/actor-id.test.ts`.
