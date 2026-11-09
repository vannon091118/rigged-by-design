/**
 * @test-target: .github/workflows/build-apk.yml
 * @error-code: ERR-4014
 *
 * Installierbarkeit ist ein Vertrag, keine Annahme. Der Test haelt drei
 * Eigenschaften fest, die zusammen den Installationsfehler beseitigen: beide
 * Varianten teilen ein versioniertes Zertifikat, der Build misst Signatur,
 * Zertifikats-Digest und Paketnamen selbst, und der Workflow veroeffentlicht
 * nichts Unsigniertes. Gelesen werden Workflow, Signierdatei und Skript;
 * Gradle und SDK laufen nicht.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const script = readFileSync(resolve(ROOT, 'scripts', 'prepare-android.mjs'), 'utf8');
const workflow = readFileSync(resolve(ROOT, '.github', 'workflows', 'build-apk.yml'), 'utf8');
const signingPath = resolve(ROOT, 'src', 'Config', 'android-signing.json');
const signing = JSON.parse(readFileSync(signingPath, 'utf8')) as {
  alias: string;
  password: string;
  storeType: string;
  sha256: string;
  keystoreBase64: string;
};

describe('APK-Signatur und Installierbarkeit', () => {
  it('haelt einen vollstaendigen PKCS12-Schluessel fuer beide Varianten vor', () => {
    expect(existsSync(signingPath), 'android-signing.json fehlt').toBe(true);
    expect(signing.storeType).toBe('PKCS12');
    expect(signing.alias).toBe('rbd-debug');
    expect(signing.password.length).toBeGreaterThan(0);
    expect(signing.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(signing.keystoreBase64.length).toBeGreaterThan(1024);
    expect(script).toContain('android-signing.json');
    expect(script).toContain("storeType 'PKCS12'");
    expect(script).toContain('debug { signingConfig signingConfigs.rbd }');
    expect(script).toContain('release { signingConfig signingConfigs.rbd }');
    // Ein pro Lauf erzeugter Schluessel waere der alte Fehler.
    expect(script).not.toContain('debug.keystore');
  });

  it('misst Signatur, Zertifikat und Paketnamen vor der Veroeffentlichung', () => {
    expect(script).toContain("['verify', '--print-certs'");
    expect(script).toContain('Signer #1 certificate SHA-256 digest');
    expect(script).toContain("sdkTool('apksigner')");
    expect(script).toContain("sdkTool('aapt2')");
    expect(script).toContain('config.appId');
    expect(script).toContain('digest.toLowerCase() !== signing.sha256');
    // Ein unsigniertes Release bricht den Lauf ab statt als Artefakt zu gelten.
    expect(script).toContain('app-release-unsigned.apk');
    expect(script).toContain('if (existsSync(unsigned) && release)');
  });

  it('veroeffentlicht nur geprueft signierte APKs', () => {
    expect(workflow).toContain('artifacts/rigged-by-design-debug.apk');
    expect(workflow).toContain('artifacts/rigged-by-design-release.apk');
    expect(workflow).not.toContain('release-unsigned');
    expect(workflow).toContain("if echo \"$assets\" | grep -q 'unsigned'");
  });
});
