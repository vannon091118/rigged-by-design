/**
 * Communication Domain — Phase 5.1-5.4
 * Vollständige Kommunikations-Domain mit:
 * - Erweiterte Anruf-Status (ignored, callback, rejected)
 * - Kontaktmuster (Frequenz, Gegenseitigkeit, Anlass, Verlauf)
 * - Domain Event Integration
 * - Weltzeit/Calendar-Kopplung (Erreichbarkeit, Ruhezeiten)
 * - NPC-Kontaktinitiative mit Persönlichkeitstypen
 * - Gesprächsverläufe mit Spielerentscheidungen
 */

import type { WorldTime } from "../sim/worldtime";
import type { CalendarDate } from "../sim/calendar";
import type { ActorId } from "../actor-id";
import { createDomainEvent } from "../domain-event";

// ──────────────────────────────────────────────────────────────────────────────
// Typen — Erweiterte Kommunikation
// ──────────────────────────────────────────────────────────────────────────────

export type CommunicationType = "call" | "message";

export type CommunicationDirection = "inbound" | "outbound";

export type CommunicationStatus =
  | "pending"
  | "ringing"
  | "active"
  | "completed"
  | "missed"
  | "failed"
  | "blocked"
  | "ignored"
  | "callback"
  | "rejected";

export type MessageStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type NPCPersonality =
  | "contact-friendly"
  | "reserved"
  | "grudge-holding"
  | "busy"
  | "spontaneous";

export type CallOccasion = "casual" | "urgent" | "appointment" | "emergency" | "social";

export interface Contact {
  readonly actorId: string;
  readonly displayName: string;
  readonly relationshipScore: number; // -100 .. 100
  readonly lastContactTick?: number;
  readonly contactCount: number;
  readonly blocked: boolean;
  readonly favorite: boolean;
  readonly personality?: NPCPersonality;
  readonly preferredContactHours?: { start: number; end: number }; // 0-23
}

export interface ContactPattern {
  readonly actorId: string;
  readonly contactFrequency: number; // Kontakte pro 100 Ticks
  readonly reciprocityScore: number; // -100 .. 100 (wie viel der Kontakt erwidert)
  readonly lastOccasion?: CallOccasion;
  readonly recentHistory: string[]; // letzte Status-IDs
  readonly updatedAtTick: number;
}

export interface Call {
  readonly callId: string;
  readonly direction: CommunicationDirection;
  readonly callerId: string;
  readonly calleeId: string;
  readonly status: CommunicationStatus;
  readonly occasion?: CallOccasion;
  readonly startedAtTick?: number;
  readonly endedAtTick?: number;
  readonly durationTicks: number;
  readonly missedReason?: string;
  readonly callbackScheduledAt?: number; // für Rückruf
}

export interface Message {
  readonly messageId: string;
  readonly direction: CommunicationDirection;
  readonly senderId: string;
  readonly recipientId: string;
  readonly content: string;
  readonly status: MessageStatus;
  readonly sentAtTick: number;
  readonly deliveredAtTick?: number;
  readonly readAtTick?: number;
}

export interface CommunicationEvent {
  readonly eventId: string;
  readonly type: CommunicationType;
  readonly worldTime: WorldTime;
  readonly participants: string[];
  readonly payload: Record<string, unknown>;
}

export interface ConversationFlow {
  readonly flowId: string;
  readonly callId: string;
  readonly participantId: string;
  readonly stage: "greeting" | "topic" | "decision" | "closing";
  readonly playerChoice?: string;
  readonly consequence?: string;
  readonly completedAtTick?: number;
}

