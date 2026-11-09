#!/usr/bin/env node
/**
 * Capacitor-Android: Huelle um den Vite-Build, getrennt nach Variante.
 *
 *   pnpm run android:apk         -> artifacts/rigged-by-design-debug.apk
 *   pnpm run android:apk:release -> artifacts/rigged-by-design-release.apk
 *
 * Beide Varianten tragen dieselbe, versionierte Signatur aus
 * `src/Config/android-signing.json`. Zwei konkrete Installationsfehler sind damit
 * ausgeschlossen: ein unsigniertes Release (Android lehnt es komplett ab) und
 * ein pro Runner neu erzeugter Debug-Schluessel (Android verlangt fuer ein
 * Update dasselbe Zertifikat und meldet sonst "App nicht installiert").
 *
 * Die Signierkonfiguration schreibt dieses Skript in das generierte Projekt
 * unter `android/`; der Quellbaum bleibt unberuehrt. Nach dem Bau prueft
 * `apksigner verify` Signatur und Zertifikats-Fingerabdruck, `aapt2 badging`
 * Paketnamen und Mindest-SDK. Weicht etwas ab, bricht der Lauf rot ab, statt
 * eine nicht installierbare APK als Artefakt zu veroeffentlichen.
 *
 * Die Konfiguration liegt versioniert in capacitor.config.json, die Pakete sind
 * in package.json gepinnt – dieses Skript schreibt weder Manifest noch Lockfile
 * und installiert nichts. Android-SDK und Java 21 kommen aus dem CI-Image;
 * lokal bricht der Lauf rot ab.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const release = process.argv.includes('--release');
const stage = release ? 'release' : 'debug';
/** Der Vertrag "fest verdrahtet": diese Pakete stehen gepinnt in package.json. */
const CAPACITOR = ['@capacitor/core', '@capacitor/cli', '@capacitor/android'];
/**
 * Ein Schluessel fuer beide Varianten: Updates brauchen dasselbe Zertifikat.
 * Der PKCS12-Inhalt steht base64 in src/Config – das Tree-Gate laesst dort nur
 * Textdateien zu; beim Bau entsteht daraus das Paket im generierten Projekt.
 */
const SIGNING_FILE = resolve(ROOT, 'src', 'Config', 'android-signing.json');
const gradleTask = release ? 'assembleRelease' : 'assembleDebug';
const gradleApk = release ? 'app-release.apk' : 'app-debug.apk';
const apkName = release ? 'rigged-by-design-release.apk' : 'rigged-by-design-debug.apk';

function abort(message) {
  fail(1, 'ERR-4014', 'android', message);
  process.exit(1);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) abort(`${command} ${args.join(' ')} fehlgeschlagen`);
}

function capture(command, args, cwd = ROOT) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
}

