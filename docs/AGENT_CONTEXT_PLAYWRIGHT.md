# Playwright E2E — Agenten-transparente, modulare, zustandsbasierte Test-Strategie

**Ziel:** Eine große E2E-Suite so aufbauen, dass ein KI-Agent auf einen Blick erkennt:
* Was wird getestet? (Ziel / Zielzustand)
* Wie wird getestet? (Fixtures, Page Objects, Mocks)
* Wo sind Lücken? (fehlende Edge Cases, nicht abgedeckte Pfade)

Die Empfehlungen stützen sich auf die offizielle Playwright-Dokumentation (Fixtures, POM, Mock APIs, Trace Viewer, Reporter, Videos, Best Practices) und sind auf TypeScript ausgelegt.

---

## 1. Playwright Test-Struktur: Page Objects, Fixtures, Groups/Describe, Modularität

### 1.1 Grundprinzip: Fixtures statt `beforeEach`-Schleifen

Playwright Test basiert auf **Fixtures**. Sie kapseln Setup und Teardown an einem Ort, sind wiederverwendbar, lazy (on-demand), komposibel und ersetzen `describe`-Blöcke, die nur der Umgebung dienen.

```ts
// fixtures/game.ts
import { test as base } from '@playwright/test';
import { GamePage } from './pages/game.page';
import { LedgerPage } from './pages/ledger.page';

type GameFixtures = {
  gamePage: GamePage;
  ledgerPage: LedgerPage;
};

export const test = base.extend<GameFixtures>({
  gamePage: async ({ page }, use) => {
    const pageObj = new GamePage(page);
    await pageObj.goto();               // Setup
    await use(pageObj);                 // Test erhält das Objekt
    await pageObj.reset();              // Teardown (isoliert pro Test)
  },
  ledgerPage: async ({ page }, use) => {
    await use(new LedgerPage(page));
  },
});

export { expect } from '@playwright/test';
```

```ts
// tests/game.spec.ts
import { test, expect } from './fixtures/game';

test('Spieler platziert Einsatz und sieht Ledger-Eintrag', async ({ gamePage, ledgerPage }) => {
  await gamePage.placeBet(100);
  await expect(ledgerPage.lastEntry()).toContainText('Einsatz 100');
});
```

### 1.2 Page Object Model (POM)

Ein Page Object kapselt Selektoren und Aktionen einer UI-Komponente. Tests arbeiten nur mit der höheren API, nicht mit rohen Selektoren.

```ts
// pages/game.page.ts
import { expect, type Locator, type Page } from '@playwright/test';

export class GamePage {
  readonly page: Page;
  readonly betInput: Locator;
  readonly placeBetButton: Locator;
  readonly balance: Locator;

  constructor(page: Page) {
    this.page = page;
    // User-facing, stabile Attribute (Role/Text/TestID) statt CSS-Klassen
    this.betInput = page.getByLabel('Einsatz');
    this.placeBetButton = page.getByRole('button', { name: 'Einsatz platzieren' });
    this.balance = page.getByTestId('balance');
  }

  async goto() {
    await this.page.goto('/game');
  }

  async placeBet(amount: number) {
    await this.betInput.fill(String(amount));
    await this.placeBetButton.click();
  }

  async reset() {
    await this.page.evaluate(() => localStorage.clear());
  }
}
```

**Regeln:**
* Selektoren über `getByRole`, `getByLabel`, `getByTestId` (user-facing, resilient).
* Keine rohen CSS/XPath-Selektoren in Tests — nur innerhalb der Page Objects.
* Page Objects halten **keinen** Test-Zustand; sie sind reine UI-Helfer.

### 1.3 Test-Gruppen mit `test.describe`

`describe` dient der logischen Gliederung und dem Scoping von Hooks, nicht dem Setup von Umgebungen (das erledigen Fixtures).

```ts
test.describe('Einsatz-Flow', () => {
  test('gültiger Einsatz wird angenommen', async ({ gamePage }) => { /* ... */ });

  test.describe('Edge Cases', () => {
    test('Einsatz 0 wird abgelehnt', async ({ gamePage }) => { /* ... */ });
  });
});
```

