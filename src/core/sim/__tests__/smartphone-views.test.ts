/**
 * @test-target: src/core/sim/smartphone-views.ts
 * @error-code: ERR-1002
 *
 * Inbox, Vitter und ImmoLuck duerfen keine zweite Wahrheit anlegen: die Inbox
 * liest das Archiv, Vitter die Erinnerungen der Bewohner, ImmoLuck den
 * bestehenden Katalog. Diese Tests halten genau diese Grenzen fest.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { createWorld } from '../templates';
import { immoluckView, inboxView, vitterView } from '../smartphone-views';
import type { JournalEvent } from '../journal';
import type { CityResidentState } from '../city-life-types';

function event(overrides: Partial<JournalEvent> & Pick<JournalEvent, 'id'>): JournalEvent {
  return {
    tick: 100,
    day: 2,
    kind: 'SYSTEM',
    subject: 'Ereignis',
    cause: 'Ursache',
    effect: 'Wirkung',
    ...overrides,
  };
}

describe('Smartphone-Sichten', () => {
  describe('Inbox', () => {
    it('liest Archiv-Ereignisse mit Absender und laesst Buchhaltung draussen', () => {
      const world = createWorld('SMALL');
      world.archive.push(
        event({ id: 1, kind: 'MONEY', subject: 'Gast zahlte', refs: { guestId: 7 } }),
        event({ id: 2, kind: 'GUEST', subject: 'Gast beschwert sich', refs: { guestId: 7 } }),
        event({ id: 3, kind: 'RIVAL', subject: 'Rivale senkt Preise', refs: { rivalId: 'kessler' } }),
        event({ id: 4, kind: 'SYSTEM', subject: 'Strom weg' }),
      );

      const messages = inboxView(world);

      expect(messages).toHaveLength(3);
      expect(messages.map((message) => message.id)).toEqual([4, 3, 2]);
      expect(messages.every((message) => message.subject !== 'Gast zahlte')).toBe(true);
      expect(messages[1]).toMatchObject({ source: 'RIVALE', from: 'Rivale kessler' });
      expect(messages[2]).toMatchObject({ source: 'GAST', from: 'Gast #7', body: 'Ursache — Wirkung' });
      expect(messages.map((message) => message.source)).toEqual(['VERWALTUNG', 'RIVALE', 'GAST']);
    });

    it('begrenzt die Liste, ohne das Archiv zu veraendern', () => {
      const world = createWorld('SMALL');
      for (let id = 1; id <= 5; id += 1) world.archive.push(event({ id, kind: 'GUEST', refs: { guestId: id } }));
      const before = world.archive.length;

      expect(inboxView(world, 2).map((message) => message.id)).toEqual([5, 4]);
      expect(world.archive).toHaveLength(before);
    });
  });

  describe('Vitter', () => {
    function withMemories(base: readonly CityResidentState[]): CityResidentState[] {
      const first = base[0];
      const second = base[1];
      if (first === undefined || second === undefined) throw new Error('Test braucht zwei Bewohner');
      return [
        {
          ...first,
          memories: [
            { id: 1, tick: 50, kind: 'RUMOR', aboutNpcId: second.npcId, sentiment: -1, confidence: 0.6 },
            { id: 2, tick: 70, kind: 'SOCIAL', aboutNpcId: second.npcId, sentiment: 1, confidence: 1 },
            { id: 3, tick: 80, kind: 'MEAL', aboutNpcId: second.npcId, sentiment: 1, confidence: 1 },
            { id: 4, tick: 90, kind: 'RUMOR', aboutNpcId: null, sentiment: 1, confidence: 0.4 },
          ],
        },
        { ...second, memories: [] },
      ];
    }

    it('trennt Geruecht von eigener Erinnerung und nennt Sicherheit und Gegenuber', () => {
      const world = createWorld('SMALL');
      const residents = withMemories(world.cityLife.residents);
      const first = residents[0];
      const second = residents[1];
      if (first === undefined || second === undefined) throw new Error('Test braucht zwei Bewohner');
      const view = vitterView({ ...world, cityLife: { ...world.cityLife, residents } });

      expect(view.map((post) => post.id)).toEqual([
        `${first.npcId}:SOCIAL:2`,
        `${first.npcId}:RUMOR:1`,
      ]);
      expect(view[0]).toMatchObject({
        author: first.name,
        about: second.name,
        source: 'ERINNERUNG',
        sentiment: 1,
        confidence: 1,
      });
      expect(view[1]).toMatchObject({ source: 'GERUECHT', sentiment: -1, confidence: 0.6 });
    });
  });

  describe('ImmoLuck', () => {
    it('zeigt denselben Katalog wie das Charakterfenster und rechnet nur die Kaufbarkeit', () => {
      const world = createWorld('SMALL');
      const poor = immoluckView(world, fromVC(0));
      const rich = immoluckView(world, fromVC(5000));

      expect(poor.listings.length).toBeGreaterThan(0);
      expect(poor.listings.map((listing) => listing.id)).toEqual(rich.listings.map((listing) => listing.id));
      expect(poor.listings.every((listing) => listing.affordable === false)).toBe(true);
      expect(rich.listings.find((listing) => listing.id === 'KNEIPE')?.affordable).toBe(true);
      expect(poor.property.owned).toBeNull();
      expect(rich.listings.every((listing) => listing.owned === false)).toBe(true);
    });
  });
});
