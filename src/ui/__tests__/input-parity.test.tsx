/**
 * @vitest-environment jsdom
 * @test-target: src/ui/use-stage-keys.ts
 * @error-code: ERR-3001
 *
 * Tastatur und Pointer laufen pro Aktion durch denselben Handler. Die Tests
 * setzen beide Wege gegeneinander, statt nur das Vorhandensein eines Buttons
 * zu behaupten.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { worldStore } from '../../store/use-world-store';
import type { MenuAction } from '../../render/floor-actions';
import { ActionCard } from '../action-card';
import { useWorkshopShortcut } from '../app-effects';
import { Dock } from '../dock';
import { FloorFeedback } from '../floor-feedback';
import { FloorRoleBar } from '../floor-role-bar';
import { OnboardingPanel } from '../onboarding-panel';
import { handleFloorKey, type FloorKeyboardState } from '../floor-keyboard';
import { useCrateActions } from '../use-crate-actions';
import { useFloorInteraction } from '../use-floor-interaction';
import { useStageKeys } from '../use-stage-keys';
import { StageControls } from '../stage-controls';
import { PopupShell } from '../popup-shell';

beforeEach(() => { worldStore.newGame('SMALL'); });
afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

const noop = (): void => {};

function mainAction(): MenuAction {
  return { id: 'MOVE_HERE', label: 'Hierhin laufen', enabled: true, queued: true, point: { x: 2, y: 2 } };
}

function keyE(): KeyboardEvent {
  return { key: 'e', repeat: false, target: { tagName: 'BODY' }, preventDefault: noop } as unknown as KeyboardEvent;
}

function floorState(over: Partial<FloorKeyboardState> = {}): FloorKeyboardState {
  return {
    view: worldStore.getSnapshot(), enabled: true, blocked: false, selection: null,
    tap: vi.fn(), pick: vi.fn(), ...over,
  };
}

describe('Tastatur/Pointer-Parität', () => {
  it('Laufen per WASD und per Boden-Aktionskarte wählt dieselbe MOVE_HERE-Aktion', () => {
    const move = vi.spyOn(worldStore, 'moveStep').mockImplementation(noop);
    const { unmount } = renderHook(() => useStageKeys({ enabled: true, zoom: noop, fit: noop }));
    fireEvent.keyDown(window, { key: 'w' });
    expect(move).toHaveBeenCalledWith(0, -1);
    unmount();

    const pointerPick = vi.fn();
    const action = mainAction();
    render(<ActionCard actions={[action]} onPick={pointerPick} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hierhin laufen' }));
    expect(pointerPick).toHaveBeenCalledWith(action);

    const keyboardPick = vi.fn();
    handleFloorKey(keyE(), floorState({
      selection: { target: { kind: 'floor', x: 2, y: 2 }, actions: [action], anchor: null, status: '', blocked: false },
      pick: keyboardPick,
    }));
    expect(keyboardPick).toHaveBeenCalledWith(action);
  });

  it('Zoom und Fit laufen per Taste und per sichtbarem Kamera-Knopf auf denselben Callback', () => {
    const zoom = vi.fn();
    const fit = vi.fn();
    const { unmount } = renderHook(() => useStageKeys({ enabled: true, zoom, fit }));
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '0' });
    expect(zoom).toHaveBeenCalledWith(1.22);
    expect(fit).toHaveBeenCalled();
    unmount();

    render(<StageControls zoom={zoom} overview={fit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht' }));
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(fit).toHaveBeenCalledTimes(2);
  });

  it('Escape und der sichtbare Schließen-Knopf rufen denselben Popup-Handler', () => {
    const close = vi.fn();
    render(<PopupShell eyebrow="TEST" title="Testfenster" onClose={close}><button type="button">Aktion</button></PopupShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('Enter und der sichtbare Ablade-Knopf nutzen dieselbe Kistenaktion', () => {
    const world = createWorld('SMALL');
    world.scene = { kind: 'OWN' };
    world.player.carrying = 'KRATE:1';
    const view = buildView(world, new Ledger(), '');
    const unload = vi.spyOn(worldStore, 'useCarriedHere').mockImplementation(noop);

    function Harness() {
      useCrateActions(view, { canOperate: true, blocked: false, onError: noop });
      return <FloorFeedback view={view} onOpen={noop} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'AM FELD ABLADEN' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(unload).toHaveBeenCalledTimes(2);
  });

  it('Werkstatt-Shortcut und DU-Dock-Ziel öffnen dasselbe Menü', () => {
    const open = vi.fn();
    function Harness() {
      useWorkshopShortcut(open);
      return <Dock view={worldStore.getSnapshot()} perspective="operator" onPlay={noop} onBuild={noop} onClean={noop} onOpen={open} />;
    }
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'DU' }));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('ein Szenenwechsel räumt den Tastaturfokus genauso auf wie einen Pointer-Fokus', () => {
    const start = renderHook(({ view }: { view: ReturnType<typeof worldStore.getSnapshot> }) => useFloorInteraction({
      view, enabled: true, blocked: false, onExecute: noop,
    }), { initialProps: { view: worldStore.getSnapshot() } });
    act(() => start.result.current.tap({
      target: { kind: 'floor', x: 1, y: 1 }, actions: [mainAction()], at: { x: 0, y: 0 }, anchor: null,
    }));
    expect(start.result.current.selection).not.toBeNull();
    worldStore.visitForeign('HAFENKLAUSE');
    act(() => start.rerender({ view: worldStore.getSnapshot() }));
    expect(start.result.current.selection).toBeNull();
    start.unmount();
  });

  it('ein Szenenwechsel bricht die laufende Auftragskette ab und lässt keinen Laufweg stehen', () => {
    worldStore.queue.enqueueMove({ x: 2, y: 2 });
    expect(worldStore.getSnapshot().queue).toHaveLength(1);

    worldStore.visitForeign('HAFENKLAUSE');
    expect(worldStore.getSnapshot().queue).toHaveLength(0);
    expect(worldStore.getSnapshot().player.path).toHaveLength(0);

    worldStore.leaveForeign();
    expect(worldStore.getSnapshot().queue).toHaveLength(0);
    expect(worldStore.getSnapshot().player.path).toHaveLength(0);
  });

  it('FOREIGN sperrt WASD, Zoom, Fit, E und die Kamera-Knöpfe', () => {
    worldStore.visitForeign('HAFENKLAUSE');
    const move = vi.spyOn(worldStore, 'moveStep').mockImplementation(noop);
    const zoom = vi.fn();
    const fit = vi.fn();
    const { result, unmount } = renderHook(() => useStageKeys({ enabled: true, zoom, fit }));
    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '0' });
    expect(move).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(fit).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
    unmount();

    const interaction = renderHook(() => useFloorInteraction({
      view: worldStore.getSnapshot(), enabled: true, blocked: false, onExecute: noop,
    }));
    const nearest = vi.spyOn(worldStore.interaction, 'nearest');
    fireEvent.keyDown(window, { key: 'e' });
    expect(nearest).not.toHaveBeenCalled();
    interaction.unmount();

    render(<StageControls zoom={zoom} overview={fit} />);
    expect(screen.queryByRole('button', { name: 'Hineinzoomen' })).toBeNull();
    render(<FloorRoleBar perspective="operator" />);
    expect(screen.getByText('FREMDER FLOOR')).toBeTruthy();
    render(<OnboardingPanel view={worldStore.getSnapshot()} onOpen={noop} />);
    expect(screen.queryByText('ERSTE SCHRITTE')).toBeNull();
    const staleCity = {
      ...worldStore.getSnapshot(),
      scene: { key: 'OWN', kind: 'OWN' as const, label: 'Dein Casino' },
      onboarding: { step: 'CITY' as const },
    };
    render(<OnboardingPanel view={staleCity} onOpen={noop} />);
    expect(screen.queryByText('ERSTE SCHRITTE')).toBeNull();
  });
});
