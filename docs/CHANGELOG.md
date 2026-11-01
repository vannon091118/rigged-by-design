# Changelog

<!-- rbd-doc: v0.3.64 | 2026-11-01 11:34 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.64] - 2026-11-01

### Spiel

- Import und Export im Pruefungs-Popup: Spielstand als JSON sichern, vor dem Import pruefen und reparierbare Felder automatisch ergaenzen. Blocker verhindern den Import und nennen die Eskalationsstufe.

### Technik
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
