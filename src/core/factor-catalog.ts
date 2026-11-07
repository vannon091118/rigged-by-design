/**
 * Factor Catalog — Phase 3
 * Ein kleiner, verständlicher Satz gemeinsamer Faktoren für Beziehungen.
 * Reine Übersetzungsfunktionen wandeln Rohwerte in kontextabhängige Factors um.
 *
 * Kein Factor-Katalog existierte zuvor — Beziehungen wurden nur als
 * gerichtete Kanten mit einfachem Score verwaltet.
 */

export type FactorCategory =
  | "social"
  | "economic"
  | "emotional"
  | "reputational"
  | "familial"
  | "professional"
  | "psychological"
  | "behavioral";

export type FactorContext =
  | "casino"
  | "social"
  | "work"
  | "everyday"
  | "romantic"
  | "conflict";

export interface FactorDefinition {
  readonly id: string;
  readonly category: FactorCategory;
  readonly label: string;
  readonly description: string;
  readonly baseWeightBps: number; // Basisgewicht in Basis-Punkten (-10000..10000)
  readonly applicableContexts: FactorContext[];
  readonly maxApplicableScore: number; // Obergrenze für den Einfluss auf den Score
  readonly decayPerTick?: number;    // Abbau pro Tick (optional, für temporäre Faktoren)
}

export interface FactorContribution {
  readonly factorId: string;
  readonly weightBps: number;   // Übersetztes Gewicht (nach Kontext-Anpassung)
  readonly appliedAtTick: number;
  readonly sourceContext: FactorContext;
  readonly source: string;      // Was hat den Faktor ausgelöst (z. B. "gift", "insult")
}

export interface FactorCatalogConfig {
  readonly defaultDecayPerTick: number;
  readonly contextModifiers: Record<FactorContext, Record<string, number>>; // context -> factorId -> multiplier
}

