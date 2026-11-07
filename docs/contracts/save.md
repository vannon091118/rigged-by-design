# Contract: save v1.0

**Contract-ID:** `save`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/save`  
**Basis-SHA:** `7cf5f84` (lane/contracts/relationship)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/world-time` (Contract 2), `lane/contracts/domain-event` (Contract 3), `lane/contracts/relationship` (Contract 4)

## Zweck

Save-Envelope mit deterministischer Roundtrip-Regel, Versionierung und Migration-Registry. Jeder Save-Zustand wird als versionsierte Envelope (Version, ID, Zeitstempel, Daten) persistiert. Die Envelope ermöglicht den deterministischen Roundtrip: Speichern und Wiedereinladen liefern bei identischem Eingang denselben Zustand. Die Migration-Registry konvertiert ältere Save-Formate auf die aktuelle Version.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `save` | Der Contract-Namespace selbst |
| `save-id` | Eindeutige Save-Envelope-ID |
| `save-version` | Versionsnummer der Envelope |

## Invarianten

1. **Save-Envelope-Struktur:** Jede Envelope besitzt `version` (SaveVersion), `id` (SaveId), `timestamp` (number) und `data` (unknown).
2. **Deterministischer Roundtrip:** Gleiche Eingaben für `createSaveEnvelope` liefern bei gleichem `timestamp` dieselbe Envelope (keine Uhrzeit, kein Zufall).
3. **Versionierung:** `version` ist eine monoton steigende Nummer; Änderungen am Save-Format erfordern einen Versionssprung.
4. **Migration-Registry:** Jede unterstützte Save-Version hat einen registrierten Migrationspfad zur aktuellen Version.
5. **Timestamp-Invariante:** `timestamp` muss eine nicht-negative, sichere Ganzzahl sein (keine echte Uhrzeit, Simulations-Zeit aus `world.tick`/`world.day`).
6. **Daten-Integrität:** `data` darf nicht `undefined` sein; bei primitiven Typen wird der Wert 1:1 rundgetrippelt.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/save` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Save-Versionen können als zusätzliche Envelope-Versionen hinzugefügt werden. Bestehende Envelopes ändern ihre Struktur nicht ohne Versionssprung. Breaking Changes an `SaveEnvelope` erfordern Version 2.0 mit Save-Migration.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Save-Versionen können als `deprecated` markiert bleiben, werden aber beim Laden migriert.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Die Migration-Registry konvertiert ältere Save-Envelopes auf die aktuelle Version; der Roundtrip bleibt deterministisch.
- Roundtrip-Regel: `validateSaveEnvelope(createSaveEnvelope(v, id, data))` muss `true` liefern; Speichern und Wiedereinladen derselben Envelope liefert identische `data`.

## Consumer

Alle Domain-Lanes, die Save-Zustände verwalten: `lane/contracts/world-time`, `lane/contracts/domain-event`, `lane/contracts/relationship`, `lane/contracts/factor`, sowie alle Game- und Save-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/save.test.ts`.
