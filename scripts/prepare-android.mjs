#!/usr/bin/env node
/**
 * Capacitor-Android: Huelle um den Vite-Build, Debug-APK als Artefakt.
 * Das Android-SDK und Java 21 kommen aus dem CI-Image; lokal bricht der Lauf rot ab.
 */
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const CAPACITOR = ['@capacitor/core@8', '@capacitor/cli@8', '@capacitor/android@8'];
const APK_NAME = 'rigged-by-design-debug.apk';

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    fail(1, 'ERR-4014', 'android', `${command} ${args.join(' ')} fehlgeschlagen`);
    process.exit(1);
  }
}

const dist = resolve(ROOT, 'dist', 'index.html');
if (!existsSync(dist)) {
  fail(1, 'ERR-4014', 'android', 'dist/index.html fehlt: zuerst npm run build bzw. verify:all');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
writeFileSync(resolve(ROOT, 'capacitor.config.json'), `${JSON.stringify({
  appId: 'de.riggedbydesign.casino',
  appName: 'Rigged by Design',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
}, null, 2)}\n`);
console.log(`[IDX-0001] prepare-android: Huelle fuer ${pkg.name}@${pkg.version} konfiguriert`);

if (!existsSync(resolve(ROOT, 'node_modules', '@capacitor', 'cli'))) {
  console.log('[IDX-0001] prepare-android: Capacitor 8 wird ohne package.json-Aenderung installiert');
  run('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...CAPACITOR]);
}

if (!existsSync(resolve(ROOT, 'android'))) run('npx', ['cap', 'add', 'android']);
run('npx', ['cap', 'sync', 'android']);

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradle, ['assembleDebug', '--no-daemon'], resolve(ROOT, 'android'));

const apk = resolve(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) {
  fail(1, 'ERR-4014', 'android', 'Gradle hat keine Debug-APK erzeugt');
  process.exit(1);
}
mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
copyFileSync(apk, resolve(ROOT, 'artifacts', APK_NAME));
console.log(`[IDX-0001] prepare-android: artifacts/${APK_NAME} bereit`);
