/**
 * Communication View — Phase 5.3
 * Spielbare Anruf-Ansicht mit Identität, Anlass-Kontext und Aktionen.
 * Kommunikation-Historie und relevante Erinnerungen.
 * Darstellung strikt aus Simulations-Snapshots abgeleitet.
 */

import type {
  Call,
  CommunicationStatus,
  Contact,
  Message,
  ConversationFlow,
} from "./communication";

export interface CallViewProps {
  readonly call: Call;
  readonly contact?: Contact;
  readonly onAnswer: (callId: string) => void;
  readonly onReject: (callId: string) => void;
  readonly onIgnore: (callId: string) => void;
  readonly onHangup: (callId: string) => void;
  readonly onCallback: (callId: string, scheduledAt: number) => void;
  readonly onDial: (calleeId: string) => void;
}

export interface DialerProps {
  readonly onDial: (calleeId: string) => void;
  readonly placeholder?: string;
}

export interface ConversationFlowProps {
  readonly flow: ConversationFlow;
  readonly onChoice: (flowId: string, choice: string) => void;
}

export interface CommunicationHistoryProps {
  readonly calls: Call[];
  readonly messages: Message[];
  readonly contacts: Contact[];
}

export interface IncomingCallProps {
  readonly call: Call;
  readonly contact: Contact;
  readonly calendarTime: string;
  readonly onAnswer: (callId: string) => void;
  readonly onReject: (callId: string) => void;
  readonly onIgnore: (callId: string) => void;
  readonly onCallback: (callId: string) => void;
}

/**
 * Rendert eine aktive Anruf-Ansicht mit Kontext.
 */
export function renderCallView(props: CallViewProps): string {
  const { call, contact, onAnswer, onReject, onIgnore, onHangup, onCallback, onDial } = props;

  const isRinging = call.status === "ringing";
  const isActive = call.status === "active";
  const isInbound = call.direction === "inbound";
  const contactName = contact?.displayName ?? (isInbound ? call.callerId : call.calleeId);
  const occasion = call.occasion ? ` (${call.occasion})` : "";

  let actions: string;

  if (isRinging && isInbound) {
    actions = `
      <button onclick="onAnswer('${call.callId}')">Annehmen</button>
      <button onclick="onReject('${call.callId}')">Ablehnen</button>
      <button onclick="onIgnore('${call.callId}')">Ignorieren</button>
      <button onclick="onCallback('${call.callId}', 0)">Später zurückrufen</button>
    `;
  } else if (isActive) {
    actions = `
      <button onclick="onHangup('${call.callId}')">Auflegen</button>
      <div>Dauer: ${call.durationTicks} Ticks</div>
    `;
  } else if (isRinging && !isInbound) {
    actions = `
      <div>Wartet auf Annahme von ${contactName}...</div>
      <button onclick="onHangup('${call.callId}')">Auflegen</button>
    `;
  } else if (call.status === "callback" && call.callbackScheduledAt) {
    actions = `
      <div>Rückruf geplant für Tick ${call.callbackScheduledAt}</div>
      <button onclick="onHangup('${call.callId}')">Abbrechen</button>
    `;
  } else {
    actions = `<div>Anruf beendet.</div>`;
  }

  return `
    <div class="call-view" data-status="${call.status}">
      <div class="call-info">
        <strong>${isInbound ? "Von" : "An"}: </strong>${contactName}
        <br/>
        <strong>Status: </strong>${callStatusLabel(call.status)}${occasion}
      </div>
      <div class="call-actions">${actions}</div>
    </div>
  `;
}

/**
 * Rendert einen eingehenden Anruf mit Identität und Kontext.
 */
export function renderIncomingCall(props: IncomingCallProps): string {
  const { call, contact, calendarTime, onAnswer, onReject, onIgnore, onCallback } = props;

  return `
    <div class="incoming-call" data-status="${call.status}">
      <div class="caller-identity">
        <strong>Eingehender Anruf</strong><br/>
        <span class="caller-name">${contact.displayName}</span>
        <br/>
        <span class="caller-id">${contact.actorId}</span>
        <br/>
        <span class="call-time">${calendarTime}</span>
        <br/>
        <span class="call-occasion">${call.occasion ?? "casual"}</span>
      </div>
      <div class="call-actions">
        <button onclick="onAnswer('${call.callId}')">Annehmen</button>
        <button onclick="onReject('${call.callId}')">Ablehnen</button>
        <button onclick="onIgnore('${call.callId}')">Ignorieren</button>
        <button onclick="onCallback('${call.callId}')">Später zurückrufen</button>
      </div>
    </div>
  `;
}

/**
 * Rendert ein Wählfeld (Dialer).
 */
