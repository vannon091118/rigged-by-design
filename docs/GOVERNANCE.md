# Governance: Lanes, Claims und Eskalation

<!-- rbd-doc: v0.3.183 | 2026-11-08 00:50 UTC -->

**Zweck:** Die verbindlichen Regeln für parallele Arbeit. Der Kurzvertrag steht in `AGENTS.md`; dieses Dokument beschreibt Rollen, Claim-Prüfung und die eine Eskalationsleiter.

## Rollen und Lanes

- **Governance-Owner** führt Meta-, Workflow- und Register-Änderungen. Feature-Lanes dürfen Meta-Dateien nur über den mechanischen Pfad (Marker/Version) berühren.
- **Integrator**, **Core-Owner**, **UI-Owner**, **Narrative-Owner**, **Interaction-Owner** und **Ledger-/Core-Owner** sind feste Rollen aus `OWNERS` in `scripts/lib/lane-claims.mjs`; ein Claim ohne Roster-Owner wird abgelehnt.
- **Branch-Schema:** `lane/<domäne>/<task>`; Legacy-Präfixe `gov/`, `hygiene/` und `fix/` bleiben lesbar.
- **Worktree:** Jede Lane außer `main` braucht einen verknüpften Worktree. Der geteilte Arbeitsbaum ist kein Arbeitsplatz für Feature-Lanes.
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

Der Pre-Commit-Hook prüft gestagte Dateien; CI prüft den PR-Diff gegen die Basis. `pnpm run verify:claims` ist der lokale Lauf.

## Governance-Freeze

Die Steuerungsebene ist gesperrt, bis das Spiel steht: **Stadt und Core-Loop stehen, mindestens § Progression-Zweige sind vollständig**. Der Freeze schützt die Pfade aus `GOVERNANCE_PATHS` in `scripts/lib/governance-freeze.mjs` — `.github/`, `.githooks/`, `.lane-claims/`, `scripts/`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CI.md`, `docs/GOVERNANCE.md`, `docs/INDEX.md`, `docs/WORKFLOW.md`, `docs/capabilities.json` und `docs/contracts/`.

Frei bleiben `src/`, `content/`, `public/`, Tests und die Spielpfade: der Freeze schützt die Steuerung, nicht die Arbeit.

Mechanik:

- **Lokal:** `.githooks/pre-commit` ruft `scripts/verify-governance-freeze.mjs`; eine inhaltliche Governance-Änderung ohne Freigabe blockiert den Commit (`ERR-4030`).
- **CI:** der `Plan`-Job prüft denselben Diff gegen die Basis. Rot heißt `Fail-Closed Gates` rot.
- **Marker sind ausgenommen:** reine Doku-Marker und Versionszeilen zählen nicht, sonst würde jeder `docs:sync`-Lauf den Freeze auslösen.
- **Freigabe:** `node scripts/freeze-unlock.mjs --pin=<pin>` schreibt `.lane-claims/freeze-unlock.json` mit Basis, Pfadliste und Token; die Datei wird mitcommittet. Sie gilt für genau diese Basis und mindestens diese Pfade — zusätzlich genannte Pfade sind erlaubt, weil die Generatoren im Hook danach weitere Steuerdateien anfassen können; fehlt dagegen eine tatsächlich geänderte Datei, ist die Freigabe ungültig.
- **Verstoss:** fehlt die Freigabe ganz, entfernt die CI den Lane-Branch mit `Verdacht auf unautorisierte Korruption`. Ein Branch ohne Freigabe ist kein Merge-Kandidat.

Der PIN steht nicht im Klartext im Repo, sondern nur als scrypt-Commitment (`PIN_COMMITMENT`). Das ist eine Sperre gegen versehentliche und tooling-freie Änderungen, **kein kryptografisches Geheimnis**: ein vierstelliges Commitment ist offline prüfbar. Wer echte Geheimhaltung braucht, legt den PIN zusätzlich als Repository-Secret ab und vergibt die Freigabe nur dort.

Der Freeze wird nur auf ausdrückliche Anweisung des Owners gelöst — einmalig, über die PIN-Freigabe. Danach gilt er unverändert weiter; die Anweisung hebt keinen Meilenstein auf.

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

- Required Status Check: `Fail-Closed Gates`
- `strict: false`
- 0 erforderliche Reviews
- `enforce_admins: true`
- Force-Push und Löschen verboten
- keine Rulesets

Der Merge bleibt manuell: PR gegen `main`, grüner `CI Verify`-Lauf auf dem exakten Kopf, dann Merge. `promote` ist deaktiviert; `integration` ist kein Normalweg. Details und API-Nachweise stehen in [`CI.md`](CI.md#branch-schutz).

## Referenzen

- [`WORKFLOW.md`](WORKFLOW.md) — Pretask, Claim-Nutzung und Abschluss.
- [`CI.md`](CI.md) — Required-Gates, Zustände und Branch-Schutz.
- [`TESTING.md`](TESTING.md) — Testlinie und Governance-Testmatrix.
- [`INDEX.md`](INDEX.md) — Doku- und Vertragslandkarte.
