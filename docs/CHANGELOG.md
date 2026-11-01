# Changelog

<!-- rbd-doc: v0.3.65 | 2026-11-01 20:15 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

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

- Globale Eskalations-Leiter `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED` in `scripts/lib/escalation.mjs`; `npm run escalation:plan` nennt die Stufe zu einem Befund.
- Doc-Gate `verify:docs` mit Pflichtabschnitten, Marker und flachem Wurzelbaum; Pflege im Pre-Commit-Hook, nicht im Gate.
- Commit-Body blockiert nicht mehr: `.githooks/commit-msg` eskaliert, `pr-escalation.yml` hebt den Body in den PR-Body.
- Dependency-Matrix und Testkatalog sind keine Pipeline-Gates mehr; Matrix, Katalog und Doku-Marker schreibt der Pre-Commit-Hook.
- Neue Fehlercodes `ERR-4017` (Doku), `ERR-4018` (Hooks), `ERR-5001` (Import).
- Connector-Eskalation: `node scripts/lift-commit-body.mjs --json` liefert Branch, Basis, Titel, Body-Datei und Body als Plan; Agenten mit GitHub-Connector legen den PR ohne `gh` an. Der Level kommt aus der einen Leiter (`AGENT`).
- Pipeline-Test auf den neuen Gate-Plan gezogen: `docs` ersetzt `deps-matrix`/`catalog`, der Lesende-Vertrag bleibt geprueft.
- Import-Engine modular unter `src/core/io/` (Umschlag, Pruefung, Reparatur) mit `src/store/transfer.ts` als Anbindung.
- `npm run inventory:build` schreibt Abschnitt 18 des Inventars: eine Zeile je Pfad aus `git ls-files`, ein Eintrag je Ordner, Text gelesen, Binärsignaturen geprüft.
- `verify:docs` erzwingt die Inventar-Abdeckung mit: fehlende Datei, fehlender Ordner oder falsche Abdeckungszahl machen das Gate rot (`ERR-4017`). Der Pre-Commit-Hook baut die Liste vor dem Marker.
- Inventar-Generator idempotent: der Selbsteintrag von `docs/INVENTORY.md` nennt keine eigene Zeilenzahl mehr; nach einem Rot-Test stellt `inventory:build` den Block byte-identisch wieder her.
- `main` in den Inventar-Branch gemergt: Runtime-Art-Preload und die neuen Renderer-Dateien bleiben erhalten, `./styles/index.css` bleibt der einzige CSS-Einstieg; die Dependency-Matrix erzeugt der Hook neu.
- RNG-Namespaces: `Prng` traegt `gameplay` oder `presentation`; Partikel und Sound nutzen den eigenen Darstellungs-Strom in `src/render/rng.ts`. `tickWorld` und `playRound` weisen fremde Stroeme mit `assertGameplayRng` ab (`ERR-1003` im Test).