export function renderDialer(props: DialerProps): string {
  const { onDial, placeholder = "Nummer oder Kontakt wählen" } = props;
  return `
    <div class="dialer">
      <input type="text" id="dialer-input" placeholder="${placeholder}"/>
      <button onclick="onDial(document.getElementById('dialer-input').value)">Wählen</button>
    </div>
  `;
}

/**
 * Rendert die Kommunikations-Historie (Anrufe und Nachrichten).
 */
export function renderCommunicationHistory(props: CommunicationHistoryProps | Call[]): string {
  let calls: Call[];
  let messages: Message[] = [];
  let contacts: Contact[] = [];

  if (Array.isArray(props)) {
    calls = props;
  } else {
    calls = props.calls;
    messages = props.messages ?? [];
    contacts = props.contacts ?? [];
  }

  if (calls.length === 0 && messages.length === 0) {
    return `<div class="history-empty">Keine Kommunikations-Historie</div>`;
  }

  const contactMap = new Map(contacts.map((c) => [c.actorId, c.displayName]));

  const callItems = calls
    .map(
      (call) => {
        const name =
          contactMap.get(call.callerId) ??
          contactMap.get(call.calleeId) ??
          (call.direction === "outbound" ? call.calleeId : call.callerId);
        return `
          <div class="history-item call">
            <span class="direction">${call.direction === "outbound" ? "→" : "←"}</span>
            <span class="contact-name">${name}</span>
            <span class="status-${call.status}">${callStatusLabel(call.status)}</span>
            ${call.occasion ? `<span class="occasion">(${call.occasion})</span>` : ""}
            ${call.durationTicks > 0 ? `<span class="duration">${call.durationTicks}T</span>` : ""}
          </div>
        `;
      }
    )
    .join("");

  const messageItems = messages
    .map(
      (msg) => {
        const name =
          contactMap.get(msg.senderId) ??
          contactMap.get(msg.recipientId) ??
          (msg.direction === "outbound" ? msg.recipientId : msg.senderId);
        return `
          <div class="history-item message">
            <span class="direction">${msg.direction === "outbound" ? "→" : "←"}</span>
            <span class="contact-name">${name}</span>
            <span class="status-${msg.status}">${msg.status}</span>
            <span class="preview">${msg.content.substring(0, 40)}${msg.content.length > 40 ? "…" : ""}</span>
          </div>
        `;
      }
    )
    .join("");

  return `
    <div class="communication-history">
      ${callItems}
      ${messageItems}
    </div>
  `;
}

/**
 * Rendert einen Gesprächsfluss mit Spielerentscheidungen.
 */
export function renderConversationFlow(props: ConversationFlowProps): string {
  const { flow, onChoice } = props;

  const stageLabels: Record<ConversationFlow["stage"], string> = {
    greeting: "Begrüßung",
    topic: "Thema",
    decision: "Entscheidung",
    closing: "Abschluss",
  };

  let choices: string = "";
  if (flow.playerChoice) {
    choices = `<div class="player-choice">Deine Wahl: ${flow.playerChoice}</div>`;
  } else if (flow.stage === "decision") {
    choices = `
      <div class="choices">
        <button onclick="onChoice('${flow.flowId}', 'accept')">Annehmen</button>
        <button onclick="onChoice('${flow.flowId}', 'decline')">Ablehnen</button>
        <button onclick="onChoice('${flow.flowId}', 'postpone')">Später</button>
      </div>
    `;
  }

  return `
    <div class="conversation-flow" data-stage="${flow.stage}">
      <div class="flow-stage">${stageLabels[flow.stage]}</div>
      ${flow.consequence ? `<div class="consequence">${flow.consequence}</div>` : ""}
      ${choices}
    </div>
  `;
}

/**
 * Gibt den Status-Text für einen Anruf zurück.
 */
export function callStatusLabel(status: CommunicationStatus): string {
  const labels: Record<CommunicationStatus, string> = {
    pending: "Ausstehend",
    ringing: "Klingelt",
    active: "Aktiv",
    completed: "Beendet",
    missed: "Verpasst",
    failed: "Fehlgeschlagen",
    blocked: "Blockiert",
    ignored: "Ignoriert",
    callback: "Rückruf",
    rejected: "Abgelehnt",
  };
  return labels[status] ?? status;
}

/**
 * Gibt den Status-Text für eine Nachricht zurück.
 */
export function messageStatusLabel(status: MessageStatus): string {
  const labels: Record<MessageStatus, string> = {
    sent: "Gesendet",
    delivered: "Zugestellt",
    read: "Gelesen",
    failed: "Fehlgeschlagen",
  };
  return labels[status] ?? status;
}

export type MessageStatus = "sent" | "delivered" | "read" | "failed";