### 1.4 Modularität für große Suiten

Fixtures aus mehreren Modulen lassen sich mit `mergeTests` kombinieren:

```ts
// fixtures/index.ts
import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth';
import { test as dbTest } from './database';
import { test as a11yTest } from './a11y';

export const test = mergeTests(authTest, dbTest, a11yTest);
export { expect } from '@playwright/test';
```

Projekteinteilung in `playwright.config.ts` für Browser/Devices:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
  reporter: process.env.CI ? 'dot' : 'list',
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
```

---

## 2. Zustandsbasierte Tests / „Snapshots“ reproduzierbar herstellen

Playwright hat kein klassisches „Snapshot-Testing“ im Sinne von gespeicherten UI-Zuständen (außer ARIA-Snapshots und Visual Comparisons). Stattdessen stellt man **Anwendungszustände reproduzierbar her** über:

* API-Mocks (route / routeFromHAR)
* LocalStorage / SessionStorage / Cookies (storageState)
* Seed-Werte / Testdaten per Direktaufruf (API-Fixture)
* Clock / Netzwerk-Steuerung

### 2.1 API-Mocks für deterministische Zustände

```ts
// helpers/mock.api.ts
import type { Page } from '@playwright/test';

export function mockGameState(page: Page, state: { balance: number; seed: number }) {
  return page.route('*/**/api/v1/game/state', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance: state.balance,
        seed: state.seed,
        tick: 0,
        players: [],
      }),
    });
  });
}
```

Usage im Test:

```ts
test('startet mit definiertem Guthaben', async ({ page, gamePage }) => {
  await mockGameState(page, { balance: 5000, seed: 12345 });
  await gamePage.goto();
  await expect(gamePage.balance).toHaveText('5.000');
});
```

**HAR-Wiedergabe** (echter aufgezeichneter Traffic, offline nutzbar):

```ts
await page.routeFromHAR('./hars/game-state.har', {
  url: '*/**/api/v1/game/state',
  update: false, // false = aus Datei abspielen, true = aufzeichnen & aktualisieren
});
```

### 2.2 LocalStorage / SessionStorage / storageState

Für angemeldete Zustände ohne Login-Flow:

```ts
// helpers/auth.state.ts
import { test as base } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

export const test = base.extend<{
  authenticatedPage: ReturnType<typeof Page>; // vereinfacht
}>({
  authenticatedPage: async ({ page, request }, use) => {
    // Einmalig anmelden und Zustand speichern (worker-scoped wäre möglich)
    await request.post('/api/auth/login', { data: { user: 'test', pass: 'secret' } });
    const storage = await page.context().storageState();
    // storage in Datei schreiben für Wiederverwendung
    await use(page);
  },
});
```

Direkter LocalStorage-Zugriff für feingranulare Zustände:

```ts
await page.evaluate(({ seed, balance }) => {
  localStorage.setItem('game:seed', String(seed));
  localStorage.setItem('game:balance', String(balance));
}, { seed: 42, balance: 1000 });
```

### 2.3 Seed-Werte und PRNG

Playwright bietet keinen eingebauten Seed für die Anwendung; die App muss selbst einen deterministischen Seed akzeptieren (z. B. über URL-Query-Parameter oder LocalStorage). Tests injizieren den Seed vor dem Navigieren:

```ts
test('deterministischer Spielverlauf mit Seed 7', async ({ page }) => {
  await page.goto('/?seed=7&mode=deterministic');
  await expect(page.getByTestId('seed-display')).toHaveText('7');
});
```

### 2.4 Checkliste für reproduzierbare Zustände

| Technik | Wann einsetzen |
|---|---|
| `page.route` + `fulfill` | Einzelne API-Endpoints mocken (schnell, flexibel) |
| `routeFromHAR` | Komplexe HTTP-Szenarien exakt replayen |
| `storageState` | Login/Zustand über Datei wiederherstellen |
| `localStorage` direkt | Feingranulare App-Flags, Seeds, Themen |
| `page.evaluate` | Zustande direkt im Browser setzen |
| `test.use({ storageState })` | Auth-Zustand pro Projekt/Datei |

---

## 3. Playwright für KI-Agenten transparent machen

Damit ein Agent Tests lesen, verstehen und Lücken finden kann, muss jeder Test selbsterklärend sein. Die folgende Konvention wird empfohlen:

### 3.1 Test-Namen als Spezifikation

Namen folgen dem Muster: **[Kontext] → [Aktion] → [Erwartetes Ergebnis]**

```ts
// ✅ Gut: selbstbeschreibend
test('Einsatz-Flow → gültiger Einsatz von 100 → Ledger-Eintrag und neuer Saldo', async ({ gamePage, ledgerPage }) => {
  // ...
});

