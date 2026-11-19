/**
 * @test-target: src/core/sim/asset-license-check.ts
 * @error-code: ERR-1006
 *
 * Asset-Lizenz-Prüfung (Issue #658): alle 573 Assets haben aktuell keine
 * Lizenz belegt. Der Check muss das korrekt melden.
 */
import { describe, expect, it } from "vitest";
import { checkAssetLicenses, allAssetsLicensed } from "../asset-license-check";

describe("Asset-Lizenz-Prüfung (#658)", () => {
  it("meldet alle Assets ohne Lizenz (offen, #657)", () => {
    const result = checkAssetLicenses();
    expect(result.total).toBeGreaterThan(0);
    expect(result.licensed).toBe(0);
    expect(result.unlicensed).toBe(result.total);
    expect(result.unlicensedPaths.length).toBe(result.total);
  });

  it("gibt false zurück, bis Lizenzen belegt sind", () => {
    expect(allAssetsLicensed()).toBe(false);
  });
});

