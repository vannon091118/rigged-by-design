/**
 * Contract: actionset v1.0
 * Domain-registrierter ActionSet-Vertrag: erweiterbares Interaktionsmodell.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/actionset/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type ActionId = string;
export type ActionCategory = string;

/** Eine registrierte Aktion im ActionSet. */
export interface Action {
  readonly id: ActionId;
  readonly label: string;
  readonly icon: string;
  readonly category: ActionCategory;
  readonly priority: number;
  readonly enabled: boolean;
  readonly enabledReason?: string;
}

/** Ein Provider registriert und liefert Aktionen. */
export interface ActionProvider {
  registerAction(action: Action): void;
  getActions(): readonly Action[];
}

/** Erstellt eine neue Action. */
export function createAction(
  id: ActionId,
  label: string,
  icon: string,
  category: ActionCategory,
  priority: number,
  enabled: boolean,
  enabledReason?: string,
): Action {
  if (!id) throw new Error('actionset: id darf nicht leer sein');
  if (!label) throw new Error('actionset: label darf nicht leer sein');
  if (!icon) throw new Error('actionset: icon darf nicht leer sein');
  if (!category) throw new Error('actionset: category darf nicht leer sein');
  if (!Number.isInteger(priority)) throw new Error('actionset: priority muss eine ganze Zahl sein');
  if (!enabled && (!enabledReason || !enabledReason.trim())) {
    throw new Error('actionset: enabled === false erfordert einen nicht-leeren enabledReason');
  }
  return { id, label, icon, category, priority, enabled, enabledReason };
}

/** Prüft, ob eine Action die Invarianten erfüllt. */
export function validateAction(action: Action): boolean {
  if (!action.id || typeof action.id !== 'string') return false;
  if (!action.label || typeof action.label !== 'string') return false;
  if (!action.icon || typeof action.icon !== 'string') return false;
  if (!action.category || typeof action.category !== 'string') return false;
  if (!Number.isInteger(action.priority)) return false;
  if (typeof action.enabled !== 'boolean') return false;
  if (!action.enabled && (!action.enabledReason || !action.enabledReason.trim())) return false;
  if (action.enabled && action.enabledReason !== undefined) return false;
  return true;
}