// ❌ Schlecht: vage
test('test 1', async ({ page }) => { /* ... */ });
```

### 3.2 `@test-target`-Anmerkungen (analog zum existierenden Projekt)

Das Projekt nutzt bereits `@test-target` und `@error-code` Header in Test-Dateien (siehe `AGENTS.md` / `verify-test-quality`). Für Playwright Tests analog:

```ts
/**
 * @test-target src/core/sim/ledger.ts (buchung nach Einsatz)
 * @error-code LED-001
 * @expected-behavior Nach Einsatz wird eine Ledger-Zeile mit korrektem Saldo geschrieben.
 * @coverage Einsatz-Flow, Saldo-Anzeige, Ledger-Eintrag
 * @missing-edge-case Negativer Einsatz, NaN-Einsatz, Einsatz > Saldo
 */
test('Einsatz-Flow → gültiger Einsatz → Ledger-Eintrag', async ({ gamePage, ledgerPage }) => {
  await gamePage.placeBet(100);
  await expect(ledgerPage.lastEntry().getByText('Einsatz 100')).toBeVisible();
  await expect(gamePage.balance).toHaveText('4.900');
});
```

**Felder pro Test:**
* `@test-target`: Quelle, die getestet wird (Datei/Symbol).
* `@expected-behavior`: Was muss passieren? (in natürlicher Sprache)
* `@coverage`: Welche Pfade werden abgedeckt?
* `@missing-edge-case`: Was fehlt noch? (Lücken explizit machen)

### 3.3 Erwartetes Verhalten vor der Aktion dokumentieren

Jeder Testblock sollte mit einem Kommentar oder einer Struktur beginnen, die Ziel, Setup und Erwartung trennt:

```ts
test('Einsatz-Flow → Einsatz 0 → Fehlermeldung, kein Ledger-Eintrag', async ({ gamePage }) => {
  // GIVEN: Spielseite geladen, Saldo 1000
  await gamePage.goto();

  // WHEN: Einsatz 0 wird eingegeben und bestätigt
  await gamePage.placeBet(0);

  // THEN: Fehlermeldung sichtbar, Saldo unverändert, kein Ledger-Eintrag
  await expect(gamePage.errorMessage).toHaveText('Einsatz muss größer als 0 sein');
  await expect(gamePage.balance).toHaveText('1.000');
});
```

### 3.4 Screenshots, Videos und Trace-Viewer bei Failure

Konfiguration in `playwright.config.ts`:

```ts
use: {
  screenshot: 'only-on-failure', // bei jedem Failure automatisch
  video: 'retain-on-failure',    // nur bei fehlgeschlagenen Tests behalten
  trace: 'on-first-retry',       // Trace bei erstem Retry (CI)
},
```

Manuelle Screenshots/Videos in wichtigen Schritten:

```ts
import { test, expect } from '@playwright/test';

