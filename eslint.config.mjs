import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Determinismus: Zufall und Zeit kommen aus dem Spielzustand, nicht aus der Umgebung. */
const noWallClock = [
  { object: 'Math', property: 'random', message: 'Determinismus: Zufall nur aus dem geseedeten Prng (src/core/rng), nie aus Math.random.' },
  { object: 'Date', property: 'now', message: 'Determinismus: kein Wall-Clock-Seed; ein neuer Lauf zieht entropySeed() in src/core/rng/streams.ts.' },
  { object: 'performance', property: 'now', message: 'Determinismus: Wall-Clock gehoert nicht in den Spielzustand.' },
];

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'docs/Chats/**'],
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
    rules: {
      'no-restricted-properties': ['error', ...noWallClock],
      'no-restricted-syntax': ['error', {
        selector: "NewExpression[callee.name='Date']",
        message: 'Determinismus: kein Datum aus der Uhr; Zeit kommt aus world.tick und world.day.',
      }],
    },
  },
  {
    // Nur Pacing von Bild und Ton darf die Uhr lesen; der Spielzustand nie.
    files: ['src/render/**/*.ts', 'src/render/**/*.tsx'],
    rules: {
      'no-restricted-properties': ['error', noWallClock[0], noWallClock[1]],
    },
  },
  {
    // Die eine Entropie-Quelle: der einzige Ort, der echten Zufall ziehen darf.
    files: ['src/core/rng/streams.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
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
