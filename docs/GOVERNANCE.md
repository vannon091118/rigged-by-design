# Governance: Lanes, Claims und Eskalation

<!-- rbd-doc: managed -->

**Zweck:** Die verbindlichen Regeln für parallele Arbeit. Der Kurzvertrag steht in `AGENTS.md`; dieses Dokument beschreibt Rollen, Claim-Prüfung und die eine Eskalationsleiter.

## Rollen und Lanes

- **Governance-Owner** führt Meta-, Workflow- und Register-Änderungen. Feature-Lanes dürfen Meta-Dateien nur über den mechanischen Pfad (Marker/Version) berühren.
- **Integrator**, **Core-Owner**, **UI-Owner**, **Narrative-Owner**, **Interaction-Owner** und **Ledger-/Core-Owner** sind feste Rollen aus `OWNERS` in `scripts/lib/lane-claims.mjs`; ein Claim ohne Roster-Owner wird abgelehnt.
- **Branch-Schema:** `lane/<domäne>/<task>`; Legacy-Präfixe `gov/`, `hygiene/` und `fix/` bleiben lesbar.
- **Worktree:** Ein verknüpfter Worktree ist optional; `--require-worktree` fordert ihn explizit. Der geteilte Cloud-Clone ist der Normalfall. Jede Branch außer `main` ist temporär und wird nach belegtem Merge entfernt.
- **Meta-Dateien:** `AGENTS.md`, `package.json`, `pnpm-lock.yaml`, `docs/INVENTORY.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/DEVTAGEBUCH.md`, `docs/ROADMAP.md`. Inhaltliche Änderungen brauchen eine Governance- oder ausdrücklich berechtigte Lane.
- **Kontrollebene:** `.github/`, `scripts/` und `src/Config/` bleiben Governance- oder CI-Lanes vorbehalten; Feature-Claims können sie nicht öffnen.

## Claims

Ein Claim ist der Vertrag einer Lane, kein Token pro Pull Request. Er liegt unter `.lane-claims/claims/` und wird im Register `.lane-claims/claims.json` geführt.

Pflichtfelder:

- `id`, `branch`, `owner`, `task`,
- `baseSha` (Startpunkt, **kein** Merge-Beleg),
- `pathAllowlist`,
- optionale `contracts` mit Modus `write`/`read`,
- `dependencies`, `gateProfile`, `status`.

Regeln:

1. **Genau ein Writer pro Contract-ID.** Read-only-Konsumenten dürfen parallel laufen.
2. **Pfad-Überschneidungen blockieren.** Zwei Lanes mit demselben Pfad oder derselben Contract-Writer-Rolle kollidieren; Register, Meta- und mechanische Pfade sind von der Kollision ausgenommen.
3. **Keine Selbsterweiterung.** `verify-lane-claims --ci` vergleicht mit der Basis und der ersten Registrierung: neue Pfade, Owner, Branches oder zusätzliche Writer werden abgelehnt; eine Verengung ist erlaubt.
4. **Fremde Claims sind tabu.** Eine Feature-Lane ändert fremde Claims nicht. Nur die Governance-Lane darf den Status fortschreiben, und auch sie nur im Status, nicht in Pfaden oder Ownern.
5. **Gemergte Lane bleibt ansprechbar.** `selectClaim()` führt einen `merged` Claim weiter, damit der Register-Nachtrag nach dem Merge keinen neuen Claim eröffnet. `claim-evidence.mjs` akzeptiert einen gemergten PR, einen Branch-Kopf auf `main` oder einen baumgleichen Commit auf `main`; `baseSha` reicht nicht.
6. **Fail-closed.** Ohne Claim, ohne Owner oder bei einer unklaren Kollision wird nicht committet.
7. **Retention.** Lane-Claims und Task-Verträge werden auf die letzten **zehn Tasks** begrenzt. Aktive Tasks, offene oder geparkte Claims und die gerade bearbeitete Lane bleiben immer erhalten; geschlossene Claims ohne zugehörigen Task fallen mit der Retention weg. Das Legacy-Register `.lane-claims/claims.json` wird nicht beschnitten. `reconcile-claims --apply` führt die Retention mit aus, `claim:register prune` ist der manuelle Weg.
8. **Post-Merge.** Ein belegter Merge zieht den Claim auf `merged` und den Task von `CI_PENDING`, `MERGE_PENDING` oder `AFTERCARE` auf `DONE` — ohne offenen Blocker. Der Workflow `PR Cleanup` startet dafür nach jedem Merge einen eigenen Closeout-PR; der Closeout-Task trägt `closeout: post-merge` und darf nur über diesen ausdrücklichen Pfad als `DONE` durch Mensch oder Agent gemergt werden. Ein Direktpush auf `main` bleibt ausgeschlossen.

