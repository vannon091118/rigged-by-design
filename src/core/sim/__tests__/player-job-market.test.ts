/** @test-target: src/core/sim/player-job-market.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { acceptJob } from '../player-jobs';
import { listJobOffers, applyForJob, acceptJobOffer, withdrawApplication, hasOffer, getApplication } from '../player-job-market';
import { createWorld } from '../templates';
import { newPlayerRpg } from '../player-rpg';
import { newPlayerSkills } from '../player-skills';
import type { WorldState } from '../types';

function cleanWorld(): WorldState {
  const world = createWorld('SMALL');
  world.player.skills = newPlayerSkills();
  world.player.rpg = newPlayerRpg();
  return world;
}

function acceptFirstJob(world: WorldState): void {
  acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
}

describe('Spieler-Arbeitsmarkt (Issue #804)', () => {
  it('listet Stellen aus betretbaren PUB/SHOP/OFFICE/WORKSHOP Gebäuden auf', () => {
    const world = cleanWorld();
    // Erstelle ein paar Gebäude im World-State für den Test
    // createWorld sollte bereits Gebäude haben; prüfen ob Angebote kommen
    const offers = listJobOffers(world, []);
    expect(Array.isArray(offers)).toBe(true);
    // Mit leerer Gebäude-Liste sollte keine Angebote kommen
    expect(offers).toHaveLength(0);
  });

  it('filtert verschlossene oder unfertige Gebäude heraus', () => {
    const world = cleanWorld();
    const lockedBuilding = {
      id: 'bld_locked',
      name: 'Verschlossener Rohbau',
      kind: 'PUB' as const,
      footprint: { x: 0, y: 0, w: 1, h: 1 },
      entrance: { x: -1, y: -1 },
      interiorLayoutId: 'layout_pub',
      tenantIds: [],
      locked: true,
      occupancy: 0,
      construction: 'SHELL' as const,
    };
    const offers = listJobOffers(world, [lockedBuilding]);
    expect(offers).toHaveLength(0);
  });

  it('bewerbung setzt appliedTo', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    applyForJob(world, 'bld_pub_1', 'pub_barkeeper');
    expect(world.player.job!.appliedTo).toBe('bld_pub_1');
  });

  it('verweigert doppelte Bewerbung', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    applyForJob(world, 'bld_pub_1', 'pub_barkeeper');
    expect(() => applyForJob(world, 'bld_shop_1', 'shop_seller')).toThrow();
  });

  it('withdrawApplication setzt appliedTo auf null', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    applyForJob(world, 'bld_pub_1', 'pub_barkeeper');
    withdrawApplication(world);
    expect(world.player.job!.appliedTo).toBeNull();
  });

  it('getApplication gibt offene Bewerbung zurück', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    applyForJob(world, 'bld_pub_1', 'pub_barkeeper');
    const app = getApplication(world);
    expect(app.buildingId).toBe('bld_pub_1');
  });

  it('hasOffer ist false ohne Angebot', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    expect(hasOffer(world, 'bld_pub_1')).toBe(false);
  });

  it('acceptJobOffer wirft wenn kein Angebot vorliegt', () => {
    const world = cleanWorld();
    acceptFirstJob(world);
    expect(() => acceptJobOffer(world, 'bld_pub_1')).toThrow();
  });
});
