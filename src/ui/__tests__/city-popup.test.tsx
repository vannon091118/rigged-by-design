/**
 * @vitest-environment jsdom
 * @test-target: src/ui/city-popup.tsx
 * @error-code: ERR-3001
 *
 * Ansprechbar ist nur, wer am selben Ort steht. Der Klick reicht die
 * NPC-Kennung an den Stadt-Command; die UI bietet ihn nicht für Abwesende an,
 * weil der Encounter sonst ein Fernmenü wäre (#507).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { cityOf, cityView } from '../../core/sim/city';
import { advanceCityGrowth } from '../../core/sim/city-growth';
import { cityGrowthView } from '../../core/sim/city-growth-view';
import { createCityScene } from '../../core/sim/city-scene';
import { ensureCityLife, ensureCityPopulation } from '../../core/sim/city-life-state';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { worldStore } from '../../store/use-world-store';
import { CityPopup } from '../city-popup';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Stadtfenster', () => {
  it('spricht einen generierten Bewohner ueber seine Kennung an', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    ensureCityPopulation(world, 12);
    const life = ensureCityLife(world);
    world.city = { ...cityOf(world), location: 'KIEZ' };
    world.cityLife = {
      ...life,
      residents: life.residents.map((resident) => ({ ...resident, location: 'KIEZ' })),
    };
    const city = cityView(world);
    expect(city.location).toBe('KIEZ');
    const generated = city.residents.find((resident) => resident.npcId === 'npc_4');
    expect(generated?.npcId).toBe('npc_4');

    const meet = vi.spyOn(worldStore, 'city').mockImplementation(() => {});
    render(<CityPopup city={city} growth={cityGrowthView(world, new Ledger())} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: `${generated!.name} ansprechen` }));

    expect(meet).toHaveBeenCalledWith({ kind: 'meet', npcId: 'npc_4' });
  });

  it('bietet Abwesende nicht zum Ansprechen an', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    ensureCityPopulation(world, 12);
    const life = ensureCityLife(world);
    world.city = { ...cityOf(world), location: 'KIEZ' };
    world.cityLife = {
      ...life,
      residents: life.residents.map((resident, index) => ({
        ...resident, location: index === 0 ? 'KIEZ' : 'HOME',
      })),
    };
    const city = cityView(world);
    const away = city.residents.find((resident) => resident.location !== city.location)!;
    render(<CityPopup city={city} growth={cityGrowthView(world, new Ledger())} onClose={() => {}} />);
    const button = screen.getByRole('button', { name: `${away.name} ansprechen` });
    expect(button).toHaveProperty('disabled', true);
  });

  it('zeigt Arbeitsmarkt, Bautraeger-Kapital und den letzten Bau (#526)', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    world.cityScene = createCityScene();
    ensureCityLife(world);
    ensureCityPopulation(world, 60);
    const ledger = new Ledger({});
    world.day = 1;
    const report = advanceCityGrowth(world, ledger)!;

    render(
      <CityPopup
        city={cityView(world)}
        growth={cityGrowthView(world, ledger)}
        onClose={() => {}}
      />,
    );

    const growth = screen.getByLabelText('Stadtwachstum');
    expect(growth.textContent).toContain('Bewohner 60');
    // Der versiegelte Neubau zaehlt nicht als Stelle: die Joblosen bleiben (#566).
    expect(growth.textContent).toContain(`Joblose ${report.joblessBefore}`);
    expect(growth.textContent).toContain('Bauträger-Kapital');
    expect(growth.textContent).toContain('Ein Bau ist möglich.');
    expect(growth.textContent).toContain(report.building.name);
    expect(growth.textContent).toContain('steht im Protokoll');
  });
});
