/**
 * Asset-Lizenz-Prüfung (Issue #658).
 * Prüft, ob alle im Inventar erfassten Assets eine Lizenz belegt haben.
 * Ergebnis: Liste der Assets ohne Lizenz + Zusammenfassung.
 */
import { ASSET_INVENTORY, ASSET_LICENSES } from "./asset-license-inventory";

export interface LicenseCheckResult {
  readonly total: number;
  readonly licensed: number;
  readonly unlicensed: number;
  readonly unlicensedPaths: readonly string[];
}

/** Prüft alle Assets auf Lizenzdeckung. */
export function checkAssetLicenses(): LicenseCheckResult {
  const unlicensed: string[] = [];
  let licensed = 0;

  for (const asset of ASSET_INVENTORY) {
    if (ASSET_LICENSES.has(asset)) {
      licensed += 1;
    } else {
      unlicensed.push(asset);
    }
  }

  return {
    total: ASSET_INVENTORY.length,
    licensed,
    unlicensed: unlicensed.length,
    unlicensedPaths: unlicensed,
  };
}

/** Gibt true zurück, wenn jedes Asset eine Lizenz hat. */
export function allAssetsLicensed(): boolean {
  return checkAssetLicenses().unlicensed === 0;
}