test('kritischer Pfad mit Dokumentation', async ({ page }, testInfo) => {
  await page.goto('/game');

  // Screenshot nach wichtiger Aktion (manuell, für Agenten sichtbar)
  await page.screenshot({
    path: testInfo.outputPath('after-bet.png'),
    fullPage: true,
  });

  await expect(page.getByTestId('balance')).toHaveText('1.000');
});
```

**Trace-Viewer öffnen:**
```bash
npx playwright show-trace test-results/trace.zip
# oder HTML-Report öffnen
npx playwright show-report
```

### 3.5 Annotationen für Agenten

Playwright unterstützt `annotation` mit `type` und `description` — ideal für agentenlesbare Metadaten:

```ts
test('Einsatz → gültig', {
  annotation: [
    { type: 'target', description: 'src/core/sim/ledger.ts#bookBet' },
    { type: 'expected', description: 'Ledger-Zeile + Saldo-Update' },
    { type: 'gap', description: 'Negativer Einsatz noch nicht abgedeckt' },
  ],
}, async ({ page }) => {
  // ...
});
```

Diese Annotationen erscheinen im HTML-Reporter und sind über die Reporter-API auslesbar (z. B. für Agenten-Analyse-Skripte).

---

## 4. Playwright Edge-Case-Muster

### 4.1 Grenzwerte (Boundary Values)

```ts
test.describe('Einsatz-Grenzwerte', () => {
  test('Einsatz = 0 wird abgelehnt', async ({ gamePage }) => {
    await gamePage.placeBet(0);
    await expect(gamePage.error).toContainText('muss größer als 0 sein');
  });

  test('Einsatz = Minimum (1) wird akzeptiert', async ({ gamePage }) => {
    await gamePage.placeBet(1);
    await expect(gamePage.balance).toContainText('999');
  });

  test('Einsatz = Maximum (Saldo) wird akzeptiert', async ({ gamePage }) => {
    await gamePage.placeBet(1000); // gesamtes Guthaben
    await expect(gamePage.balance).toHaveText('0');
  });

  test('Einsatz > Saldo wird abgelehnt', async ({ gamePage }) => {
    await gamePage.placeBet(1001);
    await expect(gamePage.error).toContainText('nicht ausreichend');
  });
});
```

### 4.2 Leere Zustände (Empty States)

```ts
test('leerer Ledger zeigt Platzhalter', async ({ ledgerPage }) => {
  await ledgerPage.goto();
  await expect(ledgerPage.emptyState).toBeVisible();
  await expect(ledgerPage.entries).toHaveCount(0);
});

test('keine aktiven Spiele zeigt Leeranzeige', async ({ gamePage }) => {
  await gamePage.goto();
  await expect(gamePage.noActiveGames).toBeVisible();
});
```

### 4.3 Fehlerseiten und Fehlerzustände

```ts
test('404-Seite wird korrekt angezeigt', async ({ page }) => {
  await page.goto('/nicht-vorhanden');
  await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible();
});

test('API-Fehler 500 wird graceful behandelt', async ({ page, gamePage }) => {
  await page.route('*/**/api/v1/game/state', route => route.fulfill({ status: 500 }));
  await gamePage.goto();
  await expect(gamePage.errorBanner).toContainText('Serverfehler');
});
```

### 4.4 Race Conditions

Nutze **web-first assertions** statt manueller Wartezeiten:

```ts
// ✅ Playwright wartet automatisch, bis Bedingung erfüllt ist
await expect(page.getByText('Einsatz bestätigt')).toBeVisible();

// ❌ Vermeiden: feste Wartezeiten
await page.waitForTimeout(2000);
```

Für echte Race Conditions (zwei schnelle Aktionen nacheinander):

```ts
test('zwei gleichzeitige Einsätze werden seriell verarbeitet', async ({ gamePage }) => {
  const bet1 = gamePage.placeBet(100);
  const bet2 = gamePage.placeBet(50);
  await Promise.all([bet1, bet2]);
  // Erwartung: letzter Schreibvorgang gewinnt, Saldo konsistent
  await expect(gamePage.balance).toHaveText('850');
});
```

### 4.5 Netzwerk-Fehler

```ts
test('offline-Zustand zeigt Wiederverbindungs-UI', async ({ page, gamePage }) => {
  await page.context().setOffline(true);
  await gamePage.goto();
  await expect(gamePage.offlineBanner).toBeVisible();

  await page.context().setOffline(false);
  await expect(gamePage.reconnectButton).toBeVisible();
  await gamePage.reconnectButton.click();
  await expect(gamePage.balance).toBeVisible();
});