export interface NPCContactInitiative {
  readonly npcId: string;
  readonly personality: NPCPersonality;
  readonly contactCooldownTicks: number;
  readonly lastContactTick?: number;
  readonly preferredOccasions: CallOccasion[];
  readonly maxContactsPerDay: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Konfiguration
// ──────────────────────────────────────────────────────────────────────────────

export interface CommunicationConfig {
  readonly maxCallDurationTicks: number;
  readonly maxMessageLength: number;
  readonly ringTimeoutTicks: number;
  readonly quietHoursStart: number; // 0-23
  readonly quietHoursEnd: number; // 0-23
  readonly defaultContactCooldownTicks: number;
}

export const DEFAULT_COMMUNICATION_CONFIG: CommunicationConfig = {
  maxCallDurationTicks: 3600,
  maxMessageLength: 1000,
  ringTimeoutTicks: 30,
  quietHoursStart: 22, // 22:00
  quietHoursEnd: 7, // 07:00
  defaultContactCooldownTicks: 600, // 1 Tag bei 600 Ticks/Tag
};

// ──────────────────────────────────────────────────────────────────────────────
// Kommunikations-Domain
// ──────────────────────────────────────────────────────────────────────────────

export class CommunicationDomain {
  private contacts = new Map<string, Contact>();
  private calls = new Map<string, Call>();
  private messages = new Map<string, Message>();
  private contactPatterns = new Map<string, ContactPattern>();
  private conversationFlows = new Map<string, ConversationFlow>();
  private npcInitiatives = new Map<string, NPCContactInitiative>();
  private emittedEvents: CommunicationEvent[] = [];
  private readonly config: CommunicationConfig;
  private nextCallId = 0;
  private nextMessageId = 0;
  private nextFlowId = 0;

  constructor(config: Partial<CommunicationConfig> = {}) {
    this.config = { ...DEFAULT_COMMUNICATION_CONFIG, ...config };
  }

  // ── Kontakte ─────────────────────────────────────────────────

  upsertContact(contact: Contact): void {
    this.contacts.set(contact.actorId, contact);
  }

  getContact(actorId: string): Contact | undefined {
    return this.contacts.get(actorId);
  }

  listContacts(): Contact[] {
    return Array.from(this.contacts.values());
  }

  blockContact(actorId: string): { ok: boolean; error?: string } {
    const contact = this.contacts.get(actorId);
    if (!contact) {
      return { ok: false, error: `Contact ${actorId} not found` };
    }
    this.contacts.set(actorId, { ...contact, blocked: true });
    return { ok: true };
  }

  unblockContact(actorId: string): { ok: boolean; error?: string } {
    const contact = this.contacts.get(actorId);
    if (!contact) {
      return { ok: false, error: `Contact ${actorId} not found` };
    }
    this.contacts.set(actorId, { ...contact, blocked: false });
    return { ok: true };
  }

  // ── Erreichbarkeit & Ruhezeiten ──────────────────────────────

  /**
   * Prüft ob ein Akteur zu einer gegebenen Weltzeit erreichbar ist.
   * Berücksichtigt Ruhezeiten und bevorzugte Kontaktstunden.
   */
  isReachable(actorId: string, worldTime: WorldTime, calendar: CalendarDate): {
    reachable: boolean;
    reason?: string;
  } {
    const contact = this.contacts.get(actorId);
    if (!contact) {
      return { reachable: false, reason: "Contact not found" };
    }
    if (contact.blocked) {
      return { reachable: false, reason: "Contact blocked" };
    }

    // Ruhezeiten prüfen
    const hour = parseInt(calendar.timeOfDay.split(":")[0], 10);
    if (
      (this.config.quietHoursStart > this.config.quietHoursEnd &&
        (hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd)) ||
      (this.config.quietHoursStart <= this.config.quietHoursEnd &&
        hour >= this.config.quietHoursStart &&
        hour < this.config.quietHoursEnd)
    ) {
      if (!contact.favorite) {
        return { reachable: false, reason: "Quiet hours" };
      }
    }

    // Bevorzugte Kontaktstunden prüfen
    if (contact.preferredContactHours) {
      const { start, end } = contact.preferredContactHours;
      if (hour < start || hour >= end) {
        return { reachable: false, reason: "Outside preferred contact hours" };
      }
    }

    return { reachable: true };
  }

  // ── Anrufe ───────────────────────────────────────────────────