export const DEFAULT_FACTOR_CATALOG: FactorDefinition[] = [
  // Soziale Faktoren
  {
    id: "gift.given",
    category: "social",
    label: "Geschenk erhalten",
    description: "Ein Geschenk wurde überreicht",
    baseWeightBps: 500,
    applicableContexts: ["social", "everyday", "romantic"],
    maxApplicableScore: 30,
    decayPerTick: 1,
  },
  {
    id: "gift.received",
    category: "social",
    label: "Geschenk gegeben",
    description: "Ein Geschenk wurde erhalten",
    baseWeightBps: 300,
    applicableContexts: ["social", "everyday", "romantic"],
    maxApplicableScore: 20,
    decayPerTick: 1,
  },
  {
    id: "compliment",
    category: "emotional",
    label: "Kompliment",
    description: "Ein aufrichtiges Kompliment",
    baseWeightBps: 200,
    applicableContexts: ["social", "romantic"],
    maxApplicableScore: 15,
    decayPerTick: 2,
  },
  {
    id: "insult",
    category: "emotional",
    label: "Beleidigung",
    description: "Eine Beleidigung wurde ausgesprochen",
    baseWeightBps: -500,
    applicableContexts: ["social", "conflict"],
    maxApplicableScore: -25,
    decayPerTick: 2,
  },
  {
    id: "conflict.resolved",
    category: "social",
    label: "Konflikt gelöst",
    description: "Ein Konflikt wurde beigelegt",
    baseWeightBps: 400,
    applicableContexts: ["conflict", "social"],
    maxApplicableScore: 25,
    decayPerTick: 1,
  },
  {
    id: "betrayal",
    category: "emotional",
    label: "Verrat",
    description: "Ein Vertrauensbruch",
    baseWeightBps: -1500,
    applicableContexts: ["social", "romantic", "conflict"],
    maxApplicableScore: -50,
  },
  // Wirtschaftliche Faktoren
  {
    id: "loan.repaid",
    category: "economic",
    label: "Darlehen zurückgezahlt",
    description: "Ein Darlehen wurde pünktlich zurückgezahlt",
    baseWeightBps: 300,
    applicableContexts: ["work", "everyday"],
    maxApplicableScore: 20,
    decayPerTick: 1,
  },
  {
    id: "loan.defaulted",
    category: "economic",
    label: "Darlehen nicht zurückgezahlt",
    description: "Ein Darlehen wurde nicht zurückgezahlt",
    baseWeightBps: -800,
    applicableContexts: ["work", "conflict"],
    maxApplicableScore: -40,
    decayPerTick: 1,
  },
  {
    id: "favor.done",
    category: "social",
    label: "Gefallen getan",
    description: "Ein Gefallen wurde erwiesen",
    baseWeightBps: 400,
    applicableContexts: ["social", "everyday", "work"],
    maxApplicableScore: 30,
    decayPerTick: 1,
  },
  // Berufliche Faktoren
  {
    id: "promotion",
    category: "professional",
    label: "Beförderung",
    description: "Eine Beförderung wurde erhalten",
    baseWeightBps: 600,
    applicableContexts: ["work"],
    maxApplicableScore: 40,
    decayPerTick: 1,
  },
  {
    id: "demotion",
    category: "professional",
    label: "Degradierung",
    description: "Eine Degradierung wurde erhalten",
    baseWeightBps: -600,
    applicableContexts: ["work", "conflict"],
    maxApplicableScore: -40,
    decayPerTick: 1,
  },
  // Familiäre Faktoren
  {
    id: "family.support",
    category: "familial",
    label: "Familienunterstützung",
    description: "Unterstützung durch die Familie",
    baseWeightBps: 500,
    applicableContexts: ["everyday", "romantic"],
    maxApplicableScore: 35,
    decayPerTick: 1,
  },
  {
    id: "family.conflict",
    category: "familial",
    label: "Familienkonflikt",
    description: "Ein Konflikt innerhalb der Familie",
    baseWeightBps: -700,
    applicableContexts: ["conflict", "everyday"],
    maxApplicableScore: -45,
    decayPerTick: 1,
  },
  // ── Phase 3.2: Allgemeine weiche Entscheidungs-Faktoren ──
  // Diese Faktoren dienen weichen Simulationsentscheidungen (Aktivitätswahl,
  // Angebotsbewertung, Rückkehrwahrscheinlichkeit, soziale Reaktionen).
  // Sie sind KEINE Raums- oder Objektrollen (food, gambling, retail.clothing
  // werden ausdrücklich NICHT in den Katalog aufgenommen).

  {
    id: "tension",
    category: "psychological",
    label: "Spannung",
    description: "Innere Anspannung oder Unruhe eines Akteurs in einer Situation",
    baseWeightBps: 0,
    applicableContexts: ["casino", "social", "conflict", "work", "everyday", "romantic"],
    maxApplicableScore: 100,
    decayPerTick: 2,
  },
  {
    id: "engagement",
    category: "behavioral",
    label: "Engagement",
    description: "Grad der aktiven Beteiligung an einer Aktivität oder Interaktion",
    baseWeightBps: 0,
    applicableContexts: ["casino", "social", "work", "everyday", "romantic"],
    maxApplicableScore: 100,
    decayPerTick: 1,
  },
  {
    id: "capability",
    category: "behavioral",
    label: "Fähigkeit",
    description: "Eingeschätzte Fähigkeit eines Akteurs, eine Aufgabe zu erfüllen",
    baseWeightBps: 0,
    applicableContexts: ["work", "everyday", "casino"],
    maxApplicableScore: 100,
  },
  {
    id: "socialOpenness",
    category: "psychological",
    label: "Soziale Offenheit",
    description: "Bereitschaft, auf soziale Interaktionen einzugehen",
    baseWeightBps: 0,
    applicableContexts: ["social", "everyday", "romantic"],
    maxApplicableScore: 100,
    decayPerTick: 1,
  },
  {
    id: "compliance",
    category: "behavioral",
    label: "Compliance",
    description: "Bereitschaft, Regeln, Anweisungen oder Normen zu folgen",
    baseWeightBps: 0,
    applicableContexts: ["work", "casino", "social", "everyday"],
    maxApplicableScore: 100,
  },
  {
    id: "rapport",
    category: "social",
    label: "Rapport",
    description: "Zielbezogene stimmige Verbindung zwischen zwei Akteuren",
    baseWeightBps: 0,
    applicableContexts: ["social", "romantic", "work", "everyday"],
    maxApplicableScore: 100,
    decayPerTick: 1,
  },
  {
    id: "resistance",
    category: "psychological",
    label: "Widerstand",
    description: "Zielbezogener Widerstand gegen eine Handlung oder Einflussnahme",
    baseWeightBps: 0,
    applicableContexts: ["social", "conflict", "work", "everyday"],
    maxApplicableScore: 100,
    decayPerTick: 2,
  },
  // Reputational Faktoren
  {
    id: "reputation.damaged",
    category: "reputational",
    label: "Ruf geschädigt",
    description: "Der Ruf eines Akteurs wurde beschädigt",
    baseWeightBps: -600,
    applicableContexts: ["social", "conflict", "work"],
    maxApplicableScore: -40,
    decayPerTick: 1,
  },
  {
    id: "reputation.enhanced",
    category: "reputational",
    label: "Ruf verbessert",
    description: "Der Ruf eines Akteurs wurde verbessert",
    baseWeightBps: 600,
    applicableContexts: ["social", "work"],
    maxApplicableScore: 40,
    decayPerTick: 1,
  },
];