test('langsame API-Anfrage wird nicht als Fehler gewertet', async ({ page }) => {
  await page.route('*/**/api/v1/game/state', async route => {
    await new Promise(r => setTimeout(r, 5000)); // 5s Verzögerung
    await route.fulfill({ body: JSON.stringify({ balance: 1000 }) });
  });
  await expect.poll(() => page.goto('/game'), { timeout: 10000 });
});
```

### 4.6 Storage-Zustand (Cookies / LocalStorage)

```ts
test('Login-Zustand über storageState wiederherstellen', async ({ page }) => {
  // storageState wird aus Datei geladen (siehe fixtures/auth.state.ts)
  await page.goto('/dashboard');
  await expect(page.getByText('Willkommen zurück')).toBeVisible();
});

test('LocalStorage wird zwischen Tests zurückgesetzt', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('flag', 'set'));
  await page.reload();
  await expect(page.evaluate(() => localStorage.getItem('flag'))).toBeNull(); // isoliert pro Test
});
```

---

## 5. Playwright sichtbar laufen lassen (headed mode, CI, Reporter, Video, Screenshot-on-Failure)

### 5.1 Headed Mode (lokal)

```bash
# Einzelner Test im headed Browser
npx playwright test tests/game.spec.ts --headed

# Mit Debugger (Inspector)
npx playwright test tests/game.spec.ts --debug