  startCall(
    callerId: string,
    calleeId: string,
    worldTime: WorldTime,
    occasion: CallOccasion = "casual"
  ): { ok: boolean; call?: Call; error?: string; event?: CommunicationEvent } {
    const callee = this.contacts.get(calleeId);
    if (!callee) {
      return { ok: false, error: `Contact ${calleeId} not found` };
    }
    if (callee.blocked) {
      return { ok: false, error: `Contact ${calleeId} is blocked` };
    }

    const callId = `call-${this.nextCallId++}`;
    const call: Call = {
      callId,
      direction: "outbound",
      callerId,
      calleeId,
      status: "ringing",
      occasion,
      durationTicks: 0,
    };

    this.calls.set(callId, call);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}`,
      type: "call",
      worldTime,
      participants: [callerId, calleeId],
      payload: {
        callId,
        direction: "outbound",
        occasion,
        status: "ringing",
        initiatedBy: callerId,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, call, event };
  }

  answerCall(callId: string, worldTime: WorldTime): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "ringing") {
      return { ok: false, error: `Call ${callId} is not ringing` };
    }

    const answered: Call = {
      ...call,
      status: "active",
      startedAtTick: worldTime.tick,
    };
    this.calls.set(callId, answered);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-answered`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        direction: call.direction,
        status: "active",
        answeredBy: worldTime.tick,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  rejectCall(callId: string, worldTime: WorldTime): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "ringing") {
      return { ok: false, error: `Call ${callId} is not ringing` };
    }

    const rejected: Call = {
      ...call,
      status: "rejected",
      endedAtTick: worldTime.tick,
    };
    this.calls.set(callId, rejected);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-rejected`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        direction: call.direction,
        status: "rejected",
        rejectedBy: worldTime.tick,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  ignoreCall(callId: string, worldTime: WorldTime): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "ringing") {
      return { ok: false, error: `Call ${callId} is not ringing` };
    }

    const ignored: Call = {
      ...call,
      status: "ignored",
      endedAtTick: worldTime.tick,
    };
    this.calls.set(callId, ignored);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-ignored`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        direction: call.direction,
        status: "ignored",
        ignoredBy: worldTime.tick,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  endCall(
    callId: string,
    worldTime: WorldTime
  ): { ok: boolean; call?: Call; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status === "completed" || call.status === "missed" || call.status === "rejected" || call.status === "ignored") {
      return { ok: false, error: `Call ${callId} already ended` };
    }

    const startedAt = call.startedAtTick ?? worldTime.tick;
    const durationTicks = Math.max(0, worldTime.tick - startedAt);

    const ended: Call = {
      ...call,
      status: "completed",
      endedAtTick: worldTime.tick,
      durationTicks,
    };
    this.calls.set(callId, ended);