export const DEFAULT_FACTOR_CATALOG_CONFIG: FactorCatalogConfig = {
  defaultDecayPerTick: 1,
  contextModifiers: {
    casino: {
      "gift.given": 1.2,       // Geschenke im Casino wirken stärker
      "insult": 1.5,           // Beleidigungen im Casino wirken stärker negativ
      "betrayal": 1.3,
    },
    social: {
      "compliment": 1.1,
      "favor.done": 1.2,
    },
    work: {
      "loan.repaid": 1.3,
      "promotion": 1.4,
    },
    everyday: {},
    romantic: {
      "gift.received": 1.5,
      "compliment": 1.3,
    },
    conflict: {
      "insult": 1.4,
      "betrayal": 1.5,
    },
  },
};

export class FactorCatalog {
  private factors = new Map<string, FactorDefinition>();
  private config: FactorCatalogConfig;

  constructor(factors: FactorDefinition[] = [], config: Partial<FactorCatalogConfig> = {}) {
    for (const f of factors) {
      this.factors.set(f.id, f);
    }
    this.config = { ...DEFAULT_FACTOR_CATALOG_CONFIG, ...config };
  }

  // ── Katalog-Verwaltung ─────────────────────────────────────

  registerFactor(factor: FactorDefinition): { ok: boolean; error?: string } {
    if (this.factors.has(factor.id)) {
      return { ok: false, error: `Factor ${factor.id} already registered` };
    }
    if (Math.abs(factor.baseWeightBps) > 10000) {
      return { ok: false, error: `Factor ${factor.id} baseWeightBps out of range [-10000, 10000]` };
    }
    this.factors.set(factor.id, factor);
    return { ok: true };
  }

  getFactor(factorId: string): FactorDefinition | undefined {
    return this.factors.get(factorId);
  }

  listFactors(): FactorDefinition[] {
    return Array.from(this.factors.values());
  }

  listFactorsByCategory(category: FactorCategory): FactorDefinition[] {
    return Array.from(this.factors.values()).filter((f) => f.category === category);
  }

  listFactorsByContext(context: FactorContext): FactorDefinition[] {
    return Array.from(this.factors.values()).filter((f) =>
      f.applicableContexts.includes(context)
    );
  }

  // ── Kontext-Modifikator ────────────────────────────────────

  getContextModifier(context: FactorContext, factorId: string): number {
    const modifiers = this.config.contextModifiers[context];
    return modifiers?.[factorId] ?? 1.0;
  }

  setContextModifier(context: FactorContext, factorId: string, multiplier: number): void {
    if (!this.config.contextModifiers[context]) {
      this.config.contextModifiers[context] = {};
    }
    this.config.contextModifiers[context][factorId] = multiplier;
  }
}

export const factorCatalog = new FactorCatalog(DEFAULT_FACTOR_CATALOG);