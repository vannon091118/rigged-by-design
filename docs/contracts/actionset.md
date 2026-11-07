# Contract: actionset v1.0

**Contract-ID:** `actionset`  
**Version:** 1.0  
**Owner:** Integrator  
**Lane:** `lane/actionset/0-6-actionset-v2`  
**Basis-SHA:** `d0c730cd59d6e822bba501a854b5f466c165876e`
**Status:** `draft` → `active` nach Merge  
**Domain:** `kern`  
**Gate-Profil:** `quick`  
**Dependencies:** `lane/contracts/relationship` (Contract 5)

## Zweck

Erweiterbares Interaktionsmodell für domain-registrierte Actions. Ein ActionSet ist eine Sammlung benannter, kategorisierter Aktionen, die ein Domain-Bereich über einen ActionProvider registriert und konsumierende Leser abfragen können. Jede Aktion trägt die Felder `id`, `label`, `icon`, `category`, `priority`, `enabled` sowie optional `enabledReason`. Das `enabled`-Feld gibt an, ob die Aktion aktiv ist; `enabledReason` trägt bei `enabled === false` den Deaktivierungsgrund als lesbaren Text.

## Stabile IDs

| ID | Bedeutung |
|----|-----------|
| `actionset` | Der Contract-Namespace selbst |
| `action-id` | Eindeutige Aktion innerhalb eines Providers (ActionId) |
| `action-category` | Kategorie einer Aktion (ActionCategory) |

## Invarianten

1. **Eindeutige IDs:** Jede Action hat eine nicht-leere, innerhalb ihres Providers eindeutige `id`.
2. **Label und Icon:** `label` und `icon` sind nicht-leere Strings.
3. **Kategorie:** `category` ist ein nicht-leerer String aus dem `ActionCategory`-Namespace.
4. **Priorität:** `priority` ist eine ganze Zahl (höher = wichtiger/vorrangiger).
5. **Enabled-Flag:** `enabled` ist ein Boolean; `true` bedeutet aktiv, `false` deaktiviert.
6. **Deaktivierungsgrund:** Ist `enabled === false`, muss `enabledReason` ein nicht-leerer String sein, der den Grund trägt. Ist `enabled === true`, ist `enabledReason` optional und sollte unset sein.
7. **Provider-Interface:** Ein ActionProvider muss `registerAction` und `getActions` implementieren; `getActions` gibt eine readonly-Kopie der registrierten Aktionen zurück.

## Leser / Schreiber

| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/actionset/06-actionset` | write |
| Leser | alle Domain-Lanes | read |

## Kompatibilitätsregel

Backward-kompatibel: Neue Action-Kategorien und neue Felder können hinzugefügt werden. Bestehende Felder (`id`, `label`, `icon`, `category`, `priority`, `enabled`) ändern ihre Struktur nicht ohne Versionssprung. Die Änderung von `enabled` von `true` auf `false` muss mit einem `enabledReason` begleitet werden.

## Consumer

Alle Domain-Lanes, die interaktive Aktionen registrieren oder konsumieren: `lane/contracts/factor`, `lane/contracts/save`, Narrative-Lanes, Rivalen-Lanes, UI-Lanes.

## Vertragstest

Siehe `src/core/contracts/__tests__/actionset.test.ts`.
