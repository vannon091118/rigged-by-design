# Contract: factor v1.1

**Contract-ID:** `factor`  
**Version:** 1.1  
**Owner:** Integrator  
**Lane:** `lane/contracts/factor`  
**Basis-SHA:** `308d01e` (lane/contracts/relationship)  
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/relationship` (Contract 4)

## Zweck

Factor-IDs, Kategorie, Grundgewicht, Untereinflüsse, Kontext und
Contribution-Trace. Ein Factor ist ein benannter, versionsunabhängiger Beitrag
mit einem opaken `FactorId`, einem String-zu-String-Kontext (`FactorContext`)
und einer unveränderlichen Spur von Beitrags-IDs (`ContributionTrace`).
Explizit **ohne** Raum- oder Objektrollen: ein Factor beschreibt weder wo noch
welches Objekt, sondern nur *welchen* Beitrag mit *welchem* Kontext und
*welcher* Trace.

## Additive v1.1-Erweiterung

Die Erweiterung ist rückwärtskompatibel und wird von
`lane/sim/factor-matrix-config` genutzt; der Contract-Writer bleibt
`lane/contracts/factor`.

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `category` | `string` | Nicht-leere balancedomäne, z. B. `ZUSTAND`, `BEZIEHUNG`, `ERINNERUNG`. |
| `baseWeight` | `number` (0..1) | Globaler Multiplikator; `1` ist neutral, `0` schaltet den Factor ab. |
| `children` | `FactorChild[]` | Untereinflüsse mit eigener ID, Kategorie, Grundgewicht und Anteil (-1..1). |

`createFactor` setzt für alte Aufrufer `category = "ALLGEMEIN"`,
`baseWeight = 1` und `children = []`. `validateFactor` prüft Kategorie,
Grundgewicht, eindeutige Kind-IDs und die Grenzen der Kind-Anteile fail-closed.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `factor` | Der Contract-Namespace selbst |
| `factor-id` | Eindeutige, opake Factor-ID |

## Invarianten

1. **Opake ID:** Eine Factor-ID ist ein stabiler, nicht leerer String ohne interne Struktur, die der Contract auswertet.
2. **Kontext:** `FactorContext` ist ein `Record<string, string>`; alle Schlüssel und Werte sind Strings.
3. **Contribution-Trace:** `ContributionTrace` ist ein `readonly string[]`; Einträge werden nur angehängt, niemals verändert oder gelöscht.
4. **Factor-Struktur:** Ein `Factor` besitzt immer `id`, `category`, `baseWeight`, `children`, `context` und `contributions`; fehlende Felder machen ihn ungültig.
5. **Untereinflüsse:** Jedes Kind trägt eine eindeutige ID, eine nicht-leere Kategorie, ein Grundgewicht in 0..1 und einen Anteil in -1..1; negative Anteile sind Gegenwirkungen.
6. **Keine Raum-/Objektrollen:** Der Contract trägt keine Position, Zone, Tile-Referenz oder Objektrolle. Räumliche Rollen leben in `lane/contracts/relationship` und `lane/contracts/save`, nicht hier.

## Matrix-Anbindung

Die balancebaren Gewichtungen liegen nicht im Contract, sondern in
`src/core/sim/influence-matrix.ts`:

- `factors` ist der Faktor-Katalog mit Kategorie, Grundgewicht, Wertebereich und Untereinflüssen.
- `contexts` gewichtet die Faktoren je Szene; `0` schaltet einen Faktor in dieser Szene aus.
- `cross` verbindet Faktoren und kann mit `contexts` auf eine Szene begrenzt werden.
- `furnitureContexts` und `defaultContext` lösen eine Möbelart in einen Matrix-Kontext auf.
- `eventPool` gewichtet die festen Main-Event-Szenen; die Auswahl bleibt optional und wiederholungsgedämpft.

`src/core/sim/influence-schema.ts` validiert dieses Dokument fail-closed;
`src/core/sim/influence-config.ts` ist der öffentliche Loader.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/factor` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Kontext-Schlüssel und neue Contribution-Trace-Einträge können hinzugefügt werden. Die Felder `category`, `baseWeight` und `children` sind additiv; alte Aufrufer erhalten Defaults. Die Struktur von `Factor` ändert sich nicht ohne Versionssprung. Keine Raum- oder Objektrollen werden nachträglich in den Contract aufgenommen.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Factor-IDs können als `deprecated` markiert bleiben, bleiben aber lesbar.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Save-Format enthält Factor-Zustand mit `id`, `context` und `contributions`; Migration konvertiert alte Einträge fail-closed. Die additiven Felder haben Defaults und brauchen keine Save-Migration.

## Consumer

Alle Domain-Lanes, die benannte Beiträge mit Kontext und Trace verwalten:
`lane/contracts/save`, `lane/contracts/relationship`, Narrative-Lanes,
Rivalen-Lanes und die Influence-Matrix (`lane/sim/factor-matrix-config`).

## Vertragstest

Siehe `src/core/contracts/__tests__/factor.test.ts` und
`src/core/sim/__tests__/influence.test.ts`.
