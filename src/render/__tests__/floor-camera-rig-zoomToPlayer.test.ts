/**
 * @test-target: src/render/floor-camera-rig.ts
 * @error-code: ERR-3001
 */
import { describe, expect, it, vi } from 'vitest';
import { TILE } from '../../core/sim/types';
import { FloorCameraRig } from '../floor-camera-rig';

function makeRig(screenW: number, screenH: number, worldSize = 30) {
  const screen = { width: screenW, height: screenH };
  const canvas = () => ({
    getBoundingClientRect: () => ({ width: screenW, height: screenH, left: 0, top: 0 })
  } as HTMLCanvasElement);
  const onDetail = vi.fn();
  const onApplied = vi.fn();
  const bounds = () => ({ width: worldSize, height: worldSize });
  const rig = new FloorCameraRig({ screen, canvas, size: () => worldSize, bounds, onDetail, onApplied, pixelRatio: () => 1 });
  rig.resetForLayout();
  return { rig, onDetail, onApplied };
}

describe('FloorCameraRig.zoomToPlayer', () => {
  it('setzt LOD auf 1 (Detail) bei Desktop-Viewport', () => {
    // Desktop: 1920x1080 → REGION*TILE=780 passt locker
    const { rig, onDetail } = makeRig(1920, 1080);
    // Spieler in Region-Mitte
    const playerX = 15 * TILE + 13 * TILE;
    const playerY = 15 * TILE + 13 * TILE;
    rig.zoomToPlayer(playerX, playerY);
    expect(rig.lod).toBe(1);
    expect(onDetail).toHaveBeenCalledWith(true);
  });

  it('bleibt bei LOD 0 (Uebersicht) wenn Viewport zu klein (Mobile 390x844)', () => {
    // Mobile: 390x844 → 780 > 390, passt NICHT
    const { rig, onDetail } = makeRig(390, 844);
    const playerX = 15 * TILE + 13 * TILE;
    const playerY = 15 * TILE + 13 * TILE;
    rig.zoomToPlayer(playerX, playerY);
    expect(rig.lod).toBe(0);
    expect(onDetail).toHaveBeenCalledWith(false);
  });

  it('passt genau bei Wohnung 16x16 (416x416) -> LOD 1', () => {
    // Wohnung: 16 Tiles = 416px, Viewport 500x900 → passt mit 4% Rand (500*0.96=480 > 416)
    const { rig, onDetail } = makeRig(500, 900, 16);
    const playerX = 8 * TILE + 13 * TILE;
    const playerY = 8 * TILE + 13 * TILE;
    rig.zoomToPlayer(playerX, playerY);
    expect(rig.lod).toBe(1);
    expect(onDetail).toHaveBeenCalledWith(true);
  });

  it('wartet bei Position 0,0 bis echter Wert gesetzt wird (Race Condition Guard)', () => {
    const { rig } = makeRig(1920, 1080);
    // Aufruf mit 0,0 darf NICHT zoomen (bleibt Overview)
    rig.zoomToPlayer(0, 0);
    expect(rig.lod).toBe(0); // noch Overview
    // Danach mit echter Position
    rig.zoomToPlayer(15 * TILE, 15 * TILE);
    expect(rig.lod).toBe(1); // jetzt Detail
  });

  it('fit() wendet sofort an (Sofort-Apply für Mobile-Fallback)', () => {
    const { rig, onApplied } = makeRig(1920, 1080);
    rig.fit();
    expect(rig.lod).toBe(0);
    expect(onApplied).toHaveBeenCalledWith(0, expect.any(Number));
  });
});