    this.updateContactActivity(call.calleeId, worldTime.tick);
    this.updateContactActivity(call.callerId, worldTime.tick);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-completed`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        direction: call.direction,
        status: "completed",
        durationTicks,
        occasion: call.occasion,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, call: ended, event };
  }

  missCall(callId: string, worldTime: WorldTime): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "ringing") {
      return { ok: false, error: `Call ${callId} is not ringing` };
    }

    const missed: Call = {
      ...call,
      status: "missed",
      endedAtTick: worldTime.tick,
      missedReason: "ring_timeout",
    };
    this.calls.set(callId, missed);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-missed`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        direction: call.direction,
        status: "missed",
        missedReason: "ring_timeout",
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  scheduleCallback(
    callId: string,
    worldTime: WorldTime,
    callbackAtTick: number
  ): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "missed" && call.status !== "rejected" && call.status !== "ignored") {
      return { ok: false, error: `Call ${callId} is not in a callback-eligible state` };
    }

    const withCallback: Call = {
      ...call,
      status: "callback",
      callbackScheduledAt: callbackAtTick,
    };
    this.calls.set(callId, withCallback);

    const event: CommunicationEvent = {
      eventId: `evt-${callId}-callback`,
      type: "call",
      worldTime,
      participants: [call.callerId, call.calleeId],
      payload: {
        callId,
        status: "callback",
        scheduledAtTick: callbackAtTick,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  getCall(callId: string): Call | undefined {
    return this.calls.get(callId);
  }

  listCalls(actorId?: string): Call[] {
    const all = Array.from(this.calls.values());
    if (!actorId) return all;
    return all.filter((c) => c.callerId === actorId || c.calleeId === actorId);
  }

  // ── Nachrichten ──────────────────────────────────────────────

  sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
    worldTime: WorldTime
  ): { ok: boolean; message?: Message; error?: string; event?: CommunicationEvent } {
    if (!content || content.length === 0) {
      return { ok: false, error: "Message content cannot be empty" };
    }
    if (content.length > this.config.maxMessageLength) {
      return { ok: false, error: `Message too long (max ${this.config.maxMessageLength} chars)` };
    }

    const recipient = this.contacts.get(recipientId);
    if (!recipient) {
      return { ok: false, error: `Contact ${recipientId} not found` };
    }
    if (recipient.blocked) {
      return { ok: false, error: `Contact ${recipientId} is blocked` };
    }

    const messageId = `msg-${this.nextMessageId++}`;
    const message: Message = {
      messageId,
      direction: "outbound",
      senderId,
      recipientId,
      content,
      status: "sent",
      sentAtTick: worldTime.tick,
    };

    this.messages.set(messageId, message);

    const delivered: Message = {
      ...message,
      status: "delivered",
      deliveredAtTick: worldTime.tick,
    };
    this.messages.set(messageId, delivered);

    this.updateContactActivity(recipientId, worldTime.tick);
    this.updateContactActivity(senderId, worldTime.tick);

    const event: CommunicationEvent = {
      eventId: `evt-${messageId}`,
      type: "message",
      worldTime,
      participants: [senderId, recipientId],
      payload: {
        messageId,
        direction: "outbound",
        status: "delivered",
        contentLength: content.length,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, message: delivered, event };
  }

  readMessage(messageId: string, worldTime: WorldTime): { ok: boolean; error?: string; event?: CommunicationEvent } {
    const message = this.messages.get(messageId);
    if (!message) {
      return { ok: false, error: `Message ${messageId} not found` };
    }
    if (message.status === "read") {
      return { ok: false, error: `Message ${messageId} already read` };
    }

    const read: Message = {
      ...message,
      status: "read",
      readAtTick: worldTime.tick,
    };
    this.messages.set(messageId, read);

    const event: CommunicationEvent = {
      eventId: `evt-${messageId}-read`,
      type: "message",
      worldTime,
      participants: [message.senderId, message.recipientId],
      payload: {
        messageId,
        status: "read",
        readAtTick: worldTime.tick,
      },
    };
    this.emittedEvents.push(event);

    return { ok: true, event };
  }

  getMessage(messageId: string): Message | undefined {
    return this.messages.get(messageId);
  }

  listMessages(actorId?: string): Message[] {
    const all = Array.from(this.messages.values());
    if (!actorId) return all;
    return all.filter((m) => m.senderId === actorId || m.recipientId === actorId);
  }

  // ── Kontaktmuster ────────────────────────────────────────────

  getContactPattern(actorId: string): ContactPattern | undefined {
    return this.contactPatterns.get(actorId);
  }

  updateContactPattern(
    actorId: string,
    pattern: Partial<ContactPattern>,
    currentTick: number
  ): void {
    const existing = this.contactPatterns.get(actorId);
    const next: ContactPattern = {
      actorId,
      contactFrequency: 0,
      reciprocityScore: 0,
      recentHistory: [],
      ...existing,
      ...pattern,
      updatedAtTick: currentTick,
    };
    this.contactPatterns.set(actorId, next);
  }

  recordContactOutcome(actorId: string, status: CommunicationStatus, currentTick: number): void {
    const pattern = this.contactPatterns.get(actorId);
    const history = pattern ? [...pattern.recentHistory] : [];
    history.push(`${status}@${currentTick}`);
    // Nur die letzten 10 Einträge behalten
    const trimmedHistory = history.slice(-10);

    let frequency = pattern ? pattern.contactFrequency : 0;
    frequency += 1;

    let reciprocity = pattern ? pattern.reciprocityScore : 0;
    if (status === "completed" || status === "read") reciprocity += 5;
    if (status === "missed" || status === "ignored" || status === "rejected") reciprocity -= 5;
    reciprocity = Math.max(-100, Math.min(100, reciprocity));

    this.updateContactPattern(
      actorId,
      {
        contactFrequency: frequency,
        reciprocityScore: reciprocity,
        recentHistory: trimmedHistory,
      },
      currentTick
    );
  }

  // ── Gesprächsflüsse ──────────────────────────────────────────

  startConversationFlow(
    callId: string,
    participantId: string,
    worldTime: WorldTime
  ): { ok: boolean; flow?: ConversationFlow; error?: string } {
    const call = this.calls.get(callId);
    if (!call) {
      return { ok: false, error: `Call ${callId} not found` };
    }
    if (call.status !== "active") {
      return { ok: false, error: `Call ${callId} is not active` };
    }

    const flowId = `flow-${this.nextFlowId++}`;
    const flow: ConversationFlow = {
      flowId,
      callId,
      participantId,
      stage: "greeting",
    };
    this.conversationFlows.set(flowId, flow);

    return { ok: true, flow };
  }

  advanceConversationFlow(
    flowId: string,
    stage: ConversationFlow["stage"],
    playerChoice?: string,
    consequence?: string,
    worldTime?: WorldTime
  ): { ok: boolean; flow?: ConversationFlow; error?: string } {
    const flow = this.conversationFlows.get(flowId);
    if (!flow) {
      return { ok: false, error: `Flow ${flowId} not found` };
    }

    const updated: ConversationFlow = {
      ...flow,
      stage,
      playerChoice,
      consequence,
      completedAtTick:
        stage === "closing" ? (worldTime?.tick ?? 0) : flow.completedAtTick,
    };
    this.conversationFlows.set(flowId, updated);

    return { ok: true, flow: updated };
  }

  getConversationFlow(flowId: string): ConversationFlow | undefined {
    return this.conversationFlows.get(flowId);
  }

  // ── NPC Kontaktinitiative ────────────────────────────────────

  registerNPCInitiative(initiative: NPCContactInitiative): void {
    this.npcInitiatives.set(initiative.npcId, initiative);
  }

  getNPCInitiative(npcId: string): NPCContactInitiative | undefined {
    return this.npcInitiatives.get(npcId);
  }

  listNPCInitiatives(): NPCContactInitiative[] {
    return Array.from(this.npcInitiatives.values());
  }

  /**
   * Berechnet ob ein NPC zu einer gegebenen Zeit Kontakt aufnehmen sollte,
   * basierend auf Persönlichkeit, Cooldown und Tageszeit.
   */
  shouldNPCContact(
    npcId: string,
    worldTime: WorldTime,
    calendar: CalendarDate
  ): { shouldContact: boolean; reason?: string; occasion?: CallOccasion } {
    const initiative = this.npcInitiatives.get(npcId);
    if (!initiative) {
      return { shouldContact: false, reason: "No initiative registered" };
    }

    const lastContact = initiative.lastContactTick ?? 0;
    const ticksSinceLastContact = worldTime.tick - lastContact;
    if (ticksSinceLastContact < initiative.contactCooldownTicks) {
      return { shouldContact: false, reason: "Cooldown active" };
    }

    // Persönlichkeitsspezifische Logik
    const hour = parseInt(calendar.timeOfDay.split(":")[0], 10);
    switch (initiative.personality) {
      case "contact-friendly":
        return { shouldContact: true, occasion: "social" };
      case "reserved":
        if (ticksSinceLastContact < initiative.contactCooldownTicks * 2) {
          return { shouldContact: false, reason: "Reserved personality" };
        }
        return { shouldContact: true, occasion: "casual" };
      case "grudge-holding":
        return { shouldContact: false, reason: "Grudge-holding personality" };
      case "busy":
        if (hour >= 9 && hour <= 17) {
          return { shouldContact: false, reason: "Busy during work hours" };
        }
        return { shouldContact: true, occasion: "casual" };
      case "spontaneous":
        return { shouldContact: true, occasion: "social" };
      default:
        return { shouldContact: false, reason: "Unknown personality" };
    }
  }

  // ── Domain Events ────────────────────────────────────────────

  getEmittedEvents(): CommunicationEvent[] {
    return [...this.emittedEvents];
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }

  // ── Intern ───────────────────────────────────────────────────

  private updateContactActivity(actorId: string, tick: number): void {
    const contact = this.contacts.get(actorId);
    if (contact) {
      this.contacts.set(actorId, {
        ...contact,
        lastContactTick: tick,
        contactCount: contact.contactCount + 1,
      });
    }
    this.recordContactOutcome(actorId, "completed", tick);
  }

  private calendarFromWorldTime(worldTime: WorldTime): CalendarDate {
    const totalMinutes = Math.floor((worldTime.tickInDay * 520) / 60000);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const timeOfDay = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

    const DAYS_PER_YEAR = 120;
    const DAYS_PER_SEASON = 30;
    const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

    const year = Math.floor(worldTime.day / DAYS_PER_YEAR);
    const dayInYear = worldTime.day % DAYS_PER_YEAR;
    const seasonIndex = Math.floor(dayInYear / DAYS_PER_SEASON);
    const seasonDay = dayInYear % DAYS_PER_SEASON;
    const weekday = WEEKDAYS[worldTime.day % WEEKDAYS.length];
    const season = SEASONS[seasonIndex];

    return {
      day: worldTime.day,
      weekday,
      season,
      seasonDay,
      year,
      timeOfDay,
    };
  }

  // ── Statistik ────────────────────────────────────────────────

  getStats(): {
    contacts: number;
    blockedContacts: number;
    totalCalls: number;
    activeCalls: number;
    missedCalls: number;
    totalMessages: number;
    unreadMessages: number;
    totalEvents: number;
    totalFlows: number;
  } {
    const calls = Array.from(this.calls.values());
    const messages = Array.from(this.messages.values());
    const contacts = Array.from(this.contacts.values());

    return {
      contacts: contacts.length,
      blockedContacts: contacts.filter((c) => c.blocked).length,
      totalCalls: calls.length,
      activeCalls: calls.filter((c) => c.status === "active").length,
      missedCalls: calls.filter((c) => c.status === "missed").length,
      totalMessages: messages.length,
      unreadMessages: messages.filter((m) => m.status === "sent" || m.status === "delivered").length,
      totalEvents: this.emittedEvents.length,
      totalFlows: this.conversationFlows.size,
    };
  }
}

export const communicationDomain = new CommunicationDomain();

// ──────────────────────────────────────────────────────────────────────────────
// NPC Contact Planner (NPC-Initiative)
// ──────────────────────────────────────────────────────────────────────────────

export interface NPCContactPlan {
  readonly npcId: string;
  readonly targetActorId: string;
  readonly action: "call" | "message";
  readonly scheduledAtTick: number;
  readonly reason: string;
  readonly priority: number; // 1..10
}

export class NPCContactPlanner {
  private plans = new Map<string, NPCContactPlan[]>(); // npcId -> plans
  private readonly communicationDomain: CommunicationDomain;

  constructor(communicationDomain: CommunicationDomain) {
    this.communicationDomain = communicationDomain;
  }

  planContact(
    npcId: string,
    targetActorId: string,
    action: "call" | "message",
    scheduledAtTick: number,
    reason: string,
    priority: number = 5
  ): void {
    const plan: NPCContactPlan = {
      npcId,
      targetActorId,
      action,
      scheduledAtTick,
      reason,
      priority: Math.max(1, Math.min(10, priority)),
    };

    const existing = this.plans.get(npcId) ?? [];
    existing.push(plan);
    existing.sort((a, b) => b.priority - a.priority || a.scheduledAtTick - b.scheduledAtTick);
    this.plans.set(npcId, existing);
  }

  getDuePlans(npcId: string, currentTick: number): NPCContactPlan[] {
    const plans = this.plans.get(npcId) ?? [];
    return plans.filter((p) => p.scheduledAtTick <= currentTick);
  }

  executePlan(
    plan: NPCContactPlan,
    worldTime: WorldTime
  ): { ok: boolean; error?: string } {
    if (plan.action === "call") {
      const result = this.communicationDomain.startCall(
        plan.npcId,
        plan.targetActorId,
        worldTime,
        "social"
      );
      return result;
    } else {
      const result = this.communicationDomain.sendMessage(
        plan.npcId,
        plan.targetActorId,
        `Nachricht von NPC ${plan.npcId}: ${plan.reason}`,
        worldTime
      );
      return result;
    }
  }

  clearExecutedPlans(npcId: string, beforeTick: number): number {
    const plans = this.plans.get(npcId) ?? [];
    const remaining = plans.filter((p) => p.scheduledAtTick > beforeTick);
    const removed = plans.length - remaining.length;
    this.plans.set(npcId, remaining);
    return removed;
  }

  listPlans(npcId: string): NPCContactPlan[] {
    return this.plans.get(npcId) ?? [];
  }
}

export const npcContactPlanner = new NPCContactPlanner(communicationDomain);