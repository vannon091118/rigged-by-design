/**
 * Headless-Core-Grenze: `src/core/` bleibt frei von UI, Renderer, Pixi, React
 * und DOM. Der Scanner liest nur; er schreibt nie Dateien und kennt keine
 * Ausnahmen fuer Produktionspfade.
 */
import { readdirSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { moduleSpecifiers, parse } from './ts-ast.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

/** Pakete, die aus dem headless Core nicht importiert werden duerfen. */
export const FORBIDDEN_PACKAGES = Object.freeze([
  'pixi.js',
  'react',
  'react-dom',
  '@testing-library',
  'jsdom',
  'vite',
  '@vitejs',
  '@capacitor',
]);

/** Paketname eines Modul-Specifiers; relative und node:-Specifier haben keinen. */
export function packageNameOf(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
    return null;
  }
  const parts = String(specifier).split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const isTestFile = (file) =>
  /(?:^|[/\\])__tests__[/\\]/.test(file) || /\.(?:test|bench)\.[cm]?[jt]sx?$/.test(file);

const isInside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/**
 * Klassifiziert einen Specifier aus einer Core-Datei. `null` heisst erlaubt,
 * sonst steht dort der konkrete Verstoss.
 */
export function classifySpecifier(specifier, fromFile, coreDir) {
  const pkg = packageNameOf(specifier);
  if (pkg && FORBIDDEN_PACKAGES.some((forbidden) => pkg === forbidden || pkg.startsWith(`${forbidden}/`))) {
    return `Paket '${pkg}' ist im headless Core nicht erlaubt`;
  }
  if (specifier.startsWith('/')) {
    return `absoluter Import '${specifier}' verlaesst src/core`;
  }
  if (!specifier.startsWith('.')) {
    return null;
  }
  // Tests sind keine Produktionsdateien: sie duerfen Store-/Render-Helfer
  // und Test-Support lesen, ohne die Core-Grenze zu verschieben.
  if (isTestFile(fromFile)) {
    return null;
  }
  const target = resolve(dirname(fromFile), specifier);
  if (isInside(coreDir, target)) {
    return null;
  }
  return `relativer Import '${specifier}' verlaesst src/core`;
}

/** Alle .ts/.tsx-Dateien unter einem Verzeichnis, rekursiv und deterministisch. */
export function listSourceFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(full);
    }
  };
  walk(dir);
  return files;
}

/**
 * Prueft den echten Core-Baum. `root` ist der Repo-Root, damit der Aufrufer
 * denselben Scanner auch gegen einen isolierten Merge-Checkout richten kann.
 */
export function scanHeadlessCore(root = process.cwd()) {
  const coreDir = resolve(root, 'src', 'core');
  const files = listSourceFiles(coreDir);
  const violations = [];
  for (const file of files) {
    for (const specifier of moduleSpecifiers(parse(file))) {
      const reason = classifySpecifier(specifier, file, coreDir);
      if (reason) {
        violations.push({
          file: relative(root, file).split(sep).join('/'),
          specifier,
          reason,
        });
      }
    }
  }
  return { files: files.length, violations };
}
