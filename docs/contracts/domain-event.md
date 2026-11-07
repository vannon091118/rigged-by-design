# Contract: domain-event v1.0

**Contract-ID:** `domain-event`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/domain-event`  
**Basis-SHA:** `7cf5f84` (lane/contracts/world-time)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/world-time` (Contract 2)

## Zweck

Event-Hülle mit Actor-/Zeit-Referenzen und Payload-Version. Jedes Ereignis im Spiel (Gast kommt, Gast geht, Rivalen-Aktion, Narrative-Entscheidung, Ledger-Buchung) wird als Domain-Event mit stabiler ID, Actor-Referenz, Zeitstempel (world.tick/world.day) und versioniertem Payload abgelegt.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `domain-event` | Der Contract-Namespace selbst |
| `event-id` | Eindeutige, monoton steigende Event-ID |
| `payload-version` | Version des Event-Payload-Schemas |

## Invarianten

1. **Einmalige ID:** Jede Event-ID wird genau einmal vergeben und nie wiederverwendet.
2. **Actor-Referenz:** Jedes Event referenziert mindestens eine gültige Actor-ID aus dem `actor-id` Contract.
3. **Zeitstempel:** Jedes Event trägt `world.tick` und `world.day` aus dem `world-time` Contract.
4. **Payload-Versionierung:** Jeder Event-Typ hat eine stabile Payload-Version; inkompatible Änderungen erfordern Versionssprung.
5. **Fail-closed:** Unbekannte Event-Typen oder inkompatible Payload-Versionen werden abgelehnt (nicht still ignoriert).

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/domain-event` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Event-Typen können hinzugefügt werden. Bestehende Event-Typen ändern ihr Payload-Schema nur mit neuer `payload-version`. Alte Versionen werden weiterhin geparst (Fail-closed bei Unbekanntem).

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Payload-Versionen können als `deprecated` markiert werden, bleiben aber lesbar.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Save-Format enthält Event-Historie mit `payload-version`; Migration konvertiert alte Payloads.

## Consumer

Alle Domain-Lanes, die Events produzieren oder konsumieren: `lane/contracts/relationship`, `lane/contracts/factor`, `lane/contracts/save`, sowie alle Game- und Narrative-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/domain-event.test.ts`.
