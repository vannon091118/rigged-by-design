#!/usr/bin/env node
/**
 * Ersatz fuer den Release-Upload aus `build-apk.yml`: haengt die gebauten APKs
 * an das GitHub-Release des Tags und prueft danach die Asset-Liste.
 *
 * Ohne CIRCLE_TAG (manueller APK-Lauf) wird nichts veroeffentlicht; die APKs
 * bleiben als CircleCI-Artefakte erhalten. Ohne GH_TOKEN bricht der Schritt
 * rot ab, statt einen stillen Erfolg zu behaupten.
 */
import { existsSync, readFileSync } from 'node:fs';

const tag = process.env.CIRCLE_TAG ?? '';
const token = process.env.GH_TOKEN ?? '';
const owner = process.env.CIRCLE_PROJECT_USERNAME ?? '';
const repo = process.env.CIRCLE_PROJECT_REPONAME ?? '';

if (!tag) {
  console.log('publish-apk: kein Tag; APKs bleiben nur CircleCI-Artefakte.');
  process.exit(0);
}
if (!token || !owner || !repo) {
  console.error('publish-apk: GH_TOKEN oder Repository fehlt; Release-Upload nicht moeglich.');
  process.exit(1);
}

const api = `https://api.github.com/repos/${owner}/${repo}`;
const uploads = `https://uploads.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'rbd-circleci',
};

const DEBUG_APK = 'artifacts/rigged-by-design-debug.apk';
const RELEASE_APK = 'artifacts/rigged-by-design-release.apk';
const hasReleaseApk = existsSync(RELEASE_APK);
const signing = Boolean(process.env.RBD_ANDROID_KEYSTORE_BASE64);

const json = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

let release = null;
const lookup = await fetch(`${api}/releases/tags/${encodeURIComponent(tag)}`, { headers });
if (lookup.status === 404) {
  release = await json(
    await fetch(`${api}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: tag,
        body: 'Automatisch gebaute APKs: Die Debug-APK ist signiert und installierbar; die Release-APK traegt die Produktionssignatur.',
      }),
    }),
  );
} else {
  release = await json(lookup);
}

const upload = async (path, name) => {
  if (!existsSync(path)) throw new Error(`${name} fehlt; ohne Artefakt kein Release`);
  const body = readFileSync(path);
  const response = await fetch(`${uploads}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': String(body.length) },
    body,
  });
  if (response.status === 422) {
    console.log(`publish-apk: ${name} existiert bereits; Upload uebersprungen.`);
    return;
  }
  await json(response);
  console.log(`publish-apk: ${name} hochgeladen.`);
};

await upload(DEBUG_APK, 'rigged-by-design-debug.apk');
if (hasReleaseApk) await upload(RELEASE_APK, 'rigged-by-design-release.apk');

const assets = (await json(await fetch(`${api}/releases/${release.id}/assets`, { headers }))).map((entry) => entry.name);
if (!assets.includes('rigged-by-design-debug.apk')) throw new Error('Release enthaelt keine Debug-APK');
if (signing && !assets.includes('rigged-by-design-release.apk')) throw new Error('Release enthaelt keine Release-APK');
if (!signing && assets.includes('rigged-by-design-release.apk')) {
  throw new Error('Release traegt eine Release-APK ohne bestaetigte Produktionssignatur');
}
if (assets.some((name) => name.includes('unsigned'))) throw new Error('Release fuehrt ein unsigniertes Paket');
console.log(`publish-apk: Release ${tag} geprueft (${assets.length} Assets).`);
