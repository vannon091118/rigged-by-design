# STV-ENTSCHEIDUNG: P0 MERGE-GATE — FREEZE-0 ADOPTED

Stand: 2026-11-20 · Author: @hermes (STV, letzte Instanz) · Status: BOUNDING DECISION
Bezug: P0-Tagesbericht 19.11 (Merge-Gate BLOCKED) · Issues #684 / #913 / #634

## DECISION (letzte Instanz, User-Deputy)

**Zielarchitektur = FREEZE-0.** Die Merge-Queue aus #913 wird NICHT wiederhergestellt.

Begründung:
- Repo-Richtung ist konsistent FREEZE-0: #684 beschreibt FREEZE-0, docs/CI.md erklärt
  ausdrücklich "keine Queue, kein Remote-Status, auf den ein Merge wartet".
- #913 ist CLOSED·completed, der Queue-Code ist in Code + Doku faktisch rückgebaut
  ("aktuelle Code und Doku beschreiben inzwischen deren Rückbau").
- #913-Queue wiederzubeleben würde der dokumentierten Repo-Richtung widersprechen.
- Die P0-Abnahme "Queue verpflichtend" gilt damit als AUFGEHoben durch die
  neuere FREEZE-0-Richtung — nicht stillschweigend, sondern als hier dokumentierte
  Instanzentscheidung.

## CONCRETE GAPS (zu schliessen, in dieser Reihenfolge)

| # | Lücke | Fix | Owner |
|---|-------|-----|-------|
| 1 | Kein aktives Ruleset auf main (Rulesets=[]) | Ruleset anlegen: PR-erfordert, mind. 1 gültige Approval, frische Reviews, CODEOWNERS, Bypass-Regeln | maintainer |
| 2 | Identitäts-Widerspruch: vannon091118=admin UND als Worker; Alias vannon091118-maintainer=null | Entweder Alias echte Repo-Rechte geben ODER dokumentieren dass vannon091118 (Owner) der Merge-Principal ist (Alias ist kosmetisch) | governance-office (Audit) → maintainer (Fix) |
| 3 | promote-merge.mjs erlaubt Legacy-Merge bei fehlendem Task-Vertrag (nur Warnung) | Task-Vertrag fail-closed machen ODER Legacy-Pfad explizit als dokumentierte Ausnahme + Head-SHA-Prüfung beibehalten | jenova (Fix) |
| 4 | Required-Status-Checks OFF / CI empty auf main | FREEZE-0 = kein Cloud-Check dokumentieren als AKZEPTIERTES Risiko ODER minimalen Check (typecheck+lint) aktivieren | governance-office (Entscheidung) |

## VERBOTENE AUSSAGEN (solange Gaps 1-4 offen)
- "Alle aktiven Sessions haben zugestimmt."
- "Nur der erste PR darf gemergt werden."
- "Worker können nicht selbst mergen."
- "GitHub UI und API erzwingen denselben Merge-Vertrag."

## VERIFIZIERBARE ABNAHME (Exit-Kriterien für P0)
1. `GET /repos/.../rulesets` liefert mind. 1 aktives, auf main anwendbares Ruleset mit
   `pull_request` + `required_status_checks` + `non_fast_forward` + Bypass-Policy.
2. `actors.json` stimmt mit Live-Repo-Berechtigungen überein (kein admin-Worker-Double-Listing).
3. `promote-merge.mjs` liefert bei fehlendem Task-Vertrag KEINEN Merge (fail-closed)
   — Nachweis: 1 Negativ-Test.
4. Diese Datei + Exit-Belege (API-Response, PR-SHA) in board:sync dokumentiert.

## HANDLER / HANDOFF
- governance-office: Gap 2 + Gap 4 Audit (read-only), Ergebnis → Maintainer
- maintainer: Gap 1 + Gap 2-Fix (Ruleset + Identität), Exit-Beleg 1+2
- jenova: Gap 3 (promote-merge fail-closed), Exit-Beleg 3
- @hermes: Abnahme gegen Exit-Kriterien, dann P0 → DONE

stop.flag: nicht vorhanden → Loop aktiv. Kein Bypass.