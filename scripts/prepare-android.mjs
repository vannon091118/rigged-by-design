#!/usr/bin/env node
/**
 * Capacitor-Android: Huelle um den Vite-Build, getrennt nach Variante.
 *
 *   npm run android:apk         -> artifacts/rigged-by-design-debug.apk
 *   npm run android:apk:release -> artifacts/rigged-by-design-release-unsigned.apk
 *
 * Die Konfiguration liegt versioniert in capacitor.config.json, die Pakete sind
 * in package.json gepinnt – dieses Skript schreibt weder Manifest noch Lockfile
 * und installiert nichts. Debug ist installierbar, Release kommt ohne
 * Signatur heraus; das Signieren ist ein eigener Schritt.
 * Android-SDK und Java 21 kommen aus dem CI-Image; lokal bricht der Lauf rot ab.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const release = process.argv.includes('--release');
const stage = release ? 'release' : 'debug';
/** Der Vertrag "fest verdrahtet": diese Pakete stehen gepinnt in package.json. */
const CAPACITOR = ['@capacitor/core', '@capacitor/cli', '@capacitor/android'];
const gradleTask = release ? 'assembleRelease' : 'assembleDebug';
const gradleApk = release ? 'app-release-unsigned.apk' : 'app-debug.apk';
const apkName = release ? 'rigged-by-design-release-unsigned.apk' : 'rigged-by-design-debug.apk';

function abort(message) {
  fail(1, 'ERR-4014', 'android', message);
  process.exit(1);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) abort(`${command} ${args.join(' ')} fehlgeschlagen`);
}

if (!existsSync(resolve(ROOT, 'dist', 'index.html'))) {
  abort('dist/index.html fehlt: zuerst npm run build bzw. verify:all');
}
const configPath = resolve(ROOT, 'src', 'Config', 'capacitor.config.json');
if (!existsSync(configPath)) {
  abort('src/Config/capacitor.config.json fehlt: die Huelle ist fest im Repo verdrahtet');
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.webDir !== 'dist') abort(`capacitor.config.json: webDir muss dist sein, steht: ${config.webDir}`);
if (!existsSync(resolve(ROOT, 'node_modules', '@capacitor', 'cli'))) {
  abort('Capacitor fehlt in node_modules: npm ci ausfuehren, die Pakete sind gepinnt');
}
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
for (const dep of CAPACITOR) {
  if (!pkg.devDependencies?.[dep]) abort(`${dep} ist nicht in package.json gepinnt`);
}
console.log(`[IDX-0001] prepare-android: ${release ? 'Release (unsigned)' : 'Debug'} von ${pkg.name}@${pkg.version}`);

// Capacitor liest seine Konfiguration nur im Arbeitsverzeichnis: die Quelle
// liegt in src/Config, die Wurzel bekommt waehrend des Laufs eine Kopie.
const rootConfig = resolve(ROOT, 'capacitor.config.json');
copyFileSync(configPath, rootConfig);
if (!existsSync(resolve(ROOT, 'android'))) run('npx', ['cap', 'add', 'android']);
run('npx', ['cap', 'sync', 'android']);

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradle, [gradleTask, '--no-daemon'], resolve(ROOT, 'android'));
rmSync(rootConfig, { force: true });

const apk = resolve(ROOT, 'android', 'app', 'build', 'outputs', 'apk', stage, gradleApk);
if (!existsSync(apk)) abort(`Gradle hat keine ${stage}-APK erzeugt: ${gradleApk}`);
mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
copyFileSync(apk, resolve(ROOT, 'artifacts', apkName));
console.log(`[IDX-0001] prepare-android: artifacts/${apkName} bereit`);
