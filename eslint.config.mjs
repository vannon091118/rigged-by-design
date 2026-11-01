import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Determinismus-Sperre: Zufall und Zeit kommen aus dem Spielzustand, nie aus der Umgebung.
 *
 * Erfasst werden direkte Zugriffe, Namespace-Umwege (`globalThis.Math`), Aliase,
 * Krypto-Quellen und `new`-Umwege. Jede neue Datei unter `src/**` und `scripts/**`
 * ist per Default gesperrt; Ausnahmen stehen unten namentlich und begruendet.
 * Inline-Ausnahmen (`eslint-disable`) sind global abgeschaltet — es gibt keinen
 * Kommentar, der eine Zufallsquelle durchlaesst.
 */
const direct = [
  { object: 'Math', property: 'random', message: 'Determinismus: Zufall nur aus dem geseedeten Prng (src/core/rng), nie aus Math.random.' },
  { object: 'Date', property: 'now', message: 'Determinismus: kein Wall-Clock-Seed; ein neuer Lauf zieht entropySeed() in src/core/rng/streams.ts.' },
  { object: 'performance', property: 'now', message: 'Determinismus: Wall-Clock gehoert nicht in den Spielzustand.' },
];

/** Uhr-Zugriffe, die an `no-restricted-properties` vorbeilaufen (Namespace, `new`, computed). */
const clockSyntax = [
  { selector: "NewExpression[callee.name='Date']", message: 'Determinismus: kein Datum aus der Uhr; Zeit kommt aus world.tick und world.day.' },
  { selector: "NewExpression[callee.property.name='Date']", message: 'Determinismus: kein Datum aus der Uhr, auch nicht ueber globalThis/window.' },
  { selector: "MemberExpression[object.name='Date'][property.name='now']", message: 'Determinismus: kein Wall-Clock-Seed (Date.now).' },
  { selector: "MemberExpression[object.property.name='Date'][property.name='now']", message: 'Determinismus: kein Wall-Clock-Seed (globalThis.Date.now).' },
  { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'Determinismus: kein Math.random.' },
  { selector: "MemberExpression[object.property.name='Math'][property.name='random']", message: 'Determinismus: kein Math.random ueber globalThis/window.' },
  { selector: "MemberExpression[object.name='performance'][property.name='now']", message: 'Determinismus: kein performance.now im Spielzustand.' },
  { selector: "MemberExpression[object.property.name='performance'][property.name='now']", message: 'Determinismus: kein performance.now ueber globalThis/window.' },
];

/** Ohne Uhr: fuer Tooling, das Zeitstempel schreibt, aber weiterhin keinen Zufall ziehen darf. */
const clockSyntaxNoDate = clockSyntax.filter((entry) => !entry.selector.includes("'Date'"));

/** Echte Entropie: nur die eine Stelle in src/core/rng/streams.ts. */
const entropySyntax = [
  { selector: "MemberExpression[property.name='getRandomValues']", message: 'Determinismus: echte Entropie nur in entropySeed() (src/core/rng/streams.ts).' },
  { selector: "MemberExpression[property.name='randomUUID']", message: 'Determinismus: keine UUID aus der Umgebung; IDs kommen aus dem Spielzustand.' },
];

/** Nur Pacing von Bild und Ton darf die Uhr lesen; der Spielzustand nie. */
const renderDirect = [direct[0], direct[1]];
const renderSyntax = [...clockSyntax.filter((entry) => !entry.selector.includes("'performance'")), ...entropySyntax];

const determinism = {
  'no-restricted-properties': ['error', ...direct],
  'no-restricted-syntax': ['error', ...clockSyntax, ...entropySyntax],
};

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'docs/Chats/**'],
  },
  {
    // Kein Kommentar darf eine Regel abschalten: die Sperre ist nicht wegredbar.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: determinism,
  },
  {
    files: ['src/render/**/*.ts', 'src/render/**/*.tsx'],
    rules: {
      'no-restricted-properties': ['error', ...renderDirect],
      'no-restricted-syntax': ['error', ...renderSyntax],
    },
  },
  {
    // Die eine Entropie-Quelle. Alles andere bleibt auch hier gesperrt.
    files: ['src/core/rng/streams.ts'],
    rules: {
      'no-restricted-properties': ['error', ...direct],
      'no-restricted-syntax': ['error', ...clockSyntax],
    },
  },
  {
    // Build- und Pruefpfad: der Content-Compiler entsteht hier und ist damit per Default gesperrt.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    rules: determinism,
  },
  {
    // Werkzeuge, deren Aufgabe ein Zeitstempel oder CI-Polling ist. Kein Zufall, keine Spielzeit.
    files: [
      'scripts/doc-sync.mjs',
      'scripts/doc-stub.mjs',
      'scripts/lib/doc-sync.mjs',
      'scripts/ci-long-checks.mjs',
      'scripts/lib/gate-runner.mjs',
      'scripts/lib/gate-cache.mjs',
      'scripts/lib/process-sweep.mjs',
    ],
    rules: {
      'no-restricted-properties': ['error', direct[0], direct[2]],
      'no-restricted-syntax': ['error', ...clockSyntaxNoDate, ...entropySyntax],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
