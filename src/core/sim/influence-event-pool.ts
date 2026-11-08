/** Balancebare Auswahlregeln des Main-Event-Pools; Teil der Influence-Config. */
export interface EventPoolEntry {
  /** Name des Matrix-Kontexts, der dieses Pool-Event gewichtet. */
  readonly context: string;
  /** Grundgewicht vor Matrix und Wiederholungsdaempfung. */
  readonly baseWeight: number;
}

export interface EventPoolConfig {
  readonly chance: number;
  readonly idleCooldownTicks: number;
  readonly recencyWindowTicks: number;
  readonly recencyPenalty: number;
  readonly repeatLockout: number;
  readonly weightFloor: number;
  readonly events: Readonly<Record<string, EventPoolEntry>>;
}

/** Fail-closed: eine unlesbare Pool-Config darf nie still weiterlaufen. */
export function validateEventPool(pool: EventPoolConfig, contexts: Readonly<Record<string, unknown>>): void {
  if (!pool) throw new Error('Einfluss-Matrix: Event-Pool fehlt.');
  if (!Number.isFinite(pool.chance) || pool.chance < 0 || pool.chance > 1) {
    throw new Error('Einfluss-Matrix: Pool-Chance muss in 0..1 liegen.');
  }
  for (const key of ['idleCooldownTicks', 'recencyWindowTicks', 'repeatLockout'] as const) {
    if (!Number.isSafeInteger(pool[key]) || pool[key] < 0) {
      throw new Error(`Einfluss-Matrix: Pool-Regel ${key} ist ungueltig.`);
    }
  }
  for (const key of ['recencyPenalty', 'weightFloor'] as const) {
    if (!Number.isFinite(pool[key]) || pool[key] < 0 || pool[key] > 1) {
      throw new Error(`Einfluss-Matrix: Pool-Regel ${key} muss in 0..1 liegen.`);
    }
  }
  if (Object.keys(pool.events).length === 0) throw new Error('Einfluss-Matrix: Pool hat keine Events.');
  for (const [eventId, entry] of Object.entries(pool.events)) {
    if (!Object.hasOwn(contexts, entry.context)) {
      throw new Error(`Einfluss-Matrix: Pool-Event ${eventId} nutzt unbekannten Kontext ${entry.context}.`);
    }
    if (!Number.isFinite(entry.baseWeight) || entry.baseWeight <= 0) {
      throw new Error(`Einfluss-Matrix: Pool-Event ${eventId} hat kein gueltiges Grundgewicht.`);
    }
  }
}