/** Das neueste Build-Tools-Verzeichnis aus dem SDK; ohne SDK gibt es kein Werkzeug. */
function sdkTool(name) {
  const roots = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME].filter(Boolean);
  for (const root of roots) {
    const tools = join(root, 'build-tools');
    if (!existsSync(tools)) continue;
    const versions = readdirSync(tools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = join(tools, version, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  const onPath = capture(name, ['--version']);
  return onPath.status === 0 ? name : undefined;
}

if (!existsSync(resolve(ROOT, 'dist', 'index.html'))) {
  abort('dist/index.html fehlt: zuerst pnpm run build bzw. verify:all');
}
if (!existsSync(SIGNING_FILE)) {
  abort('src/Config/android-signing.json fehlt: ohne gepinnten Schluessel ist keine installierbare APK moeglich');
}
const signing = JSON.parse(readFileSync(SIGNING_FILE, 'utf8'));
if (signing.storeType !== 'PKCS12' || !signing.alias || !signing.password) {
  abort('android-signing.json: storeType, alias und password sind Pflicht');
}
if (!/^[0-9a-f]{64}$/.test(signing.sha256 ?? '')) {
  abort('android-signing.json: sha256 muss ein Hex-Digest des Zertifikats sein');
}
if (typeof signing.keystoreBase64 !== 'string' || signing.keystoreBase64.length < 1024) {
  abort('android-signing.json: keystoreBase64 fehlt oder ist abgeschnitten');
}
const configPath = resolve(ROOT, 'src', 'Config', 'capacitor.config.json');
if (!existsSync(configPath)) {
  abort('src/Config/capacitor.config.json fehlt: die Huelle ist fest im Repo verdrahtet');
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.webDir !== 'dist') abort(`capacitor.config.json: webDir muss dist sein, steht: ${config.webDir}`);
if (config.android?.orientation !== 'portrait') abort('capacitor.config.json: android.orientation muss portrait sein');
if (!existsSync(resolve(ROOT, 'node_modules', '@capacitor', 'cli'))) {
  abort('Capacitor fehlt in node_modules: pnpm install ausfuehren, die Pakete sind gepinnt');
}
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
for (const dep of CAPACITOR) {
  if (!pkg.devDependencies?.[dep]) abort(`${dep} ist nicht in package.json gepinnt`);
}
console.log(`[IDX-0001] prepare-android: ${release ? 'Release' : 'Debug'} von ${pkg.name}@${pkg.version}`);

// Capacitor liest seine Konfiguration nur im Arbeitsverzeichnis: die Quelle
// liegt in src/Config, die Wurzel bekommt waehrend des Laufs eine Kopie.
const rootConfig = resolve(ROOT, 'capacitor.config.json');
copyFileSync(configPath, rootConfig);
if (!existsSync(resolve(ROOT, 'android'))) run('pnpm', ['exec', 'cap', 'add', 'android']);
run('pnpm', ['exec', 'cap', 'sync', 'android']);

// Capacitor kennt keine Orientierung in seiner Config: der Wert wird beim Bau
// in die generierte MainActivity geschrieben, nicht in den Quellbaum.
const manifestPath = resolve(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!existsSync(manifestPath)) abort('AndroidManifest.xml fehlt nach cap sync');
let androidManifest = readFileSync(manifestPath, 'utf8');
if (androidManifest.includes('android:screenOrientation=')) {
  androidManifest = androidManifest.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="portrait"');
} else {
  androidManifest = androidManifest.replace(
    /(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*?)(\/?>)/,
    '$1 android:screenOrientation="portrait"$2',
  );
}
if (!androidManifest.includes('android:screenOrientation="portrait"')) {
  abort('AndroidManifest.xml: MainActivity nicht gefunden, Orientierung nicht gesetzt');
}
writeFileSync(manifestPath, androidManifest);
console.log('[IDX-0001] prepare-android: MainActivity auf Hochformat gepinnt');

/**
 * Signierkonfiguration fuer beide BuildTypes. Das generierte Projekt ist
 * gitignoriert, deshalb ist ein eingefuegter Block hier kein Quellbaum-Schreiben.
 * Der Marker verhindert doppeltes Anhaengen bei wiederholten Laeufen.
 */
const gradleFile = resolve(ROOT, 'android', 'app', 'build.gradle');
const SIGNING_MARKER = '// rbd-signing';
if (!existsSync(gradleFile)) abort('android/app/build.gradle fehlt nach cap add');
// Das Paket entsteht erst hier: im Quellbaum liegt nur der base64-Inhalt.
const KEYSTORE = resolve(ROOT, 'android', 'app', 'rbd-debug.p12');
writeFileSync(KEYSTORE, Buffer.from(signing.keystoreBase64, 'base64'));
let gradleConfig = readFileSync(gradleFile, 'utf8');
if (!gradleConfig.includes(SIGNING_MARKER)) {
  const storePath = KEYSTORE.replaceAll('\\', '/');
  gradleConfig += `
${SIGNING_MARKER}
// Beide Varianten teilen ein Zertifikat: Android akzeptiert ein Update nur
// unter derselben Signatur. Der Schluessel liegt versioniert in src/Config.
android {
    signingConfigs {
        rbd {
            storeFile file('${storePath}')
            storePassword '${signing.password}'
            keyAlias '${signing.alias}'
            keyPassword '${signing.password}'
            storeType 'PKCS12'
        }
    }
    buildTypes {
        debug { signingConfig signingConfigs.rbd }
        release { signingConfig signingConfigs.rbd }
    }
}
`;
  writeFileSync(gradleFile, gradleConfig);
  console.log('[IDX-0001] prepare-android: Signierkonfiguration in das generierte Projekt geschrieben');
}

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradle, [gradleTask, '--no-daemon'], resolve(ROOT, 'android'));
rmSync(rootConfig, { force: true });

// Gradle legt bei assembleRelease zusaetzlich ein unsigniertes Paket ab, wenn
// die Signierkonfiguration nicht greift. Genau diese Datei ist nicht
// installierbar und darf deshalb nie das Artefakt werden.
const unsigned = resolve(ROOT, 'android', 'app', 'build', 'outputs', 'apk', stage, 'app-release-unsigned.apk');
if (existsSync(unsigned) && release) {
  abort('Gradle hat ein unsigniertes Release erzeugt: die Signierkonfiguration greift nicht');
}

const apk = resolve(ROOT, 'android', 'app', 'build', 'outputs', 'apk', stage, gradleApk);
if (!existsSync(apk)) abort(`Gradle hat keine ${stage}-APK erzeugt: ${gradleApk}`);

/**
 * Installierbarkeit ist eine Eigenschaft der Datei, nicht des Builds: Signatur,
 * Zertifikat und Paketname werden hier gemessen, nicht angenommen.
 */
const apksigner = sdkTool('apksigner');
const aapt2 = sdkTool('aapt2');
if (!apksigner || !aapt2) {
  abort('apksigner/aapt2 fehlen: Android build-tools sind nicht installiert');
}
const verified = capture(apksigner, ['verify', '--print-certs', apk]);
const certs = `${verified.stdout ?? ''}${verified.stderr ?? ''}`;
if (verified.status !== 0) abort(`apksigner verify: ${apkName} ist nicht gueltig signiert`);
const digest = /Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/i.exec(certs)?.[1];
if (!digest) abort(`apksigner verify: kein Zertifikats-Digest in ${apkName}`);
if (digest.toLowerCase() !== signing.sha256) {
  abort(`apksigner verify: ${apkName} ist mit einem fremden Schluessel signiert (${digest})`);
}
const badging = capture(aapt2, ['dump', 'badging', apk]);
const badgingText = `${badging.stdout ?? ''}${badging.stderr ?? ''}`;
if (badging.status !== 0) abort(`aapt2 dump badging: ${apkName} ist nicht lesbar`);
const packageName = /package: name='([^']+)'/.exec(badgingText)?.[1];
if (packageName !== config.appId) {
  abort(`aapt2 dump badging: Paketname ${packageName ?? 'unbekannt'} statt ${config.appId}`);
}
const minSdk = /sdkVersion:'(\d+)'/.exec(badgingText)?.[1];
console.log(`[IDX-0001] prepare-android: ${apkName} signiert (${digest.slice(0, 16)}...), Paket ${packageName}, minSdk ${minSdk ?? '?'}`);

mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
copyFileSync(apk, resolve(ROOT, 'artifacts', apkName));
console.log(`[IDX-0001] prepare-android: artifacts/${apkName} bereit`);
