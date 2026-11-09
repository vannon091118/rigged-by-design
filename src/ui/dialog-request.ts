/**
 * Dialog-Anforderung aus einem Choice-Ergebnis.
 *
 * TRIGGER_DIALOG schreibt bewusst keinen Weltzustand (der Dialog haelt ueber
 * Speichern/Laden nichts); der einzige Uebergabepunkt ist das ausgefuehrte
 * Command im `ChoiceExecution`. Der Router oeffnet daraus das referenzierte
 * Skript, sonst passiert nichts.
 */
import type { ChoiceExecution } from '../core/sim/narrative/commands/types';

export function dialogIdFromExecution(result: ChoiceExecution | null | undefined): string | null {
  if (!result?.ok) return null;
  const trigger = result.commands.find((command) => command.id === 'TRIGGER_DIALOG');
  return trigger?.id === 'TRIGGER_DIALOG' ? trigger.dialogId : null;
}
