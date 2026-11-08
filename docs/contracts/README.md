# Vertragsindex

<!-- rbd-doc: v0.3.183 | 2026-11-08 01:01 UTC -->

**Zweck:** Die sieben Kernverträge unter `docs/contracts/` mit Owner, Writer und Vertragstest. Die Vertragsdatei bleibt die Wahrheit; dieser Index macht sie auffindbar.

## Verträge

| Contract-ID | Zweck | Owner | Writer-Lane | Vertragstest |
| --- | --- | --- | --- | --- |
| [`actionset`](actionset.md) | ActionSet, ActionProvider, Kategorien und Enabled-Gründe | Integrator | `lane/actionset/06-actionset` | `src/core/contracts/__tests__/actionset.test.ts` |
| [`actor-id`](actor-id.md) | Stabile Actor-IDs und Referenzintegrität | Integrator | `lane/contracts/actor-id` | `src/core/contracts/__tests__/actor-id.test.ts` |
| [`domain-event`](domain-event.md) | Unveränderliche Event-Hülle und `eventId`-Ableitung | Interaction-Contract-Owner | `lane/contracts/domain-event-v3` | `src/core/contracts/__tests__/domain-event.test.ts` |
| [`factor`](factor.md) | Factor-ID, Kontext und Contribution-Trace | Integrator | `lane/contracts/factor` | `src/core/contracts/__tests__/factor.test.ts` |
| [`relationship`](relationship.md) | Gerichtete Kanten, Haltung und Retention | Integrator | `lane/contracts/relationship` | `src/core/contracts/__tests__/relationship.test.ts` |
| [`save`](save.md) | Save-Envelope, Versionierung und Migration | Integrator | `lane/contracts/save` | `src/core/contracts/__tests__/save.test.ts` |
| [`world-time`](world-time.md) | `world.tick`, `world.day` und Zeitdomänen | Integrator | `lane/contracts/world-time` | `src/core/contracts/__tests__/world-time.test.ts` |

Der Status steht in der jeweiligen Vertragsdatei. Die meisten Verträge sind dort als `draft` → `active` nach Merge geführt; der Index erfindet keinen Status.

## Schreibregeln

1. **Genau ein Writer pro Contract-ID.** Read-only-Konsumenten dürfen parallel arbeiten; der Claim trägt den Modus.
2. **Vertragstest ist Pflicht.** Jede aktive Fähigkeit und jeder Vertrag braucht einen registrierten Test; `pnpm run verify:capabilities` prüft die Pfade und Test-IDs.
3. **Keine zweite Wahrheit.** Der Vertrag beschreibt IDs, Invarianten und Kompatibilität; Welt-, Ledger-, RNG- und Save-Zustand bleiben bei ihren Ownern.
4. **Änderungen am Vertrag** laufen über einen Governance-/Contract-Claim, einen Test und einen Eintrag im [`INDEX.md`](../INDEX.md).
5. **Verweise** auf Verträge stehen in `docs/ARCHITECTURE.md` und in den Lane-Claims; neue Consumer tragen den Modus `read`.

## Referenzen

- [`INDEX.md`](../INDEX.md) — Doku-Landkarte.
- [`GOVERNANCE.md`](../GOVERNANCE.md) — Claims, Writer und Kollisionen.
- [`TESTING.md`](../TESTING.md) — Vertrags- und Governance-Nachweise.