Der Pre-Commit-Hook prüft gestagte Dateien; CI prüft den PR-Diff gegen die Basis. `pnpm run verify:claims` ist der lokale Lauf.

`reconcile-claims --apply` schreibt nur Claims, deren Status oder Beleg sich geändert hat. Unbeteiligte Claim-Dateien und ein unverändertes Legacy-Register behalten ihren Dateistand.

## Eskalation

Eine Leiter, eine Klassifikation:

| Stufe | Bedeutung | Wer handelt |
| --- | --- | --- |
| `AUTO_FIX` | Doku-Marker, Format, Matrix, Katalog, Inventur | `pnpm run fix` oder Hook |
| `LOCAL_GATE` | außerhalb des Scopes | niemand |
| `REMOTE_CI` | Netz, Registry, Runner, Timeout | CI erneut starten; kein `BLOCKED` |
| `AGENT` | Struktur, Sektion, Test, Randfall | Agent; Issue |
| `BLOCKED` | Boot, Ledger-/Save-/RNG-Invariante, Geldpfad, kaputter Build | Mensch; fail-closed |

Nur `BLOCKED` hält die Arbeit an. Ein roter Test ist `ERR-4026` (`AGENT`) und wird ein Issue; Balance, ein schiefer Test oder ein Doku-Marker sind kein Notfall. `ERR-4014`/`ERR-4016` sind `REMOTE_CI` und werden wiederholt.

Issue-Scopes:

- `scope:main` blockiert global.
- `scope:lane/<domäne>` blockiert die eigene Lane und ihre Dependents.
- `scope:dependency/<lane>` blockiert nur abhängige Lanes.
- `remote-ci` blockiert nie; der Lauf wird wiederholt.
- Ein geschlossenes Issue wird bei erneutem Fingerprint wieder geöffnet; der Sweep schließt nur mit Original-Fingerprint, `<!-- repair: <sha> -->` und exakt grünem `main`.

`pnpm run escalation:plan` liest den letzten Gate-Befund und nennt die Stufe. Es gibt keine zweite Leiter und keine Ausnahme für Geld-, Ledger- oder Save-Regeln.

## Branch-Schutz

`main` nutzt einen klassischen Branch-Schutz, **kein** Ruleset:

- Required Status Checks: **keine**; keinen Cloud-Testlauf, der lokale Vor-PR-Nachweis ist die Autorität
- `strict: false`
- 0 erforderliche Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Eine Stimme pro SHA: ein Lane-Push startet nur `ensure-pr.yml`; der PR-Lauf ist optional. Der lokale Vor-PR-Nachweis entscheidet; der Merge erfolgt durch Mensch oder Agent nach Review und auf dem exakten Kopf. `promote` ist nur ein manueller Status-/Notausgang, kein Merge-Akteur. `integration` ist ein ausdrücklicher Notausgang. Details und API-Nachweise stehen in [`CI.md`](CI.md#branch-schutz).

## Referenzen

- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Claim-Nutzung und Abschluss.
- [`CI.md`](CI.md) — Required-Gates, Zustände und Branch-Schutz.
- [`TESTING.md`](TESTING.md) — Testlinie und Governance-Testmatrix.
- [`INDEX.md`](INDEX.md) — Doku- und Vertragslandkarte.
