/**
 * Domain Event Model — Phase 2.2
 * Allgemeines Domain-Event-Modell mit Consumer-Lebenszyklus.
 *
 * Event-Hülle: stabile Event-ID, Typ, Domain, WorldTime, Quelle, Beteiligte,
 * versionierter Payload und Korrelationsbezug.
 *
 * Unterscheidung: Domain Event, Narrative Fact, Narrative Instance, Command,
 * Spieleraktion.
 *
 * Deterministische Zustellung, Reihenfolge, Idempotenz und Deduplizierung.
 * Unabhängige Consumer-Cursor für Relationship, Memory, Economy/Resources,
 * NPC-Reaktion und Narrative.
 */

import type { WorldTime } from "./worldtime";
import type { EventType } from "../domain-event";

/**
 * Event-Hülle — die allgemeine Struktur jedes Domain-Events.
 */
export interface EventEnvelope<E extends EventType = EventType> {
  readonly eventId: string;           // stabile, eindeutige Event-ID
  readonly type: E;                   // Event-Typ
  readonly domain: string;            // zugehörige Domain (casino, social, work, ...)
  readonly worldTime: WorldTime;      // Weltzeit zum Erstellungszeitpunkt
  readonly source: string;            // Quelle des Events (Gerät, Lager, Personal, ...)
  readonly participants: string[];    // beteiligte Actor-IDs
  readonly payloadVersion: number;    // Version des Payload-Schemas
  readonly payload: Record<string, unknown>; // versionierter Payload
  readonly correlationId?: string;    // Korrelationsbezug (z. B. über Command-Kette)
  readonly causationId?: string;      // auslösendes Event (für Kette)
  readonly timestampMs: number;       // Erstellungszeit (Wall-Clock, nur Debug)
}

/**
 * Arten von Ereignissen im System.
 */
export type EventKind =
  | "domain-event"     // fachliches Ereignis (Domäne hat sich geändert)
  | "narrative-fact"   // narrativer Fakt (Beobachtung, Gerücht)
  | "narrative-instance" // konkrete Instanz einer Narrative
  | "command"          // auszuführender Befehl (Command)
  | "player-action";   // direkte Spieleraktion

export interface TypedEventEnvelope<E extends EventType = EventType> extends EventEnvelope<E> {
  readonly kind: EventKind;
}

/**
 * Erstellt ein typisches Domain-Event mit vollständiger Hülle.
 */
export function createEventEnvelope<E extends EventType>(
  eventId: string,
  kind: EventKind,
  type: E,
  domain: string,
  worldTime: WorldTime,
  source: string,
  participants: string[],
  payload: Record<string, unknown>,
  payloadVersion: number,
  correlationId?: string,
  causationId?: string
): TypedEventEnvelope<E> {
  return {
    eventId,
    type,
    domain,
    worldTime,
    source,
    participants,
    payloadVersion,
    payload,
    correlationId,
    causationId,
    timestampMs: worldTime.ms,
    kind,
  };
}

/**
 * Fehlende Eventquellen aus der Main-Roadmap — hier registriert.
 * Diese Quellen erzeugen echte Zustandsübergänge und dürfen nicht fehlen.
 */
export const EVENT_SOURCES = {
  DEVICE: "device",
  INVENTORY: "inventory",
  PERSONNEL: "personnel",
  PLAYER: "player",
  WORLD: "world",
  SYSTEM: "system",
} as const;

/**
 * TRIGGER_DIALOG Entscheidung:
 * Da TRIGGER_DIALOG executable: false hat und es keine Dialog-UI gibt,
 * wird es aus dem aktiven Content-Pfad ausgeschlossen. Es kann weiterhin
 * als Domain-Event protokolliert werden, löst aber keine Dialog-Renderung aus.
 */
export const TRIGGER_DIALOG_EXECUTABLE = false;

export function isTriggerDialogExecutable(): boolean {
  return TRIGGER_DIALOG_EXECUTABLE;
}