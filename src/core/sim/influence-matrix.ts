/**
 * Die eine balancebare Matrix: Faktor-Katalog, Kontexte, Cross-Kanten und
 * Main-Event-Pool. Aenderungen hier sind die einzige Quelle der Gewichtungen;
 * `influence-config.ts` validiert sie beim Laden fail-closed.
 */
export const RAW_INFLUENCE_MATRIX = {
  version: 1,
  defaultContext: 'neutral',
  factors: {
    mood: {
      id: 'mood', category: 'ZUSTAND', baseWeight: 1, range: { min: 0, max: 100 },
      children: [
        { id: 'mood.laune', category: 'ZUSTAND', baseWeight: 1, source: 'mood', weight: 0.1 },
        { id: 'mood.zufriedenheit', category: 'ERINNERUNG', baseWeight: 1, source: 'satisfaction', weight: 0.1 },
      ],
    },
    sociability: {
      id: 'sociability', category: 'SOZIAL', baseWeight: 1, range: { min: 0, max: 100 },
      children: [
        { id: 'sociability.geraue', category: 'SOZIAL', baseWeight: 1, source: 'rumor', weight: 0.05 },
      ],
    },
    thirst: {
      id: 'thirst', category: 'ZUSTAND', baseWeight: 1, range: { min: 0, max: 100 },
      children: [
        { id: 'thirst.trockenheit', category: 'ZUSTAND', baseWeight: 1, source: 'thirst', weight: 0.1 },
      ],
    },
    rumor: {
      id: 'rumor', category: 'SOZIAL', baseWeight: 1, range: { min: -1, max: 1 },
      children: [
        { id: 'rumor.gerede', category: 'SOZIAL', baseWeight: 1, source: 'rumor', weight: 0.1 },
      ],
    },
    trust: {
      id: 'trust', category: 'BEZIEHUNG', baseWeight: 1, range: { min: -10, max: 10 },
      children: [
        { id: 'trust.erfahrung', category: 'BEZIEHUNG', baseWeight: 1, source: 'trust', weight: 0.1 },
        { id: 'trust.zuwendung', category: 'ERINNERUNG', baseWeight: 1, source: 'satisfaction', weight: 0.1 },
      ],
    },
    sympathy: {
      id: 'sympathy', category: 'BEZIEHUNG', baseWeight: 1, range: { min: -10, max: 10 },
      children: [
        { id: 'sympathy.naehe', category: 'BEZIEHUNG', baseWeight: 1, source: 'sympathy', weight: 0.1 },
        { id: 'sympathy.zuwendung', category: 'ERINNERUNG', baseWeight: 1, source: 'satisfaction', weight: 0.1 },
      ],
    },
    conflict: {
      id: 'conflict', category: 'BEZIEHUNG', baseWeight: 1, range: { min: -10, max: 10 },
      children: [
        { id: 'conflict.reibung', category: 'BEZIEHUNG', baseWeight: 1, source: 'conflict', weight: 0.1 },
        { id: 'conflict.entschaerfung', category: 'ERINNERUNG', baseWeight: 1, source: 'satisfaction', weight: -0.1 },
      ],
    },
    satisfaction: {
      id: 'satisfaction', category: 'ERINNERUNG', baseWeight: 1, range: { min: 0, max: 100 },
      children: [
        { id: 'satisfaction.zuwendung', category: 'ERINNERUNG', baseWeight: 1, source: 'satisfaction', weight: 0.1 },
        { id: 'satisfaction.gerede', category: 'SOZIAL', baseWeight: 1, source: 'rumor', weight: 0.05 },
      ],
    },
  },
  contexts: {
    bar: {
      label: 'Bar', threshold: 0.6,
      weights: {
        mood: 0.3, sociability: 0.1, thirst: 0.3, rumor: 0.1,
        trust: 0.1, sympathy: 0.05, conflict: 0, satisfaction: 0,
      },
    },
    slot: {
      label: 'Spielgeraet', threshold: 0.8,
      weights: {
        mood: 0, sociability: 0, thirst: 0, rumor: 0.15,
        trust: 0, sympathy: 0, conflict: 0, satisfaction: 0,
      },
    },
    neutral: {
      label: 'Neutral', threshold: 0.5,
      weights: {
        mood: 0.2, sociability: 0.2, thirst: 0.2, rumor: 0.1,
        trust: 0.1, sympathy: 0.1, conflict: 0.1, satisfaction: 0,
      },
    },
    'event-warm': {
      label: 'Pool: Zuwendung', threshold: 0.45,
      weights: {
        mood: 0.1, sociability: 0.2, thirst: 0, rumor: 0,
        trust: 0.3, sympathy: 0.3, conflict: 0, satisfaction: 0,
      },
    },
    'event-tense': {
      label: 'Pool: Spannung', threshold: 0.5,
      weights: {
        mood: 0, sociability: 0.1, thirst: 0, rumor: 0,
        trust: 0, sympathy: 0, conflict: 0.7, satisfaction: 0,
      },
    },
    'event-neutral': {
      label: 'Pool: Alltag', threshold: 0.5,
      weights: {
        mood: 0.2, sociability: 0.4, thirst: 0.2, rumor: 0.1,
        trust: 0.05, sympathy: 0.05, conflict: 0, satisfaction: 0,
      },
    },
    share: {
      label: 'Weitergabe', threshold: 0.38,
      weights: {
        mood: 0.2, sociability: 0.3, thirst: 0, rumor: 0.1,
        trust: 0.1, sympathy: 0.1, conflict: 0, satisfaction: 0,
      },
    },
  },
  furnitureContexts: {
    BAR: 'bar', SLOT: 'slot', TABLE: 'slot', TOILET: 'neutral',
    EXCHANGE: 'neutral', DECOR: 'neutral', STORAGE: 'neutral', JOB_STATION: 'neutral',
  },
  cross: [
    { from: 'thirst', to: 'mood', weight: -0.2 },
    { from: 'rumor', to: 'mood', weight: 0.25 },
    { from: 'sociability', to: 'thirst', weight: -0.1 },
    { from: 'trust', to: 'sociability', weight: 0.15 },
    { from: 'sympathy', to: 'sociability', weight: 0.1 },
    { from: 'conflict', to: 'sociability', weight: -0.25 },
    { from: 'satisfaction', to: 'mood', weight: 0.35, contexts: ['bar'] },
  ],
  eventPool: {
    chance: 0.2, idleCooldownTicks: 120, recencyWindowTicks: 900,
    recencyPenalty: 0.45, repeatLockout: 1, weightFloor: 0.05,
    events: {
      AMBIENT_BAR_TALK: { context: 'event-warm', baseWeight: 1 },
      AMBIENT_SHARED_ROUND: { context: 'event-neutral', baseWeight: 1 },
      AMBIENT_TENSE_TABLE: { context: 'event-tense', baseWeight: 1 },
    },
  },
};
