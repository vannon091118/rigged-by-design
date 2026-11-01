# Changelog

<!-- rbd-doc: v0.3.70 | 2026-11-01 22:58 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.70] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: nur die Pruefkette und ihr Cache.

### Technik
- Paketmanager von npm auf pnpm umgestellt (`packageManager: "pnpm@10.4.1"`); `package-lock.json` entfernt, `pnpm-lock.yaml` trackt die Dependencies. Alle Skripte, GitHub Actions, Pre-Commit-Hook und Pflichtdokumente nutzen `pnpm` statt `npm`; `npm ci` wurde durch `pnpm install --frozen-lockfile` ersetzt.
- `agent:verify` laesst das Testgate nie mehr aus, nur weil der Diff keinen Testbezug hat; ohne Auswahl laeuft die Suite, der Bericht nennt den Grund.
- `turn:finish` setzt die Doku-Marker vor `verify`. Der Pre-Commit-Hook schrieb sie danach und entwertete damit jeden Cache-Schluessel des gerade geprueften Baums; derselbe Baum trifft jetzt beim zweiten Lauf (`0s`, `[cached]` je Gate).

## [0.3.69] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: Prozess und Nachweise werden zusammengefuehrt.

### Technik
- Neu: `pnpm run agent:context` (ein Aufruf fuer Aenderungen, Systeme, Invarianten, betroffene Tests, Gates und Cache-Stand) und `pnpm run agent:verify` (derselbe Impact-Plan, Gates ueber `runGates`, ein Bericht mit `cached`, `executed`, `skipped` und `delegated`). Beide nutzen `scripts/lib/impact.mjs`, das nur vorhandene Quellen zusammenfuehrt: `changedFiles`, Importgraph, Testkatalog, `pipeline-plan`, `gate-cache`.
- Doppelte Testausfuehrung entfernt: `turn:finish -- --affected` startete `test:affected` und danach `verify:quick`, dessen Testgate die Suite erneut fuhr. Jetzt liefert `--affected` den Kontext; der Testlauf bleibt einmalig in der Pipeline.
- Delegation ist keine Ausgabe mehr: `test:affected` legt lange Nachweise in `.verify-cache/delegated.json` ab und nennt sie offen; `agent:verify --ci` startet `ci:long`, wartet auf den Lauf und uebernimmt das Ergebnis.
- Pre-Commit blockiert, wenn Dependency-Matrix oder Testkatalog nicht geschrieben werden konnten; ein verschluckter Generatorfehler hinterliess bisher ein stilles veraltetes Artefakt.
- Teilpruefung bleibt Teilpruefung: laufen bei `agent:verify` nur betroffene Tests, steht `partial: true` im Bericht und das Testgate wird nicht gecacht.

## [0.3.68] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Konfiguration liegt nur noch an einer Stelle.

### Technik
- `src/Config/capacitor.config.json` ist wieder versioniert: die Ignore-Regel griff ungeankert und schloss die Quelle mit ein. `.gitignore` ignoriert nur noch die Laufzeit-Kopie in der Wurzel (`/capacitor.config.json`); `prepare-android` legt sie dort an und raeumt sie ab.