# UI-Modus (empfohlen für Entwicklung)
npx playwright test --ui
```

### 5.2 CI-Konfiguration

```ts
// playwright.config.ts
export default defineConfig({
  reporter: process.env.CI ? 'dot' : 'list',
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

GitHub Actions Beispiel (kurz):

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install chromium --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

### 5.3 Reporter-Auswahl

| Reporter | Einsatzzweck |
|---|---|
| `list` (lokal) | Eine Zeile pro Test, gut für Entwicklung |
| `dot` (CI) | Sehr kompakt, ein Zeichen pro Test |
| `html` | Selbstständiger Report, öffnet sich bei Fehlern automatisch |
| `json` / `junit` | Für CI-Systeme und Auswertung durch Agenten |
| `github` | GitHub Actions Annotationen bei Fehlern |
| `perfetto` | Performance-Timeline pro Worker |

### 5.4 Video und Screenshot-on-Failure

```ts
use: {
  video: 'retain-on-failure',   // nur bei Failure behalten (platzsparend)
  screenshot: 'only-on-failure', // automatisch bei jedem Fehler
  trace: 'on-first-retry',      // Trace bei erstem Retry
},
```

Videos sind nach `browserContext.close()` verfügbar (`page.video().path()`). Für manuelle Dokumentation im Test:

```ts
await page.screenshot({ path: testInfo.outputPath('failure-state.png'), fullPage: true });
```

### 5.5 Trace-Viewer für CI-Debugging

Bei CI-Fehlern: `trace: 'on-first-retry'` erzeugt ein `trace.zip` pro wiederholtem Test. Das kann als Artifact hochgeladen und lokal geöffnet werden:

```bash
npx playwright show-trace path/to/trace.zip
# oder online
https://trace.playwright.dev/?trace=https://ci.example.com/trace.zip
```

---

## 6. Alternativen zu Playwright für E2E

| Kriterium | Playwright | Puppeteer | Cypress | MCP (Protokoll) |
|---|---|---|---|---|
| **Primärer Zweck** | E2E-Test-Runner | Browser-Automatisierungs-Bibliothek | E2E-Test-Runner | Protokoll für KI-Agenten → Tools |
| **Test-Runner integriert** | Ja (Playwright Test) | Nein (eigener Runner nötig, z. B. Jest) | Ja | Nein |
| **Browser** | Chromium, Firefox, WebKit | Chromium | Chromium, Electron, Firefox | Agent-abhängig |
| **Fixtures / Isolation** | Exzellent (built-in) | Manuell | Gut (beforeEach) | Nicht zutreffend |
| **API-Mocking / Netzwerk** | Exzellent (route, HAR) | Gut (page.setRequestInterception) | Gut (cy.intercept) | Nicht zutreffend |
| **Trace / Video / Screenshot** | Built-in (Trace Viewer) | Teilweise | Built-in | Nicht zutreffend |
| **KI-Agenten-Transparenz** | Sehr gut (Annotationen, Trace, Reporter-API) | Mittel | Mittel | **Kernzweck** (Agent steuert Tools) |
| **Headed / Headless** | Beide | Beide | Hauptsächlich Headed | Agent-abhängig |
| **Modularität / große Suiten** | Exzellent (mergeTests, Projekte) | Mittel | Gut | Nicht zutreffend |

### Bewertung für „Agenten-transparente, modulare, snapshot-basierte E2E-Tests“

**Playwright ist die beste Wahl**, weil:

1. **Test-Runner + Fixtures + POM** sind integriert und modular (keine externe Laufzeit nötig).
2. **Zustandswiedergabe** über `route`, `routeFromHAR`, `storageState`, `localStorage` ist native und deterministisch.
3. **Agenten-Transparenz** durch `@test-target`-ähnliche Annotationen, Trace Viewer, Video, Screenshot-on-Failure und maschinenlesbare Reporter (JSON/JUnit).
4. **Trace Viewer** gibt einem Agenten eine zeitliche Rekonstruktion jeder Aktion (DOM-Snapshots, Netzwerk, Console, Fehler).

**Puppeteer** ist nur dann sinnvoll, wenn man kein Test-Framework will und eigene Skripte schreibt — verliert aber Runner, Fixtures und Reporter.

**Cypress** ist eine starke Alternative für klassische E2E, aber begrenzter bei Multi-Browser (WebKit fehlt), API-Mocking ist weniger flexibel als Playwrights `route`, und es gibt keinen vergleichbaren Trace Viewer für CI-Retries.

**MCP** (Model Context Protocol) ist **kein Test-Runner**, sondern ein Protokoll, mit dem KI-Agenten Tools aufrufen. MCP könnte Playwright ergänzen (Agent steuert Playwright-Tests über MCP), ersetzt Playwright aber nicht für E2E-Tests.

### Empfehlung

| Rolle | Empfohlene Technologie |
|---|---|
| E2E-Test-Runner | **Playwright Test** |
| Page Objects | Eigene Klassen unter `pages/` + Fixtures unter `fixtures/` |
| Zustandswiedergabe | `page.route`, `routeFromHAR`, `storageState`, `localStorage` |
| Agenten-Transparenz | `@test-target`-Header, `annotation`, Trace Viewer, JSON Reporter |
| CI | `dot` + `on-first-retry` Trace + `retain-on-failure` Video + HTML-Report als Artifact |

---

## Anhang: Minimales starter-Template (TypeScript)

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: process.env.CI ? 'dot' : 'list',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

```ts
// fixtures/game.ts — zentraler Test-Einstieg mit Page Objects + Mocks
import { test as base } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { mockGameState } from '../helpers/mock.api';

type GameFixtures = { gamePage: GamePage };

export const test = base.extend<GameFixtures>({
  gamePage: async ({ page }, use) => {
    const pageObj = new GamePage(page);
    await pageObj.goto();
    await use(pageObj);
    await pageObj.reset();
  },
});
export { expect } from '@playwright/test';
```

```ts
// tests/game.spec.ts — agenten-transparenter Test
/**
 * @test-target src/core/sim/ledger.ts#bookBet
 * @expected-behavior Einsatz erzeugt Ledger-Zeile und aktualisiert Saldo.
 * @coverage Einsatz-Flow, Saldo, Ledger
 * @missing-edge-case Einsatz > Saldo, Einsatz = 0, Einsatz = NaN
 */
test('Einsatz-Flow → gültiger Einsatz → Ledger-Eintrag', async ({ gamePage }) => {
  await gamePage.placeBet(100);
  await expect(gamePage.balance).toHaveText('900');
});
```

---

*Hinweis: Die Web-Suche war während dieser Recherche vorübergehend nicht verfügbar (HTTP 402). Alle technischen Aussagen stammen aus der offiziellen Playwright-Dokumentation (playwright.dev) und aus dem Fachwissen zu Playwright Test.*
