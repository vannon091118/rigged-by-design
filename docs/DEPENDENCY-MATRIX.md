# Dependency-Matrix

Die Matrix wird von `scripts/sync-dependency-matrix.mjs` aus `package.json` und den echten Imports erzeugt. Sie belegt Nutzung, nicht Notwendigkeit; die Begruendungen stehen in [`ARCHITECTURE.md`](ARCHITECTURE.md).
<!-- DEP_MATRIX_START -->
| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |
| --- | --- | --- | --- | --- |
| @capacitor/android | ^8.6.0 | Android | Native Android-Plattform, aus der Gradle Debug- und Release-APK baut. | 1: `scripts/prepare-android.mjs` |
| @capacitor/cli | ^8.6.0 | Android | Capacitor-CLI: erzeugt das Android-Projekt und synchronisiert Web-Build und Huelle. | 1: `scripts/prepare-android.mjs` |
| @capacitor/core | ^8.6.0 | Android | WebView-Bridge der Android-Huelle; von cap sync an die native Seite uebergeben. | 1: `scripts/prepare-android.mjs` |
| @eslint/js | ^10.0.1 | Lint | Empfohlene ESLint-Basisregeln. | 1: `src/Config/eslint.config.mjs` |
| @testing-library/react | ^16.3.3 | Test | Rendert HUD und Popups fuer Integrations- und Fokustests in jsdom. | 24: `src/ui/__tests__/action-queue-panel.test.tsx`<br>`src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/city-popup.test.tsx`<br>`src/ui/__tests__/dialogue-ui.test.tsx`<br>`src/ui/__tests__/guest-profile.test.tsx`<br>`src/ui/__tests__/input-parity.test.tsx`<br>… (+18) |
| @types/node | ^22.20.5 | Typen | Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter. | 139: `scripts/agent-cause.mjs`<br>`scripts/agent-context.mjs`<br>`scripts/agent-new.mjs`<br>`scripts/agent-verify.mjs`<br>`scripts/auto-resolve.mjs`<br>`scripts/autofix-0911.mjs`<br>… (+133) |
| @types/react | ^19.0.7 | Typen | Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt. | 58: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+52) |
| @types/react-dom | ^19.0.3 | Typen | Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt. | 3: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx`<br>`src/ui/__tests__/hud-money.test.tsx` |
| @vitejs/plugin-react | ^6.1.2 | Build | React-19-JSX-Transform und Fast Refresh fuer Vite. | 1: `src/Config/vite.config.ts` |
| eslint | ^10.14.0 | Lint | Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen. | 3: `package.json`<br>`src/Config/__tests__/eslint-determinism.test.ts`<br>`src/Config/eslint.config.mjs` |
| ffmpeg-static | ^5.3.0 | Assets | Kodiert die WAV-Musikmaster zu Opus fuer die Auslieferung; reines Build-Werkzeug, nicht im Bundle. | 2: `scripts/encode-audio.mjs`<br>`scripts/lib/atlas-webp.mjs` |
| globals | ^16.5.0 | Lint | Browser- und Node-Globals fuer die ESLint-Konfiguration. | 1: `src/Config/eslint.config.mjs` |
| jsdom | ^30.1.3 | Test | DOM-Umgebung fuer UI-, Fokus- und Tastaturtests ohne echten Browser. | 31: `package.json`<br>`scripts/sync-dependency-matrix.mjs`<br>`src/render/games/slot-stage.tsx`<br>`src/ui/__tests__/action-queue-panel.test.tsx`<br>`src/ui/__tests__/card-tables.test.tsx`<br>`src/ui/__tests__/city-popup.test.tsx`<br>… (+25) |
| pixi.js | ^8.6.6 | Runtime | WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld. | 76: `src/render/__tests__/ambient-late-texture.test.ts`<br>`src/render/__tests__/city-shadow-late-texture.test.ts`<br>`src/render/__tests__/depth.test.ts`<br>`src/render/__tests__/floor-anchor.test.ts`<br>`src/render/__tests__/floor-input.test.ts`<br>`src/render/__tests__/guest-sprite.test.ts`<br>… (+70) |
| react | ^19.0.0 | UI | Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot. | 58: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/render/games/blackjack-stage.tsx`<br>`src/render/games/dice-stage.tsx`<br>`src/render/games/plinko-stage.tsx`<br>… (+52) |
| react-dom | ^19.0.0 | UI | Mountet die React-Oberflaeche in den Browser. | 3: `src/main.tsx`<br>`src/ui/__tests__/casino-window-header.test.tsx`<br>`src/ui/__tests__/hud-money.test.tsx` |
| typescript | ^6.0.3 | Build | Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen. | 2: `scripts/lib/ts-ast.mjs`<br>`src/Config/tsconfig.json` |
| typescript-eslint | ^8.72.1 | Lint | TypeScript-Parser und Regeln fuer das Lint-Gate. | 1: `src/Config/eslint.config.mjs` |
| vite | ^8.3.5 | Build | Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline. | 1: `package.json` |
| vitest | ^5.0.5 | Test | Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation. | 404: `package.json`<br>`src/Config/__tests__/eslint-determinism.test.ts`<br>`src/Config/vite.config.ts`<br>`src/core/contracts/__tests__/actionset.test.ts`<br>`src/core/contracts/__tests__/actor-id.test.ts`<br>`src/core/contracts/__tests__/domain-event.test.ts`<br>… (+398) |
| yaml | ^2.9.1 | Test | Parst die GitHub-Workflows fuer strukturelle Gate-Tests statt Regex und Stringpositionen. | 4: `scripts/version-bump.mjs`<br>`src/core/governance/__tests__/ci-workflow-contracts.test.ts`<br>`src/core/governance/__tests__/promotion-workflows.test.ts`<br>`src/core/governance/__tests__/workflow-hardening.test.ts` |
<!-- DEP_MATRIX_END -->