## [0.3.67] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird belastbar, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Merge ohne stille Kette: `promote` nutzt `PROMOTE_TOKEN`, wenn gesetzt; sonst stoesst es nach dem Merge `Auto Version & Release` an, weil ein Merge mit `GITHUB_TOKEN` keinen Workflow startet und Tag und APK sonst ausfallen. Der Release prueft den Commit-Text vor dem Tag selbst.
- `integration` ist geschuetzt: `pr-cleanup.yml` und `branch-prune.mjs` loeschen die permanente Branch nicht mehr nach dem Rueckweg nach `main`.
- Urteil statt Rauschen: nur `failure`, `timed_out` und `startup_failure` gelten als rot; ein `cancelled`-Lauf schiebt keinen Zwischenstand auf `integration`. Nur Push-Laeufe promoten, der `pull_request`-Lauf des Merge-Refs ist kein Urteil.
- Kein Merge-Deadlock: `gh pr update-branch` laeuft vor dem Merge, weil der Pflichtstatus unter `strict_required_status_checks_policy` sonst veraltet; der Integrationspfad schleift statt zu rekursieren.
- Loch im PR-Gate geschlossen: ein leerer PR-Body bestand `verify-commit-msg --pr` ohne Fehlschlag; jetzt ist er `ERR-4006`.
- Seedabhaengiger Test korrigiert: `narrative-start-pool` prueft jetzt das neue Profil (eine Visite, kein `START_POOL`-Fact) statt eines Namens. `Rita Kern` ist eine moegliche Zufallskombination aus `src/core/sim/traits.ts` (rund 0,8 % pro Ziehung) und liess den Lauf gelegentlich kippen.
- Werkzeug-Configs liegen gesammelt in `src/Config/`: `tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `capacitor.config.json` und `opencode.json` gibt es nur noch dort. Alle Aufrufer zeigen auf den neuen Pfad (`vite`/`vitest` per `--config`, `tsc -p`, `eslint --config`, `hashFiles` im Gate-Cache, Dependency-Matrix, Dead-Code, Tree-Gate); Capacitor bekommt waehrend des APK-Laufs eine Kopie in die Wurzel, die danach wieder verschwindet. `.mailmap` bleibt in der Wurzel, weil Git sie nur dort liest.

## [0.3.66] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: die Auslieferung wird automatisiert, Spiel, Save und Ledger bleiben unberuehrt.

### Technik
- Neu: `scripts/promote.mjs` und `.github/workflows/promote.yml`. Ein CI-Ergebnis entscheidet: gruen legt den PR an und mergt ihn mit den Pflichtsektionen, rot legt den Stand auf die permanente Branch `integration`, damit dort repariert wird.
- Zwei parallele rote Staende werden komponiert statt verworfen. Die Wahrheit liegt im Branch und im Label `integration/rot`, nicht in der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden Lauf, deshalb arbeitet jeder Lauf den gesamten Rueckstand ab und ist idempotent. Ein Textkonflikt wird mit `integration/konflikt` gelabelt und bleibt beim Agenten; nichts wird erzwungen oder ueberschrieben.
- Eine Identitaet fuer jeden Commit: `scripts/lib/identity.mjs` verdrahtet `Vannon <Schneider.felix1993@gmail.com>` in `turn:finish` und im Promote-Workflow, damit der Committer nicht davon abhaengt, welcher Runner oder welche Sandbox gerade committet. `.mailmap` fuehrt die Werkzeug-Namen der History auf denselben Eigentuemer.
- Merge mit Verified-Badge ist opt-in (`RBD_PROMOTE_AUTO_MERGE=1`): dann mergt GitHub selbst und signiert, kann aber den Commit-Text nicht setzen. Ohne Opt-in mergt der Lauf explizit mit Subject und Body, damit `verify-commit-msg --head` auf `main` gruen bleibt.
- Artefakt-Gate-Test entkoppelt: `gate-runner.test.ts` prueft Logs und Summary mit 60 s Limit statt 10 s. Unter paralleler Gate-Last braucht der Node-Start allein mehrere Sekunden, das Zeitlimit hat die Artefakt-Pruefung verfaelscht (TIMEOUT statt FAIL); die Zusicherungen selbst sind unveraendert.

## [0.3.65] - 2026-11-01

### Spiel

- Keine sichtbare Aenderung: reine Doku-, Ordnungs- und Hygiene-Arbeit. Spielverhalten, Save-Format und Ledger bleiben unberuehrt.

### Technik
- Doku konsolidiert und sortiert: 16 Doku-Dateien liegen flach unter `docs/` und tragen Grossbuchstaben-Namen. `docs/event-narrative-engine-taskplan.md` heisst jetzt `docs/EVENT-NARRATIVE-ENGINE-TASKPLAN.md`, `docs/assets/casino-pixel-asset-pack.md` jetzt `docs/CASINO-PIXEL-ASSET-PACK.md`; der Ordner `docs/assets/` entfaellt.
- Widersprueche beseitigt: ARCHITECTURE, PRODUCT, AGENTS und Inventar nennen dieselbe Gate-Zaehlung (quick 10, full 12 inklusive `assets`, `audit`, `build`) in der echten Reihenfolge; der Save ist ueberall v9 (`vcoin.casino.v9`, Migration v5–v8); die Narrative Engine gilt als Stufe 1 gebaut statt "nicht gebaut"; der Inventar-Kopf steht auf `main`/`c4e6e3b`.
- `docs/ERROR_CATALOG.md` repariert und sortiert: ERR-4013/ERR-4014 waren in einer Tabellenzeile verschmolzen, ERR-5001 stand vor ERR-4019; die Codes laufen jetzt aufsteigend bis ERR-5001.
- Repo-Hygiene: Hooks aktiviert (`core.hooksPath=.githooks`), Wurzel traegt nur `README.md` und `AGENTS.md` als Markdown, `docs/screenshots/README.md` beschreibt wieder den echten Bestand (25 Belege, Save v9).
- Doku-Gate (`ERR-4017`) praezisiert: Dotfiles in der Wurzel sind Arbeitsdateien. `.turn-notes.md` machte `verify:quick` und damit `turn:finish` rot, obwohl das Werkzeug die Datei selbst anlegt; der Scan ueberspringt sie jetzt.

## [0.3.64] - 2026-11-01

### Spiel

- Neue Spiele beginnen mit einem Start-Pool aus drei bekannten Figuren (Rita Kern, Boris Falk, Mira Sol). Stammgaeste erinnern sich an ihre letzten Besuche: ein guter Besuch bringt sie mit besserer Laune und hoeherer Rueckkehrchance zurueck, ein schlechter senkt beides.

### Technik
- Narrative Engine, Stufe 1 (NAR-00 bis NAR-03): Architekturvertrag `docs/NARRATIVE-ENGINE.md`, persistente Narrative-Domaene mit Fact-Queue und idempotenter Verarbeitung, typisierte Facts (Start-Pool, erster Besuch, Rueckkehr, Besuchsende), strukturierte Erinnerungen am Visitor und Save v9 mit Migration aus v5–v8.
- Facts sind vom Journal getrennt; Erinnerungswirkung ist rein deterministisch aus dem Save berechnet (kein PRNG, keine Uhr).
- Import und Export im Pruefungs-Popup: Spielstand als JSON sichern, vor dem Import pruefen und reparierbare Felder automatisch ergaenzen. Blocker verhindern den Import und nennen die Eskalationsstufe.
- `performance.now` ist auf die drei echten Pacing-Dateien verengt (`src/render/floor-view.ts`, `src/render/floor-props.ts`, `src/render/music.ts`); jede vierte Datei unter `src/render/**` ist gesperrt. `Date()` ohne `new` und `performance.timeOrigin` sind jetzt ebenfalls verboten, in `src/render/**` bleiben `Math.random`, `Date.now`, `new Date()` und Krypto rot.
- Determinismus-Sperre fail-closed: Namespace- und `new`-Umwege, Krypto (`getRandomValues`, `randomUUID`), `scripts/**` inklusive Content-Compiler und `eslint-disable` sind technisch blockiert; `src/render/**` darf nur `performance.now` fuer Pacing lesen.
- Event-Engine-Taskplan adversarial gehaertet: 20 Angriffe mit Gegenmassnahmen, Systemmatrix ueber 20 Systeme, korrigierte Reihenfolge (NAR-13 vor NAR-12) und Definition of Done je Task — kein Task gestrichen.
- Determinismus als Regel: `entropySeed()` ist der einzige Entropie-Eingang, der Export stempelt aus der Welt statt aus der Uhr, und ESLint verbietet `Math.random`, `Date.now`, `performance.now` sowie `new Date()` in `src/**` (Ausnahme: Pacing in `src/render/**`).
- Tree-Gate (`ERR-4019`) und Redundanz-Gate (`ERR-4020`) sind Pipeline-Gates; `docs:stub` (`ERR-4021`) legt Pflichteintraege mit Datum und Uhrzeit an.
- `src/index.css` liegt jetzt unter `src/styles/`; `ci-verify` prueft den Commit-Body nur noch auf `main`, Feature-Branches uebernimmt `pr-escalation` (keine Doppelarbeit).

- Globale Eskalations-Leiter `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED` in `scripts/lib/escalation.mjs`; `pnpm run escalation:plan` nennt die Stufe zu einem Befund.
- Doc-Gate `verify:docs` mit Pflichtabschnitten, Marker und flachem Wurzelbaum; Pflege im Pre-Commit-Hook, nicht im Gate.
- Commit-Body blockiert nicht mehr: `.githooks/commit-msg` eskaliert, `pr-escalation.yml` hebt den Body in den PR-Body.
- Dependency-Matrix und Testkatalog sind keine Pipeline-Gates mehr; Matrix, Katalog und Doku-Marker schreibt der Pre-Commit-Hook.
- Neue Fehlercodes `ERR-4017` (Doku), `ERR-4018` (Hooks), `ERR-5001` (Import).
- Connector-Eskalation: `node scripts/lift-commit-body.mjs --json` liefert Branch, Basis, Titel, Body-Datei und Body als Plan; Agenten mit GitHub-Connector legen den PR ohne `gh` an. Der Level kommt aus der einen Leiter (`AGENT`).
- Pipeline-Test auf den neuen Gate-Plan gezogen: `docs` ersetzt `deps-matrix`/`catalog`, der Lesende-Vertrag bleibt geprueft.
- Import-Engine modular unter `src/core/io/` (Umschlag, Pruefung, Reparatur) mit `src/store/transfer.ts` als Anbindung.
- `pnpm run inventory:build` schreibt Abschnitt 18 des Inventars: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft.
- `verify:docs` erzwingt die Inventar-Abdeckung mit: fehlende Datei, fehlender Ordner oder falsche Abdeckungszahl machen das Gate rot (`ERR-4017`). Der Pre-Commit-Hook baut die Liste vor dem Marker.
- Inventar-Generator idempotent: der Selbsteintrag von `docs/INVENTORY.md` nennt keine eigene Zeilenzahl mehr; nach einem Rot-Test stellt `inventory:build` den Block byte-identisch wieder her.
- `main` in den Inventar-Branch gemergt: Runtime-Art-Preload und die neuen Renderer-Dateien bleiben erhalten, `./styles/index.css` bleibt der einzige CSS-Einstieg; die Dependency-Matrix erzeugt der Hook neu.
- RNG-Namespaces: `Prng` traegt `gameplay` oder `presentation`; Partikel und Sound nutzen den eigenen Darstellungs-Strom in `src/render/rng.ts`. `tickWorld` und `playRound` weisen fremde Stroeme mit `assertGameplayRng` ab (`ERR-1003` im Test).
