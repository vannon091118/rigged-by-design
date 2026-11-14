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

Factor-IDs, Kategorie, Grundgewicht, Untereinflüsse, Kontext und Contribution-Trace. Ein Factor ist ein benannter, versionsunabhängiger Beitrag mit einem opaken `FactorId`, einem String-zu-String-Kontext (`FactorContext`) und einer unveränderlichen Spur von Beitrags-IDs (`ContributionTrace`). Explizit **ohne** Raum- oder Objektrollen: ein Factor beschreibt weder wo noch welches Objekt, sondern nur *welchen* Beitrag mit *welchem* Kontext und *welcher* Trace.

## Version 1.1

v1.1 ist additiv gegenüber v1.0. Die Laufzeitstruktur wird um drei Pflichtfelder erweitert:

- `category` — nicht-leere Kategorie des Factors,
- `baseWeight` — globaler Multiplikator des Factors im Bereich `0..1`,
- `children` — geordnete Untereinflüsse (`FactorChild[]`).

`createFactor` setzt für Aufrufer, die nur die v1.0-Signatur verwenden, neutrale Defaults. `validateFactor` prüft die neuen Felder und ihre Wertebereiche. Die maschinenlesbare Version steht in `FACTOR_CONTRACT_VERSION`.

## Struktur

### Factor

| Feld | Typ | Pflicht | Default | Regel |
|------|-----|---------|---------|-------|
| `id` | `FactorId` | ja | — | nicht-leerer String |
| `category` | `string` | ja | `ALLGEMEIN` | nicht-leer, nicht nur Whitespace |
| `baseWeight` | `number` | ja | `1` | endlich, `0..1` |
| `children` | `readonly FactorChild[]` | ja | `[]` | Array; jedes Kind wird validiert |
| `context` | `FactorContext` | ja | — | `Record<string, string>`; alle Werte Strings |
| `contributions` | `ContributionTrace` | ja | — | `readonly string[]`; leere Spur ist gültig |

### FactorChild

| Feld | Typ | Pflicht | Regel |
|------|-----|---------|-------|
| `id` | `string` | ja | nicht-leer und innerhalb eines Factors eindeutig |
| `category` | `string` | ja | nicht-leer, nicht nur Whitespace |
| `baseWeight` | `number` | ja | endlich, `0..1` |
| `weight` | `number` | ja | endlich, `-1..1`; negativ ist eine Gegenwirkung |

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `factor` | Der Contract-Namespace selbst |
| `factor-id` | Eindeutige, opake Factor-ID |

## Invarianten

1. **Opake ID:** Eine Factor-ID ist ein stabiler, nicht leerer String ohne interne Struktur, die der Contract auswertet.
2. **Kategorie:** `category` ist ein nicht-leerer String; der Default für alte Aufrufer ist `ALLGEMEIN`.
3. **Grundgewicht:** `baseWeight` ist eine endliche Zahl im Bereich `0..1`; der Default ist `1`.
4. **Untereinflüsse:** `children` ist ein Array. Jedes Kind besitzt eine nicht-leere, innerhalb des Factors eindeutige `id`, eine nicht-leere `category`, ein endliches `baseWeight` im Bereich `0..1` und ein endliches `weight` im Bereich `-1..1`.
5. **Kontext:** `FactorContext` ist ein `Record<string, string>`; alle Schlüssel und Werte sind Strings.
6. **Contribution-Trace:** `ContributionTrace` ist ein `readonly string[]`; Einträge werden nur angehängt, niemals verändert oder gelöscht. Eine leere Spur ist gültig.
7. **Keine Raum-/Objektrollen:** Der Contract trägt keine Position, Zone, Tile-Referenz oder Objektrolle. Räumliche Rollen leben in `lane/contracts/relationship` und `lane/contracts/save`, nicht hier.

## Validierung

`createFactor(id, context, contributions, options)` prüft die Factor-ID und setzt die Defaults für `category`, `baseWeight` und `children`. Die Optionswerte werden nicht beim Erzeugen validiert; `validateFactor(factor)` ist die verbindliche Prüfung und gibt `false` zurück, wenn eine der Invarianten verletzt ist. Sie wirft nicht.

`validateFactor` prüft insbesondere:

- nicht-leere `id` und `category`,
- `baseWeight` endlich in `0..1`,
- `children` als Array mit eindeutigen Kind-IDs,
- Kind-`category` nicht-leer,
- Kind-`baseWeight` endlich in `0..1`,
- Kind-`weight` endlich in `-1..1`,
- alle Kontextwerte als Strings,
- alle Trace-Einträge als Strings.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/factor` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilität

- **Alte Aufrufer:** `createFactor(id, context, contributions)` bleibt gültig. Die neuen Felder werden mit `ALLGEMEIN`, `1` und `[]` belegt.
- **Neue Aufrufer:** `createFactor(id, context, contributions, { category, baseWeight, children })` setzt die v1.1-Felder explizit.
- **Additiv:** Bestehende Felder (`id`, `context`, `contributions`) ändern ihre Struktur nicht. Neue Felder und neue Kind-Eigenschaften können ohne Bruch hinzukommen; das Entfernen eines Pflichtfelds erfordert eine neue Hauptversion und eine Save-Migration.
- **Persistierte Factor-Daten:** Factor-Traces sind Laufzeit-Ausgabe; das Save-Envelope speichert keine Factor-Objekte. Wer Factor-Daten dennoch persistiert, muss v1.0-Einträge vor `validateFactor` mit den Defaults ergänzen. Ein v1.1-Factor ohne `category`, `baseWeight` oder `children` ist ungültig und wird fail-closed abgelehnt.
- **Consumer:** Die Influence-Matrix erzeugt ihren Trace mit `category: 'MATRIX'`, `baseWeight: 1` und den konfigurierten Kindern; sie bleibt damit auf v1.1.

## Upgrade-/Deprecation-Strategie

- Deprecation: Alte Factor-IDs können als `deprecated` markiert bleiben, bleiben aber lesbar.
- Removal: Nur mit neuer Hauptversion und Save-Migration.
- Migration: Persistierte v1.0-Factordaten werden vor der Validierung um die Defaults ergänzt; die Migration ist fail-closed und verändert keine bestehenden Beiträge.
- Version: `FACTOR_CONTRACT_VERSION` ist die maschinenlesbare Quelle; Code, Test und diese Referenz müssen dieselbe Version nennen.

## Consumer

Alle Domain-Lanes, die benannte Beiträge mit Kontext und Trace verwalten: `lane/contracts/save`, `lane/contracts/relationship`, Narrative-Lanes, Rivalen-Lanes sowie die Influence-Matrix in `src/core/sim/influence.ts`.

## Vertragstest

Siehe `src/core/contracts/__tests__/factor.test.ts`. Der Test prüft die Laufzeitinvarianten und vergleicht `FACTOR_CONTRACT_VERSION` mit dieser Referenz; er verhindert erneute Versions- und Schema-Drift.
