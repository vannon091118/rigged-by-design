# Changelog

<!-- rbd-doc: v0.3.74 | 2026-11-02 22:21 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.74] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; umgebaut wird der Werkzeugkasten der Agenten.

### Technik
- `pnpm run agent:context` druckt eine feste Beschriftungsspalte mit einer Zeile je Feld (Aenderungen, Systeme, Tests, Gates, Doku, Invarianten, Offen) statt einer unstrukturierten Zeile.
- `pnpm run agent:verify` zeigt eine Gate-Tabelle mit Status und Dauer; `--plan` nennt Plan und Cache-Stand, ohne ein Gate zu starten. Beide bleiben die einzige Analyse- und Pruefstrecke.
- Das Tree-Gate verbietet Wegwerf-Dateien (`tmp-`, `temp-`, `scratch-`, `adhoc-`, `.tmp.`, `.bak`) und meldet sie als `ERR-4019`; die Regel steht in `AGENTS.md`.
- `agent:context --line` und `agent:verify --line` geben eine verdichtete Textzeile aus (Stand, Umfang, Gates). `agent:verify` druckt im Erfolgsfall keine Zeile je Gate mehr, sondern nur die Tabelle.
- Suchwerkzeug: ripgrep liegt global im PATH, `rtk rg`/`rtk ls`/`rtk find`/`rtk read`/`rtk git` sind der Standard; `pnpm run agent:context` ist der primaere Kontextzugang (AGENTS.md, RTK-Block).

## [0.3.73] - 2026-11-02

### Spiel

- Keine spielbaren Aenderungen; der Sprung dient der Release-Konsistenz von `main`.

### Technik
- Peer-Review Phase 6: Tick-Konstante zentral (`TICK_MS = 520`), `spinTest` ruft den Testspin nur einmal, das tote `movement-queue`-Modul ist entfernt, Texte korrigiert ("DER GEBER MISCHT", Mojibake), Asset-Zaehler aus den Daten, `opencode.json` mit relativem Pfad, `encode-audio` verlangt `RBD_AUDIO_SOURCE`.
- Version 0.3.73: `main` trug nach dem Merge von PR #44 weiter 0.3.72, waehrend der Tag `v0.3.72` auf `7b50913` (PR #40) stand und der Release-Lauf nach einem API-Merge als `skipped` endete. Der Patch-Sprung macht den Tip release-faehig, ohne den bestehenden Tag zu verschieben.

## [0.3.71] - 2026-11-01

### Spiel

- README eröffnet die Spielwelt als satirisches Onboarding und markiert Umfang sowie Mechaniken als heutigen Stand; das Startkapital ist auf 150 VC plus Gratis-Automat korrigiert.
- Das gelieferte Pixel-Art-Banner und drei neue SVG-Trenner führen durch Spielwelt, Werkstatt und Roadmap.

### Technik
- Der Tageslohn hängt an einer abgeschlossenen Schicht: `PlayerJobState.lastWorkDay` merkt sich den Tag der letzten Schicht, `payDailyWage` zahlt nur dafür und nie rückwirkend. Wer einen Job annimmt und nichts tut, bekommt weder Geld noch `workDays`-Zuwachs.
- Die Pity-Entladung addiert keinen zweiten Gewinn mehr: `settleSlotSpin` zahlt aus dem Polster, darf es überziehen und holt den Vorschuss aus späteren Gewinnen zurück.
- Wut kommt jetzt aus der Geduld, nicht aus der Laune: `decay` prüft `patience <= 0` vor dem Geduld-Tropfen; die Mods mit Geduldswirkung steuern damit wirklich, wer randaliert.
- Sucht steuert den Einsatz (bis +50 %) und die Sitzungslänge (4 bis 9 Spins): `addictedStake` und `sessionSpins`.
- `PLAYER_CASH` ist auszahlbar: `cashOutPlayerCash` bucht das Bonus-Guthaben ins Portemonnaie.
- Der tote `social`-Bedürfniszweig ist entfernt; `Persona.patience` bleibt, weil sie seit dem letzten Commit gelesen wird.
- Die Persona-Geduld wirkt jetzt: sie geht als Gewicht in den 180-Punkte-Pool von `rollProfile` ein (68 High Roller bis 138 Stammgast), die Summe aus Laune, Geduld und Sucht bleibt exakt 180. Vorher war `Persona.patience` ein totes Feld, und der Stammgast startete wegen seiner hohen Suchtrate sogar ungeduldiger als der High Roller.
- Der Synergie-Audit listet die verbleibenden Lücken in `docs/INVENTORY.md`: `PLAYER_CASH` ohne Ausgabepfad, VELVET und FREE_DRINK ohne ihre beschriebene Wirkung, EXTRA_REEL ohne zusätzliche Walze und ein Einsatz, der nie mit der Persona skaliert.
- Alte Saves ohne `lastWorkDay` laden weiter und starten mit „noch keine Schicht"; vergangene Tage werden nicht nachgezahlt.
- Der rote Pflichtstatus war der PR-getriggerte `CI Verify`-Lauf: er scheiterte am PR-Body-Gate, weil der PR-Body die Pflichtsektionen nicht trug; der Workflow bleibt unveraendert, der Body wird aus dem Commit-Body gehoben.
- Drei Mods sind als offene Design-Entscheidung dokumentiert statt still wirkungslos zu bleiben: `VELVET` (bessere Gaeste), `FREE_DRINK` (Drink pro Spin) und `EXTRA_REEL` (vierte Walze) stehen mit Versprechen, Ist-Zustand und der jeweils noetigen Regelentscheidung in `docs/INVENTORY.md`.

