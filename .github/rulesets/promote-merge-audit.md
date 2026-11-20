# promote-merge.mjs — Task-Vertrag Audit (FREEZE-0)

## Status: dokumentiert (Fix durch jenova erforderlich, Gap #3)

## Befund: Legacy-Merge bei fehlendem Task-Vertrag (nur Warnung)

### Code-Stelle (Zeile 30-32)
```javascript
} else {
  warn(`PR #${number}: kein Task-Vertrag am Kopf; Legacy-Merge mit Warnung`);
}
```

### Problem
Wenn kein Task-Vertrag am Kopf des Branches gefunden wird (`contractRef` ist null), gibt `promote-merge.mjs` nur eine Warnung aus und fährt mit dem Merge fort. Das ist **nicht fail-closed**.

### STV-P0-FREEZE0-DECISION.md Gap #3
> promote-merge.mjs erlaubt Legacy-Merge bei fehlendem Task-Vertrag (nur Warnung)
> Fix: Task-Vertrag fail-closed machen ODER Legacy-Pfad explizit als dokumentierte Ausnahme + Head-SHA-Prüfung beibehalten
> Owner: jenova (Fix) → governance-office (Audit)

### Anforderung (Exit-Kriterium #3)
> `promote-merge.mjs` liefert bei fehlendem Task-Vertrag KEINEN Merge (fail-closed) — Nachweis: 1 Negativ-Test

### Empfehlung (governance-office Audit)
Ersetzen Sie Zeile 30-32 durch einen fail-closed Hold:
```javascript
} else {
  return holdPromotion(number, null, 'FEHLGESCHLAGEN: kein Task-Vertrag am Kopf des Branches (fail-closed)');
}
```

### Zusammenhang mit FREEZE-0
FREEZE-0 erfordert, dass jeder Merge durch einen Task-Vertrag gedeckt ist. Ein Legacy-Merge ohne Vertrag untergräbt den FREEZE-0-Schutz und ermöglicht indirekte Umgehung der Branch-Protection.

## Andere Prüfstellen (bereits fail-closed)

| Prüfstelle | Zeile | Verhalten bei Fehlschlag |
|------------|-------|-------------------------|
| PR-Status verifiziert | 18-19 | `holdPromotion` |
| Task-Vertrag gültig | 24-26 | `holdPromotion` |
| Blocker im Vertrag | 27-29 | `holdPromotion` |
| Plan-Artifact gültig | 36-37 | `holdPromotion` |
| Stale Base | 40-43 | `holdPromotion` + Branch-Update |
| Blocked Issues | 46-51 | `holdPromotion` |
| Contract Hold | 54-55 | `holdPromotion` |
| PR-Body lesbar | 57-58 | `holdPromotion` |
| Pflichtsektionen im Body | 61-67 | `holdPromotion` |
| Merge durch GitHub | 71 | `holdPromotion` wenn abgelehnt |

## Fazit

Die einzige nicht-fail-closed Prüfstelle ist der fehlende Task-Vertrag (Legacy-Pfad). Alle anderen Prüfungen sind bereits fail-closed. Der Fix ist auf eine Zeile beschränkt (Zeile 30-32).