/**
 * @test-target: src/core/sim/npc-schedule.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import type {
  DayPlan,
  NpcIntent,
  NpcIntentKind,
  NpcLODLevel,
  NpcLODState,
  NpcNeeds,
  NpcScheduleEntry,
} from '../npc-types';
import {
  computeLODLevel,
  createDefaultNeeds,
  FATIGUE_THRESHOLD_URGENT,
  HUNGER_THRESHOLD_URGENT,
  THIRST_THRESHOLD_URGENT,
  needsOverrideIntent,
  SOCIAL_THRESHOLD_URGENT,
  tickNeeds,
} from '../npc-needs';
import {
  createDayPlan,
  nextIntentForHour,
  resolveNpcIntent,
  STANDARD_WORKDAY_ENTRIES,
} from '../npc-schedule';

describe('npc-types and contract integrity', () => {
  it('creates typed DayPlan and LOD state with exact fields', () => {
    const plan: DayPlan = createDayPlan('npc_bob', 'apt_bob', 'bld_workshop');
    expect(plan.npcId).toBe('npc_bob');
    expect(plan.entries.length).toBe(12);

    const firstEntry: NpcScheduleEntry = plan.entries[0]!;
    expect(firstEntry.intent).toBe<NpcIntentKind>('SLEEP');
    expect(firstEntry.targetBuildingId).toBe('apt_bob');

    const lodLevel: NpcLODLevel = 'ACTIVE';
    const lodState: NpcLODState = {
      npcId: 'npc_bob',
      level: lodLevel,
      buildingId: 'apt_bob',
      positionApprox: { x: 5, y: 5 },
      lastKnownHour: 7,
    };
    expect(lodState.level).toBe('ACTIVE');
    expect(lodState.positionApprox?.x).toBe(5);
  });
});

describe('npc-needs and threshold logic', () => {
  it('initializes default needs within valid ranges', () => {
    const needs: NpcNeeds = createDefaultNeeds();
    expect(needs.hunger).toBe(20);
    expect(needs.thirst).toBe(20);
    expect(needs.fatigue).toBe(10);
    expect(needs.social).toBe(30);
    expect(needs.money).toBe(5000);
    expect(needs.mood).toBe(75);
  });

  it('updates needs deterministically during sleep and pub visits', () => {
    const startNeeds = createDefaultNeeds({ fatigue: 50, hunger: 20 });
    const afterSleep = tickNeeds(startNeeds, 'SLEEP', 2);
    expect(afterSleep.fatigue).toBe(20);
    expect(afterSleep.hunger).toBe(26);
    expect(afterSleep.thirst).toBe(24);

    const afterPub = tickNeeds(startNeeds, 'PUB', 1);
    expect(afterPub.social).toBe(10);
    expect(afterPub.mood).toBe(85);
    expect(afterPub.thirst).toBe(0);
  });

  it('triggers overrides based on thresholds', () => {
    expect(HUNGER_THRESHOLD_URGENT).toBe(85);
    expect(THIRST_THRESHOLD_URGENT).toBe(85);
    expect(FATIGUE_THRESHOLD_URGENT).toBe(90);
    expect(SOCIAL_THRESHOLD_URGENT).toBe(80);

    const tiredNeeds = createDefaultNeeds({ fatigue: 92 });
    expect(needsOverrideIntent(tiredNeeds)).toBe<NpcIntentKind>('SLEEP');

    const starvingNeeds = createDefaultNeeds({ hunger: 88, money: 600 });
    expect(needsOverrideIntent(starvingNeeds)).toBe<NpcIntentKind>('EAT_OUT');

    const brokeStarvingNeeds = createDefaultNeeds({ hunger: 88, money: 100 });
    expect(needsOverrideIntent(brokeStarvingNeeds)).toBe<NpcIntentKind>('EAT_HOME');

    const thirstyNeeds = createDefaultNeeds({ thirst: 88, money: 600 });
    expect(needsOverrideIntent(thirstyNeeds)).toBe<NpcIntentKind>('PUB');

    const lonelyNeeds = createDefaultNeeds({ social: 85 });
    expect(needsOverrideIntent(lonelyNeeds)).toBe<NpcIntentKind>('PUB');
  });

  it('computes correct LOD level based on distance and interior context', () => {
    expect(computeLODLevel(5, false)).toBe<NpcLODLevel>('ACTIVE');
    expect(computeLODLevel(500, true)).toBe<NpcLODLevel>('ACTIVE');
    expect(computeLODLevel(30, false)).toBe<NpcLODLevel>('NEIGHBORHOOD');
    expect(computeLODLevel(100, false)).toBe<NpcLODLevel>('OFFSCREEN');
    expect(computeLODLevel(200, false)).toBe<NpcLODLevel>('ABSTRACT');
  });
});

describe('npc-schedule evaluation and resolution', () => {
  it('maps standard workday entries across 24 hours', () => {
    expect(STANDARD_WORKDAY_ENTRIES.length).toBe(12);
    const plan = createDayPlan('npc_alice');

    const morningEntry = nextIntentForHour(plan, 7);
    expect(morningEntry?.intent).toBe<NpcIntentKind>('EAT_HOME');

    const workEntry = nextIntentForHour(plan, 10);
    expect(workEntry?.intent).toBe<NpcIntentKind>('WORK');

    const nightEntry = nextIntentForHour(plan, 23);
    expect(nightEntry?.intent).toBe<NpcIntentKind>('SLEEP');
  });

  it('resolves intent with emergency needs override', () => {
    const plan = createDayPlan('npc_alice');
    const scheduledWork = nextIntentForHour(plan, 10);
    expect(scheduledWork?.intent).toBe('WORK');

    const normalNeeds = createDefaultNeeds();
    const normalIntent: NpcIntent = resolveNpcIntent(normalNeeds, scheduledWork!, 10);
    expect(normalIntent.kind).toBe<NpcIntentKind>('WORK');
    expect(normalIntent.priority).toBe(5);

    const exhaustedNeeds = createDefaultNeeds({ fatigue: 95 });
    const overrideIntent: NpcIntent = resolveNpcIntent(exhaustedNeeds, scheduledWork!, 10);
    expect(overrideIntent.kind).toBe<NpcIntentKind>('SLEEP');
    expect(overrideIntent.priority).toBe(9);
  });
});
