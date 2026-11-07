/**
 * Domain Registry — Central registry for domain extensions.
 * Phase 1.3: Domains register event types, factor contributions,
 * narrative pools, and supported consequence commands.
 */

export interface EventTypeRegistration {
  readonly type: string;
  readonly domain: string;
  readonly description: string;
  readonly version: string;
}

export interface FactorContribution {
  readonly factorId: string;
  readonly domain: string;
  readonly defaultWeight: number; // basis points
  readonly applicableTo: string[]; // object types this factor applies to
}

export interface ConsequenceCommand {
  readonly command: string;
  readonly domain: string;
  readonly description: string;
  readonly version: string;
}

export interface DomainManifest {
  readonly domainId: string;
  readonly version: string;
  readonly eventTypes: EventTypeRegistration[];
  readonly factorContributions: FactorContribution[];
  readonly consequenceCommands: ConsequenceCommand[];
  readonly narrativePools: string[]; // pool IDs this domain contributes to
  readonly dependencies: string[]; // domain IDs this domain depends on
}

class DomainRegistry {
  private domains = new Map<string, DomainManifest>();
  private eventTypes = new Map<string, EventTypeRegistration>();
  private factorContributions = new Map<string, FactorContribution>();
  private consequenceCommands = new Map<string, ConsequenceCommand>();

  registerDomain(manifest: DomainManifest): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.domainId || !manifest.version) {
      errors.push("Domain manifest must have domainId and version");
      return { ok: false, errors };
    }

    if (this.domains.has(manifest.domainId)) {
      errors.push(`Domain ${manifest.domainId} already registered`);
      return { ok: false, errors };
    }

    // Validate event types
    for (const evt of manifest.eventTypes) {
      if (!evt.type || !evt.domain) {
        errors.push(`Invalid event type registration: missing type or domain`);
        continue;
      }
      this.eventTypes.set(evt.type, evt);
    }

    // Validate factor contributions
    for (const f of manifest.factorContributions) {
      if (!f.factorId || !f.domain) {
        errors.push(`Invalid factor contribution: missing factorId or domain`);
        continue;
      }
      this.factorContributions.set(f.factorId, f);
    }

    // Validate consequence commands
    for (const cmd of manifest.consequenceCommands) {
      if (!cmd.command || !cmd.domain) {
        errors.push(`Invalid consequence command: missing command or domain`);
        continue;
      }
      this.consequenceCommands.set(cmd.command, cmd);
    }

    if (errors.length === 0) {
      this.domains.set(manifest.domainId, manifest);
    }

    return { ok: errors.length === 0, errors };
  }

  getDomain(domainId: string): DomainManifest | undefined {
    return this.domains.get(domainId);
  }

  listDomains(): DomainManifest[] {
    return Array.from(this.domains.values());
  }

  getEventType(type: string): EventTypeRegistration | undefined {
    return this.eventTypes.get(type);
  }

  listEventTypes(): EventTypeRegistration[] {
    return Array.from(this.eventTypes.values());
  }

  getFactorContribution(factorId: string): FactorContribution | undefined {
    return this.factorContributions.get(factorId);
  }

  listFactorContributions(): FactorContribution[] {
    return Array.from(this.factorContributions.values());
  }

  getConsequenceCommand(command: string): ConsequenceCommand | undefined {
    return this.consequenceCommands.get(command);
  }

  validateCompatibility(manifest: DomainManifest): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const evt of manifest.eventTypes) {
      const existing = this.eventTypes.get(evt.type);
      if (existing && existing.domain !== evt.domain) {
        issues.push(`Event type ${evt.type} already owned by domain ${existing.domain}`);
      }
    }

    for (const f of manifest.factorContributions) {
      const existing = this.factorContributions.get(f.factorId);
      if (existing && existing.domain !== f.domain) {
        issues.push(`Factor ${f.factorId} already owned by domain ${existing.domain}`);
      }
    }

    for (const dep of manifest.dependencies) {
      if (!this.domains.has(dep)) {
        issues.push(`Dependency domain ${dep} not registered`);
      }
    }

    return { compatible: issues.length === 0, issues };
  }
}

export const domainRegistry = new DomainRegistry();