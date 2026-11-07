# Contract: relationship v1.0

**Contract-ID:** `relationship`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/relationship`  
**Basis-SHA:** `7cf5f84` (lane/contracts/world-time)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/domain-event` (Contract 3)

## Zweck

Gerichtete Relationship-IDs und erlaubte Änderungsbefehle. Jede Beziehung zwischen zwei Aktern (z. B. Gast → Haus, Rivale → Haus, Gast → Gast) wird als gerichtete Kante mit Haltung, Wohlwollen und Historie geführt. Relationships sind die Grundlage für Trigger-Evaluierung, Rivalen-Entscheidungen und Narrative-Events.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `relationship` | Der Contract-Namespace selbst |
| `edge-id` | Eindeutige Beziehungskante (sourceActorId → targetActorId) |

## Invarianten

1. **Gerichtete Kanten:** Eine Beziehung hat immer eine Quelle und ein Ziel (sourceActorId → targetActorId). Die Richtung ist semantisch bedeutsam.
2. **Einmalig pro Paar:** Zwischen zwei spezifischen Aktern existiert pro Beziehungstyp maximal eine aktive Kante.
3. **Actor-Referenzen:** Sowohl source als auch target müssen gültige Actor-IDs aus dem `actor-id` Contract sein.
4. **Historie-Retention:** Maximal 6 Einträge pro Beziehung (älteste werden verdrängt).
5. **Indizien-Retention:** Maximal 4 Indizien pro Beziehung (älteste werden verdrängt).

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/relationship` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Relationship-Typen können hinzugefügt werden. Bestehende Kanten ändern ihre Struktur nicht ohne Versionssprung.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Relationship-Typen können als `deprecated` markiert bleiben.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Save-Format enthält Relationship-Zustand; Migration konvertiert alte Einträge.

## Consumer

Alle Domain-Lanes, die Beziehungen zwischen Aktern verwalten: `lane/contracts/factor`, `lane/contracts/save`, Narrative-Lanes, Rivalen-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/relationship.test.ts`.
