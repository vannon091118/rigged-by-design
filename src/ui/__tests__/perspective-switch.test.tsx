/**
 * @vitest-environment jsdom
 * @test-target: src/ui/perspective-switch.tsx
 * @error-code: ERR-3001
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveSwitch } from '../perspective-switch';

afterEach(cleanup);

describe('Perspektive', () => {
  it('markiert genau eine Perspektive und meldet den Wechsel', () => {
    const onChange = vi.fn();
    render(<PerspectiveSwitch perspective="guest" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'GAST' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'BETREIBER' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'BETREIBER' }));
    expect(onChange).toHaveBeenCalledWith('operator');
  });
});
