/**
 * Contract: Factor (v1.0.0)
 * Multiplicative/additive factor modifiers applied to scores, payouts, and
 * odds across domains. Merged in Phase 0.5 as a baseline contract.
 */

export interface FactorDefinition {
  readonly id: string;
  readonly domain: string;
  readonly operation: "add" | "multiply";
  readonly baseValue: number;
}

export function applyFactor(
  base: number,
  factors: FactorDefinition[]
): number {
  let result = base;
  for (const f of factors) {
    if (f.operation === "add") {
      result += f.baseValue;
    } else {
      result *= f.baseValue;
    }
  }
  return result;
}