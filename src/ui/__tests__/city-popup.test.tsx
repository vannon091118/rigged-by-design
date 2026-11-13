/**
 * @vitest-environment jsdom
 * @test-target: src/ui/city-popup.tsx
 * @error-code: ERR-3001
 *
 * Jeder gelistete Bewohner hat einen Ansprech-Pfad. Der Klick reicht die
 * NPC-Kennung an den Stadt-Command, nicht den Ort: Auch eine Figur, die gerade
 * nicht am selben Ort steht, bleibt über ihre Kennung erreichbar.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cityView } from '../../core/sim/city';
import { ensureCityPopulation } from '../../core/sim/city-life-state';
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
    const city = cityView(world);
    const generated = city.residents.find((resident) => resident.npcId === 'npc_4');
    expect(generated?.npcId).toBe('npc_4');

    const meet = vi.spyOn(worldStore, 'city').mockImplementation(() => {});
    render(<CityPopup city={city} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: `${generated!.name} ansprechen` }));

    expect(meet).toHaveBeenCalledWith({ kind: 'meet', npcId: 'npc_4' });
  });
});
