/**
 * Smartphone-Sichten: Inbox, Vitter-Feed und ImmoLuck.
 *
 * Alle drei sind reine Ableitungen aus vorhandenen Wahrheiten:
 * - Inbox: das dauerhafte Journal-Archiv (`world.archive`), gefiltert auf
 *   Ereignisse mit Absender (Gast, Personal, Rivale, Stadt, Verwaltung).
 * - Vitter: die Erinnerungen der Stadtbewohner (`CityResidentState.memories`)
 *   samt ihrer gerichteten Beziehungen. Ein Geruecht bleibt ein Geruecht:
 *   Quelle und Sicherheit stehen im Datensatz, nicht in der Prosa.
 * - ImmoLuck: derselbe Immobilienkatalog wie das Charakterfenster
 *   (`propertyView`), damit es keine zweite Angebotsliste gibt.
 *
 * Nichts davon wird gespeichert: kein zweiter Nachrichten-Stack, kein zweiter
 * Feed, keine zweite Geldquelle. Der Kauf laeuft weiter ueber
 * `cityCmd({ kind: 'buyProperty' })` und den Ledger.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import type { JournalEvent, JournalKind } from './journal';
import { propertyView, type PlayerPropertyView } from './property';
import type { WorldState } from './types';

type InboxSource = 'GAST' | 'PERSONAL' | 'RIVALE' | 'STADT' | 'VERWALTUNG';

export interface InboxMessageView {
  readonly id: number;
  readonly day: number;
  readonly tick: number;
  readonly source: InboxSource;
  readonly from: string;
  readonly subject: string;
  readonly body: string;
}

/** Geldbuchungen sind Buchhaltung, keine Nachricht; sie bleiben im Archiv. */
const MESSAGE_KINDS: ReadonlySet<JournalKind> = new Set<JournalKind>([
  'GUEST', 'STAFF', 'STOCK', 'RIVAL', 'SYSTEM',
]);

function inboxSource(event: JournalEvent): InboxSource {
  if (event.refs?.guestId !== undefined) return 'GAST';
  if (event.refs?.agentId !== undefined) return 'PERSONAL';
  if (event.refs?.rivalId !== undefined) return 'RIVALE';
  if (event.refs?.buildingId !== undefined) return 'STADT';
  return 'VERWALTUNG';
}

function inboxFrom(event: JournalEvent): string {
  switch (inboxSource(event)) {
    case 'GAST': return `Gast #${event.refs?.guestId}`;
    case 'PERSONAL': return `Personal #${event.refs?.agentId}`;
    case 'RIVALE': return `Rivale ${event.refs?.rivalId ?? ''}`.trim();
    case 'STADT': return 'Stadtverwaltung';
    default: return 'Verwaltung';
  }
}

/**
 * Nachrichten sind Archiv-Ereignisse mit Absender, neueste zuerst.
 * Der Filter ist der einzige Unterschied zum Archiv: keine Kopie, kein Cache.
 */
export function inboxView(world: WorldState, limit = 12): readonly InboxMessageView[] {
  const messages: InboxMessageView[] = [];
  for (const event of world.archive) {
    if (!MESSAGE_KINDS.has(event.kind)) continue;
    messages.push({
      id: event.id,
      day: event.day,
      tick: event.tick,
      source: inboxSource(event),
      from: inboxFrom(event),
      subject: event.subject,
      body: `${event.cause} — ${event.effect}`,
    });
  }
  return messages.slice(-limit).reverse();
}

type VitterSource = 'GERUECHT' | 'ERINNERUNG';

export interface VitterPostView {
  /** Stabil ueber Save/Load: Bewohner, Erinnerung und Art. */
  readonly id: string;
  readonly author: string;
  readonly about: string;
  readonly tick: number;
  readonly source: VitterSource;
  /** -1 unangenehm, 1 angenehm; der Wert kommt aus der Erinnerung. */
  readonly sentiment: number;
  /** 0..1; ein weitergegebenes Geruecht ist immer unsicherer als der eigene Besuch. */
  readonly confidence: number;
}

/**
 * Vitter zeigt, was ein Bewohner ueber einen anderen weiss oder gehoert hat.
 * Posts ohne Gegenuber (`aboutNpcId === null`) sind keine Aussage ueber jemanden
 * und bleiben draussen; bestaetigte Fakten behauptet der Feed nie.
 */
export function vitterView(world: WorldState, limit = 15): readonly VitterPostView[] {
  const names = new Map<string, string>();
  for (const resident of world.cityLife.residents) names.set(resident.npcId, resident.name);

  const posts: VitterPostView[] = [];
  for (const resident of world.cityLife.residents) {
    for (const memory of resident.memories) {
      if (memory.aboutNpcId === null) continue;
      if (memory.kind !== 'RUMOR' && memory.kind !== 'SOCIAL') continue;
      const about = names.get(memory.aboutNpcId);
      if (about === undefined) continue;
      posts.push({
        id: `${resident.npcId}:${memory.kind}:${memory.id}`,
        author: resident.name,
        about,
        tick: memory.tick,
        source: memory.kind === 'RUMOR' ? 'GERUECHT' : 'ERINNERUNG',
        sentiment: memory.sentiment >= 0 ? 1 : -1,
        confidence: Math.max(0, Math.min(1, memory.confidence)),
      });
    }
  }
  posts.sort((left, right) => (right.tick - left.tick) || right.id.localeCompare(left.id));
  return posts.slice(0, limit);
}

interface ImmoluckListingView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly priceVC: number;
  readonly owned: boolean;
  readonly affordable: boolean;
}

export interface ImmoluckView {
  /** Dieselbe Sicht wie das Charakterfenster; keine zweite Angebotsliste. */
  readonly property: PlayerPropertyView;
  readonly listings: readonly ImmoluckListingView[];
}

/**
 * ImmoLuck liest den vorhandenen Katalog. Gekauft wird nicht hier, sondern
 * ueber den bestehenden Stadt-Befehl; der Ledger bleibt die Geldwahrheit.
 */
export function immoluckView(world: WorldState, wallet: VaCoinMicro): ImmoluckView {
  const property = propertyView(world, wallet);
  return {
    property,
    listings: property.offers.map((offer) => ({
      id: offer.id,
      label: offer.label,
      description: offer.description,
      priceVC: offer.priceVC,
      owned: offer.owned,
      affordable: offer.affordable,
    })),
  };
}

/**
 * Die drei Smartphone-Sichten als ein Snapshot-Beitrag. `snapshot.ts` bleibt
 * dadurch bei seiner Zeilenzahl (Hot Zone) und rechnet selbst nichts nach.
 */
export function smartphoneSnapshot(world: WorldState, wallet: VaCoinMicro) {
  return {
    inbox: inboxView(world),
    vitter: vitterView(world),
    immoluck: immoluckView(world, wallet),
  };
}
