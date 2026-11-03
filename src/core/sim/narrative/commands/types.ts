/** Typisierte Event-Commands: Text wird zu AST, nie zu ausfuehrbarem Code. */
import type { NarrativeEventInstance } from '../event-types';
import type {
  ChoiceActor, ChoiceBlockReason, EventChoice, EventTemplate,
} from '../events/template-types';
import type { RelationshipDimension } from '../trigger-types';

export const COMMAND_LIMITS = {
  directives: 8,
  directiveLength: 240,
  freezeTicks: 200,
  flagAbsolute: 1_000_000,
} as const;

export type CommandId = 'SET_FLAG' | 'ADJUST_RELATIONSHIP' | 'FREEZE_TICK' | 'TRIGGER_DIALOG';
export type CommandFamily = 'STORY' | 'RELATIONSHIP' | 'EVENT' | 'DIALOG';

/** Die Registry ist die Allowlist; unbekannte IDs kommen hier nie an. */
export type CommandRejectReason =
  | ChoiceBlockReason
  | 'UNKNOWN_COMMAND'
  | 'INVALID_ARGS'
  | 'COMMAND_NOT_ALLOWED'
  | 'INVALID_TARGET'
  | 'NOT_EXECUTABLE'
  | 'INVALID_EVENT'
  | 'DUPLICATE_EXECUTION';

export type DirectiveScalar = string | number | boolean;

/** Rohes, noch nicht gegen die Registry kompiliertes AST. */
export interface ParsedDirective {
  readonly commandId: string;
  readonly positional: readonly DirectiveScalar[];
  readonly named: Readonly<Record<string, DirectiveScalar>>;
  readonly raw: string;
}

export type DirectiveParseCode = 'MALFORMED' | 'TOO_LONG' | 'TOO_MANY' | 'DUPLICATE_ARG';

export interface DirectiveParseError {
  readonly code: DirectiveParseCode;
  readonly raw: string;
}

export interface DirectiveParseResult {
  readonly directives: readonly ParsedDirective[];
  readonly errors: readonly DirectiveParseError[];
}

/** Validierte, typisierte Commands; nur diese Form erreicht einen Handler. */
export type NarrativeCommand =
  | { readonly id: 'SET_FLAG'; readonly flag: string; readonly delta: number }
  | {
    readonly id: 'ADJUST_RELATIONSHIP';
    readonly from: ChoiceActor;
    readonly to: ChoiceActor;
    readonly dimension: RelationshipDimension;
    readonly delta: number;
  }
  | { readonly id: 'FREEZE_TICK'; readonly ticks: number }
  | { readonly id: 'TRIGGER_DIALOG'; readonly dialogId: string };

export interface CommandRejection {
  readonly commandId: string;
  readonly reason: CommandRejectReason;
  readonly detail: string;
}

export interface DirectiveValidation {
  readonly commands: readonly NarrativeCommand[];
  readonly rejections: readonly CommandRejection[];
}

export interface ChoicePlan {
  readonly event: NarrativeEventInstance;
  readonly template: EventTemplate;
  readonly choice: EventChoice;
  readonly commands: readonly NarrativeCommand[];
  readonly cost: number;
}

export type ChoicePreflight =
  | { readonly ok: true; readonly plan: ChoicePlan }
  | {
    readonly ok: false;
    readonly event: NarrativeEventInstance | null;
    readonly rejections: readonly CommandRejection[];
  };

export interface ChoiceExecution {
  readonly ok: boolean;
  readonly event: NarrativeEventInstance | null;
  readonly commands: readonly NarrativeCommand[];
  readonly cost: number;
  readonly rejections: readonly CommandRejection[];
}
