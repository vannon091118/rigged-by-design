# Contract: factor v1.0

**Contract-ID:** `factor`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/contracts/factor`  
**Basis-SHA:** `308d01e` (lane/contracts/relationship)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/relationship` (Contract 4)

## Zweck

Factor-IDs, Kontext und Contribution-Trace. Ein Factor ist ein benannter, versionsunabhängiger Beitrag mit einem opaken `FactorId`, einem String-zu-String-Kontext (`FactorContext`) und einer unveränderlichen Spur von Beitrags-IDs (`ContributionTrace`). Explizit **ohne** Raum- oder Objektrollen: ein Factor beschreibt weder wo noch welches Objekt, sondern nur *welchen* Beitrag mit *welchem* Kontext und *welcher* Trace.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `factor` | Der Contract-Namespace selbst |
| `factor-id` | Eindeutige, opake Factor-ID |

## Invarianten

1. **Opake ID:** Eine Factor-ID ist ein stabiler, nicht leerer String ohne interne Struktur, die der Contract auswertet.
2. **Kontext:** `FactorContext` ist ein `Record<string, string>`; alle Schlüssel und Werte sind Strings.
3. **Contribution-Trace:** `ContributionTrace` ist ein `readonly string[]`; Einträge werden nur angehängt, niemals verändert oder gelöscht.
4. **Factor-Struktur:** Ein `Factor` besitzt immer `id`, `context` und `contributions`; fehlende Felder machen ihn ungültig.
5. **Keine Raum-/Objektrollen:** Der Contract trägt keine Position, Zone, Tile-Referenz oder Objektrolle. Räumliche Rollen leben in `lane/contracts/relationship` und `lane/contracts/save`, nicht hier.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/factor` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Kontext-Schlüssel und neue Contribution-Trace-Einträge können hinzugefügt werden. Die Struktur von `Factor` ändert sich nicht ohne Versionssprung. Keine Raum- oder Objektrollen werden nachträglich in den Contract aufgenommen.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Factor-IDs können als `deprecated` markiert bleiben, bleiben aber lesbar.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Save-Format enthält Factor-Zustand mit `id`, `context` und `contributions`; Migration konvertiert alte Einträge fail-closed.

## Consumer

Alle Domain-Lanes, die benannte Beiträge mit Kontext und Trace verwalten: `lane/contracts/save`, `lane/contracts/relationship`, Narrative-Lanes, Rivalen-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/factor.test.ts`.