- Der Überfall misst die Wachdeckung jetzt an der Kasse statt am Spieler: `muggingCoverPoint` liefert den Wechseltisch, an dem das Geld liegt; vorher schützte ein Wachmann am Klo die Kasse.
- Die zweite Streitstufe ist erreichbar: `disputeLevelForTicks` kippt nach vier Ticks, vorher nach sechs — ANGRY dauert aber nur fünf, deshalb gab es nie Möbelschaden.
- `guestsServed` zählt nur noch Gäste mit mindestens einem Spin; wer den Floor durchquert, hob bisher Ruf und KASSE-Stufe.
- „JACKPOT!" erscheint erst ab 2,5x; ein Push von 1,0x hieß bisher Jackpot und traf rund jeden fünften Slot-Spin.
- Die Wut klingt nach dem Schlichten ab (`anger` sinkt um 0,5 pro Tick), statt bis zum Abgang das ANGRY-Emoji zu zeigen.
- HUD, Diagnose und Automaten-Popup lesen die Bar-Kapazität aus `barCapacityForLevel`; die UI rechnete 6 + 6 × Level, der Core 12 + 8 × Level.
- Dreck landet wieder auf der Kachel, auf der er entsteht: `dirtyTileIndex` in `emotion.ts` ist das Gegenstueck zu `dirtyNear`; Randale und Streit schrieben bisher `(y+1)*size+x+1` und damit schraeg versetzt daneben.
- Video Poker zahlt den Royal Flush nur noch in einer Farbe und erkennt das Wheel A-2-3-4-5 als Strasse; die interaktive Engine war schon richtig.
- Die Dreckschicht liegt im Szenen-Cache jetzt zwischen Teppich und Moebeln statt als erstes Kind des Moebel-Containers.
- Ein Ueberfall auf das Portemonnaie zaehlt im Wirtschaftsbericht als Verlust; `classify` stieg vorher beim Quellkonto aus, bevor der Ueberfallstopf erreicht war.
- Ein Fehlerregister statt dreier Quellen: `scripts/lib/error-codes.mjs` liest `error-codes.ts`, das Gate-Format prueft nicht mehr das Markdown. `ERR-1001` (Determinismus) ist nachgetragen und wird nicht mehr als `ERR-0000` verschluckt.
- Subsysteme, Ordnerregeln, Katalogsysteme und Impact-Doku stehen einmal in `scripts/lib/subsystems.mjs`; Tree-Gate, Testkatalog, betroffene Tests und `agent:context` lesen daraus.
- Die Eskalationsleiter kommt aus `src/Config/escalation-levels.json`; TypeScript und `scripts/lib/escalation.mjs` teilen sie, ein Test haelt beide deckungsgleich.
- `issues.ts` und `transfer.ts` buchen ihren Fehlercode ueber `ERROR_CODES.TRANSFER_INVALID` statt als Literal.

- README ergänzt aktuellen Screenshot- und Versionsvergleich, Developer-Setup, Architekturverträge, Prüfkommandos, Roadmap und FAQ.
- CI-Jobs installieren die festgelegte pnpm-Version, bevor der Package-Cache und die Lockfile-Installation laufen. Der Versionsbump lädt YAML statisch; das Tree-Gate erlaubt JPEG-Belege unter docs.
- pnpm-Overrides für `glob` und `minimatch` stehen im pnpm-spezifischen `pnpm.overrides`-Abschnitt; so werden die gepatchten Transitiven tatsächlich aufgelöst.

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
